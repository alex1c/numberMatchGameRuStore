/**
 * App-level campaign progress + persistence provider (PHASE 5).
 *
 * Hydrates once and owns PersistRepository. Does NOT depend on GameSession
 * (provider order: AppState в†’ GameSession в†’ shell). Screens / hooks bridge
 * gameplay into persistence via the methods below.
 *
 * DEV fixtures must call markDevFixtureSession() and must NOT write campaign
 * activeSession through these methods.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import {
	CAMPAIGN_LEVEL_COUNT,
	CAMPAIGN_VERSION,
} from '../game/campaign'
import type { BoardState } from '../game/core'
import type { GameSessionState, SessionPuzzleIdentity } from '../game/session'
import { strings } from '../i18n/strings.ru'
import {
	PersistRepository,
	buildActiveSession,
	createAsyncStorageAdapter,
	createDefaultRoot,
	type PersistedActiveSession,
	type PersistedRootV2,
	type PersistedSessionPurpose,
	type StorageAdapter,
} from '../storage'
import { totalStars, type StarCount } from '../game/stars'
import { spacing, typography, useTheme } from '../theme'
import type { AppRouteName } from '../navigation'
import {
	frontierLevel,
	gameSessionFromPersisted,
	prepareCampaignLevel,
} from './campaignSession'

export type HydrateStatus = 'pending' | 'ready' | 'failed'

/** How the live GameSession was launched вЂ” controls persist path. */
export type SessionLaunchSource = 'campaign' | 'dev_fixture' | 'none'

export interface StartCampaignLevelResult {
	readonly ok: boolean
	readonly reason?: string
	readonly level?: number
	readonly purpose?: PersistedSessionPurpose
	readonly identity?: SessionPuzzleIdentity
	readonly board?: BoardState
}

interface AppStateContextValue {
	readonly hydrateStatus: HydrateStatus
	/** Decided once after hydrate вЂ” never changes (avoids flicker races). */
	readonly initialRoute: AppRouteName
	readonly root: PersistedRootV2
	readonly trainingCompleted: boolean
	readonly highestCompletedLevel: number
	readonly activeSession: PersistedActiveSession | null
	readonly bestStars: readonly StarCount[]
	readonly totalStars: number
	readonly sessionSource: SessionLaunchSource
	readonly repository: PersistRepository
	readonly completeTraining: () => Promise<void>
	/**
	 * Persist a new campaign activeSession and return identity/board for
	 * GameSession.startSession. Does not touch GameSession itself.
	 */
	readonly startCampaignLevel: (
		level: number,
		purpose: PersistedSessionPurpose,
	) => Promise<StartCampaignLevelResult>
	readonly commitProgressionCompletion: (
		level: number,
		session: GameSessionState,
	) => Promise<PersistedRootV2 | null>
	readonly commitReplayCompletion: (
		level: number,
		session: GameSessionState,
	) => Promise<PersistedRootV2 | null>
	readonly clearActiveSession: () => Promise<void>
	readonly syncSessionFromGameplay: (
		session: GameSessionState,
	) => Promise<void>
	readonly resetProgress: () => Promise<void>
	readonly markDevFixtureSession: () => void
	readonly markCampaignSession: () => void
	readonly clearSessionSource: () => void
	/** Build GameSessionState from persisted activeSession (caller restores). */
	readonly buildRestoredGameSession: () => GameSessionState | null
}

const AppStateContext = createContext<AppStateContextValue | null>(null)

function createRepository(adapter?: StorageAdapter): PersistRepository {
	return new PersistRepository(adapter ?? createAsyncStorageAdapter())
}

export function AppStateProvider({
	children,
	adapter,
}: {
	readonly children: ReactNode
	/** Inject memory adapter in tests. */
	readonly adapter?: StorageAdapter
}) {
	const theme = useTheme()
	const [repository] = useState(() => createRepository(adapter))

	const [hydrateStatus, setHydrateStatus] = useState<HydrateStatus>('pending')
	const [root, setRoot] = useState<PersistedRootV2>(createDefaultRoot)
	const [initialRoute, setInitialRoute] = useState<AppRouteName>('home')
	const [sessionSource, setSessionSource] =
		useState<SessionLaunchSource>('none')
	const initialRouteLocked = useRef(false)
	const completionInFlight = useRef(false)

	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const hydrated = await repository.hydrate()
				if (cancelled) {
					return
				}
				setRoot(hydrated)
				if (!initialRouteLocked.current) {
					initialRouteLocked.current = true
					setInitialRoute(
						hydrated.trainingCompleted ? 'home' : 'training',
					)
				}
				if (hydrated.activeSession) {
					setSessionSource('campaign')
				}
				setHydrateStatus('ready')
			} catch (err) {
				if (__DEV__) {
					console.warn('[AppState] hydrate failed; using defaults', err)
				}
				const fallback = createDefaultRoot()
				if (!cancelled) {
					setRoot(fallback)
					if (!initialRouteLocked.current) {
						initialRouteLocked.current = true
						setInitialRoute('training')
					}
					setHydrateStatus('failed')
				}
			}
		})()
		return () => {
			cancelled = true
		}
	}, [repository])

	const completeTraining = useCallback(async () => {
		const next = await repository.setTrainingCompleted(true)
		setRoot(next)
	}, [repository])

	const startCampaignLevel = useCallback(
		async (
			level: number,
			purpose: PersistedSessionPurpose,
		): Promise<StartCampaignLevelResult> => {
			const prepared = prepareCampaignLevel(level, purpose)
			if (!prepared.ok) {
				return { ok: false, reason: prepared.reason }
			}

			const highest = repository.getRoot().highestCompletedLevel
			if (purpose === 'progression') {
				if (level !== highest + 1) {
					return {
						ok: false,
						reason: `progression_not_at_frontier_${level}_vs_${highest}`,
					}
				}
			} else if (purpose === 'replay') {
				if (level < 1 || level > highest) {
					return { ok: false, reason: 'replay_locked' }
				}
			}

			const session = buildActiveSession({
				purpose,
				status: 'in_progress',
				level: prepared.level,
				seed: prepared.entry.seed,
				profile: prepared.entry.profile,
				fingerprint: prepared.entry.fingerprint,
				density: prepared.entry.density,
				board: prepared.board,
				initialBoard: prepared.board,
				history: [],
				counters: {
					matchesRemoved: 0,
					appendActions: 0,
					undoActions: 0,
				},
				usedHint: false,
				usedUndo: false,
			})

			const next = await repository.setActiveSession(session)
			setRoot(next)
			setSessionSource('campaign')
			return {
				ok: true,
				level: prepared.level,
				purpose,
				identity: prepared.identity,
				board: prepared.board,
			}
		},
		[repository],
	)

	const commitProgressionCompletion = useCallback(
		async (
			level: number,
			session: GameSessionState,
		): Promise<PersistedRootV2 | null> => {
			// Guard double-tap / concurrent Next+complete races.
			if (completionInFlight.current) {
				return null
			}
			if (sessionSource !== 'campaign') {
				return null
			}
			const active = repository.getRoot().activeSession
			if (!active || active.purpose !== 'progression') {
				return null
			}
			// Idempotent: already committed this level as completed.
			if (
				active.status === 'completed' &&
				active.level === level &&
				repository.getRoot().highestCompletedLevel >= level
			) {
				return repository.getRoot()
			}
			completionInFlight.current = true
			try {
				const next = await repository.commitProgressionCompletion({
					level,
					board: session.board,
					counters: session.counters,
					seed: active.seed,
					profile: active.profile,
					fingerprint: active.fingerprint,
					density: active.density,
					usedHint: session.usedHint,
					usedUndo: session.usedUndo,
					initialBoard: session.initialBoard,
					generationVersion: active.generationVersion,
				})
				setRoot(next)
				return next
			} finally {
				completionInFlight.current = false
			}
		},
		[repository, sessionSource],
	)

	const commitReplayCompletion = useCallback(
		async (
			level: number,
			session: GameSessionState,
		): Promise<PersistedRootV2 | null> => {
			if (completionInFlight.current) {
				return null
			}
			if (sessionSource !== 'campaign') {
				return null
			}
			const active = repository.getRoot().activeSession
			if (!active || active.purpose !== 'replay') {
				return null
			}
			if (active.status === 'completed' && active.level === level) {
				return repository.getRoot()
			}
			completionInFlight.current = true
			try {
				const next = await repository.commitReplayCompletion({
					level,
					board: session.board,
					counters: session.counters,
					seed: active.seed,
					profile: active.profile,
					fingerprint: active.fingerprint,
					density: active.density,
					usedHint: session.usedHint,
					usedUndo: session.usedUndo,
					initialBoard: session.initialBoard,
					generationVersion: active.generationVersion,
				})
				setRoot(next)
				return next
			} finally {
				completionInFlight.current = false
			}
		},
		[repository, sessionSource],
	)

	const clearActiveSession = useCallback(async () => {
		const next = await repository.clearActiveSession()
		setRoot(next)
		setSessionSource('none')
	}, [repository])

	const syncSessionFromGameplay = useCallback(
		async (session: GameSessionState) => {
			if (sessionSource !== 'campaign') {
				return
			}
			const active = repository.getRoot().activeSession
			if (!active || active.status === 'completed') {
				return
			}
			const next = await repository.syncActiveGameplay({
				board: session.board,
				history: session.history,
				counters: session.counters,
				usedHint: session.usedHint,
				usedUndo: session.usedUndo,
				status: 'in_progress',
			})
			setRoot(next)
		},
		[repository, sessionSource],
	)

	const resetProgress = useCallback(async () => {
		if (typeof __DEV__ !== 'undefined' && !__DEV__) {
			return
		}
		const next = await repository.resetAll()
		setRoot(next)
		setSessionSource('none')
	}, [repository])

	const markDevFixtureSession = useCallback(() => {
		setSessionSource('dev_fixture')
	}, [])

	const markCampaignSession = useCallback(() => {
		setSessionSource('campaign')
	}, [])

	const clearSessionSource = useCallback(() => {
		setSessionSource('none')
	}, [])

	const buildRestoredGameSession = useCallback((): GameSessionState | null => {
		const active = root.activeSession
		if (!active) {
			return null
		}
		const state = gameSessionFromPersisted(active)
		if (!state) {
			return null
		}
		return { ...state, undoAfterCompletion: false }
	}, [root.activeSession])

	const value = useMemo<AppStateContextValue>(
		() => ({
			hydrateStatus,
			initialRoute,
			root,
			trainingCompleted: root.trainingCompleted,
			highestCompletedLevel: root.highestCompletedLevel,
			activeSession: root.activeSession,
			bestStars: root.bestStars,
			totalStars: totalStars(root.bestStars),
			sessionSource,
			repository,
			completeTraining,
			startCampaignLevel,
			commitProgressionCompletion,
			commitReplayCompletion,
			clearActiveSession,
			syncSessionFromGameplay,
			resetProgress,
			markDevFixtureSession,
			markCampaignSession,
			clearSessionSource,
			buildRestoredGameSession,
		}),
		[
			hydrateStatus,
			initialRoute,
			root,
			sessionSource,
			repository,
			completeTraining,
			startCampaignLevel,
			commitProgressionCompletion,
			commitReplayCompletion,
			clearActiveSession,
			syncSessionFromGameplay,
			resetProgress,
			markDevFixtureSession,
			markCampaignSession,
			clearSessionSource,
			buildRestoredGameSession,
		],
	)

	if (hydrateStatus === 'pending') {
		return (
			<View
				style={[styles.loading, { backgroundColor: theme.colors.background }]}
				testID="app-loading"
				accessibilityLabel={strings.loading}
			>
				<ActivityIndicator color={theme.colors.accent} />
				<Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
					{strings.loading}
				</Text>
			</View>
		)
	}

	return (
		<AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
	)
}

export function useAppState(): AppStateContextValue {
	const ctx = useContext(AppStateContext)
	if (!ctx) {
		throw new Error('useAppState requires AppStateProvider')
	}
	return ctx
}

/** DEV diagnostics helper вЂ” campaignVersion stays in sync with catalog. */
export function formatDevDiagnostics(root: PersistedRootV2): string {
	const level = root.activeSession?.level ?? 'вЂ”'
	return (
		`schema ${root.schemaVersion} В· campaign v${CAMPAIGN_VERSION} ` +
		`В· level ${level} В· rev ${root.revision}`
	)
}

/** Exported for tests вЂ” ensure frontier arithmetic stays consistent. */
export function nextPlayLevel(highestCompletedLevel: number): number {
	if (highestCompletedLevel >= CAMPAIGN_LEVEL_COUNT) {
		return CAMPAIGN_LEVEL_COUNT
	}
	return frontierLevel(highestCompletedLevel)
}

const styles = StyleSheet.create({
	loading: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing.md,
	},
	loadingText: {
		...typography.body,
	},
})
