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
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native'

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
	buildDailyActiveSession,
	createAsyncStorageAdapter,
	createDefaultRoot,
	type PersistedActiveSession,
	type PersistedRootV3,
	type PersistedSessionPurpose,
	type PersistedStatistics,
	type StorageAdapter,
	type ThemePreference,
} from '../storage'
import { totalStars, type StarCount } from '../game/stars'
import {
	createDailyPuzzle,
	getActiveCurrentStreak,
	isDailyCompletedOn,
	currentLocalDateKey,
	type LocalDateKey,
} from '../daily'
import type { PersistedDailyState } from '../daily/types'
import { starsFromAttempt } from '../game/stars'
import { spacing, typography, getThemeColors } from '../theme'
import { trackEvent } from '../analytics'
import {
	evaluateAchievementUnlocks,
	type AchievementNotifyContext,
} from './achievementsNotify'
import type { AppRouteName } from '../navigation'
import {
	frontierLevel,
	dailyIdentity,
	gameSessionFromPersisted,
	gameSessionFromPersistedDaily,
	prepareCampaignLevel,
} from './campaignSession'

export type HydrateStatus = 'pending' | 'ready' | 'failed'

/** How the live GameSession was launched вЂ” controls persist path. */
export type SessionLaunchSource = 'campaign' | 'daily' | 'dev_fixture' | 'none'

export interface StartDailyPuzzleResult {
	readonly ok: boolean
	readonly reason?: string
	readonly dateKey?: LocalDateKey
	readonly identity?: SessionPuzzleIdentity
	readonly board?: BoardState
}

export interface DailySummary {
	readonly dateKey: LocalDateKey
	readonly completedToday: boolean
	readonly bestStarsToday: StarCount
	readonly activeStreak: number
	readonly bestStreak: number
	readonly hasActiveSession: boolean
}

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
	readonly root: PersistedRootV3
	readonly trainingCompleted: boolean
	readonly highestCompletedLevel: number
	readonly activeSession: PersistedActiveSession | null
	readonly daily: PersistedDailyState
	readonly statistics: PersistedStatistics
	readonly themePreference: ThemePreference
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
	) => Promise<PersistedRootV3 | null>
	readonly commitReplayCompletion: (
		level: number,
		session: GameSessionState,
	) => Promise<PersistedRootV3 | null>
	readonly startDailyPuzzle: () => Promise<StartDailyPuzzleResult>
	readonly syncDailyFromGameplay: (session: GameSessionState) => Promise<void>
	readonly commitDailyCompletion: (
		session: GameSessionState,
	) => Promise<AchievementNotifyContext | null>
	readonly buildRestoredDailySession: () => GameSessionState | null
	readonly getDailySummary: (todayKey: LocalDateKey) => DailySummary
	readonly discardStaleDailyIfDateChanged: (
		todayKey: LocalDateKey,
	) => Promise<void>
	readonly clearActiveSession: () => Promise<void>
	readonly syncSessionFromGameplay: (
		session: GameSessionState,
	) => Promise<void>
	readonly setThemePreference: (preference: ThemePreference) => Promise<void>
	readonly recordGameplayStats: (input: {
		readonly pairs?: number
		readonly appends?: number
		readonly hints?: number
		readonly undos?: number
	}) => Promise<void>
	readonly evaluateAndNotifyAchievements: () => AchievementNotifyContext
	readonly achievementToastQueue: readonly string[]
	readonly pushAchievementToasts: (ids: readonly string[]) => void
	readonly dismissAchievementToast: (achievementId: string) => Promise<void>
	readonly resetProgress: () => Promise<void>
	readonly markDevFixtureSession: () => void
	readonly markCampaignSession: () => void
	readonly markDailySession: () => void
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
	const loadingColors = getThemeColors('light')
	const [repository] = useState(() => createRepository(adapter))

	const [hydrateStatus, setHydrateStatus] = useState<HydrateStatus>('pending')
	const [root, setRoot] = useState<PersistedRootV3>(createDefaultRoot)
	const [initialRoute, setInitialRoute] = useState<AppRouteName>('home')
	const [sessionSource, setSessionSource] =
		useState<SessionLaunchSource>('none')
	const [achievementToastQueue, setAchievementToastQueue] = useState<
		readonly string[]
	>([])
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
				const todayKey = currentLocalDateKey()
				const afterStale = await repository.discardStaleDailyActiveIfDateChanged(
					todayKey,
				)
				setRoot(afterStale)
				if (!initialRouteLocked.current) {
					initialRouteLocked.current = true
					setInitialRoute(
						hydrated.trainingCompleted ? 'home' : 'training',
					)
				}
				if (afterStale.activeSession) {
					setSessionSource('campaign')
				} else if (afterStale.daily.activeDaily) {
					setSessionSource('daily')
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

	// Re-evaluate local calendar on foreground — discard unfinished stale Daily.
	useEffect(() => {
		if (hydrateStatus !== 'ready') {
			return
		}
		const onChange = (state: string) => {
			if (state !== 'active') {
				return
			}
			const todayKey = currentLocalDateKey()
			void (async () => {
				const next = await repository.discardStaleDailyActiveIfDateChanged(
					todayKey,
				)
				setRoot(next)
				if (
					sessionSource === 'daily' &&
					next.daily.activeDaily?.dateKey !== todayKey
				) {
					setSessionSource('none')
				}
			})()
		}
		const sub = AppState.addEventListener('change', onChange)
		return () => {
			sub.remove()
		}
	}, [hydrateStatus, repository, sessionSource])

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
				freeHintConsumed: false,
				freeUndoConsumed: false,
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
		): Promise<PersistedRootV3 | null> => {
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
					freeHintConsumed: session.freeHintConsumed,
					freeUndoConsumed: session.freeUndoConsumed,
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
		): Promise<PersistedRootV3 | null> => {
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
					freeHintConsumed: session.freeHintConsumed,
					freeUndoConsumed: session.freeUndoConsumed,
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

	const startDailyPuzzle = useCallback(async (): Promise<StartDailyPuzzleResult> => {
		const todayKey = currentLocalDateKey()
		await repository.discardStaleDailyActiveIfDateChanged(todayKey)
		const generated = createDailyPuzzle(todayKey)
		if (!generated.ok) {
			return { ok: false, reason: generated.reason }
		}
		const session = buildDailyActiveSession({
			dateKey: todayKey,
			seed: generated.seed,
			profile: generated.profile,
			fingerprint: generated.fingerprint,
			density: generated.density,
			board: generated.board,
			initialBoard: generated.board,
			history: [],
			counters: {
				matchesRemoved: 0,
				appendActions: 0,
				undoActions: 0,
			},
			generationVersion: generated.generationVersion,
			usedHint: false,
			usedUndo: false,
			freeHintConsumed: false,
			freeUndoConsumed: false,
		})
		const next = await repository.setActiveDailySession(session)
		setRoot(next)
		setSessionSource('daily')
		return {
			ok: true,
			dateKey: todayKey,
			identity: dailyIdentity(todayKey, {
				seed: generated.seed,
				profile: generated.profile,
				fingerprint: generated.fingerprint,
			}),
			board: generated.board,
		}
	}, [repository])

	const syncDailyFromGameplay = useCallback(
		async (session: GameSessionState) => {
			if (sessionSource !== 'daily') {
				return
			}
			const active = repository.getRoot().daily.activeDaily
			if (!active) {
				return
			}
			const next = await repository.syncDailyGameplay({
				board: session.board,
				history: session.history,
				counters: session.counters,
				usedHint: session.usedHint,
				usedUndo: session.usedUndo,
				freeHintConsumed: session.freeHintConsumed,
				freeUndoConsumed: session.freeUndoConsumed,
			})
			setRoot(next)
		},
		[repository, sessionSource],
	)

	const recordGameplayStats = useCallback(
		async (input: {
			readonly pairs?: number
			readonly appends?: number
			readonly hints?: number
			readonly undos?: number
		}) => {
			if (
				(input.pairs ?? 0) === 0 &&
				(input.appends ?? 0) === 0 &&
				(input.hints ?? 0) === 0 &&
				(input.undos ?? 0) === 0
			) {
				return
			}
			const next = await repository.bumpStatistics({
				pairs: input.pairs,
				appends: input.appends,
				hints: input.hints,
				undos: input.undos,
			})
			setRoot(next)
		},
		[repository],
	)

	const commitDailyCompletion = useCallback(
		async (
			session: GameSessionState,
		): Promise<AchievementNotifyContext | null> => {
			if (completionInFlight.current || sessionSource !== 'daily') {
				return null
			}
			const active = repository.getRoot().daily.activeDaily
			if (!active) {
				return null
			}
			// Device-local calendar is authoritative — never complete yesterday.
			const todayKey = currentLocalDateKey()
			if (active.dateKey !== todayKey) {
				const next = await repository.discardStaleDailyActiveIfDateChanged(
					todayKey,
				)
				setRoot(next)
				setSessionSource('none')
				return null
			}
			completionInFlight.current = true
			try {
				const stars = starsFromAttempt({
					usedHint: session.usedHint,
					usedUndo: session.usedUndo,
				})
				let next = await repository.commitDailyCompletion({
					dateKey: active.dateKey,
					stars,
					counters: session.counters,
					usedHint: session.usedHint,
					usedUndo: session.usedUndo,
					freeHintConsumed: session.freeHintConsumed,
					freeUndoConsumed: session.freeUndoConsumed,
				})
				// Lifetime counters are incremented during play via recordGameplayStats —
				// do not re-add session totals here (would double-count).
				setRoot(next)
				const unlocks = evaluateAchievementUnlocks(next)
				setSessionSource('none')
				return {
					...unlocks,
					dailyStreakAfter: getActiveCurrentStreak(next.daily, active.dateKey),
				}
			} finally {
				completionInFlight.current = false
			}
		},
		[repository, sessionSource],
	)

	const buildRestoredDailySession = useCallback((): GameSessionState | null => {
		// Prefer authoritative hydrated root (not a stale React snapshot).
		const active = repository.isHydrated()
			? repository.getRoot().daily.activeDaily
			: root.daily.activeDaily
		if (!active) {
			return null
		}
		const state = gameSessionFromPersistedDaily(active)
		if (!state) {
			return null
		}
		return { ...state, undoAfterCompletion: false }
	}, [repository, root.daily.activeDaily])

	const getDailySummary = useCallback(
		(todayKey: LocalDateKey): DailySummary => {
			const daily = root.daily
			const todayEntry = daily.history.find((row) => row.dateKey === todayKey)
			return {
				dateKey: todayKey,
				completedToday: isDailyCompletedOn(daily, todayKey),
				bestStarsToday: todayEntry?.bestStars ?? 0,
				activeStreak: getActiveCurrentStreak(daily, todayKey),
				bestStreak: daily.bestStreak,
				hasActiveSession: daily.activeDaily?.dateKey === todayKey,
			}
		},
		[root.daily],
	)

	const discardStaleDailyIfDateChanged = useCallback(
		async (todayKey: LocalDateKey) => {
			const next = await repository.discardStaleDailyActiveIfDateChanged(
				todayKey,
			)
			setRoot(next)
			// If we were mid-Daily and day rolled over, clear runtime source.
			if (
				sessionSource === 'daily' &&
				next.daily.activeDaily?.dateKey !== todayKey
			) {
				setSessionSource('none')
			}
		},
		[repository, sessionSource],
	)

	const setThemePreference = useCallback(
		async (preference: ThemePreference) => {
			const next = await repository.setThemePreference(preference)
			setRoot(next)
		},
		[repository],
	)

	const evaluateAndNotifyAchievements = useCallback((): AchievementNotifyContext => {
		return evaluateAchievementUnlocks(repository.getRoot())
	}, [repository])

	const pushAchievementToasts = useCallback((ids: readonly string[]) => {
		if (ids.length === 0) {
			return
		}
		setAchievementToastQueue((prev) => {
			const merged = new Set(prev)
			for (const id of ids) {
				merged.add(id)
			}
			return [...merged]
		})
	}, [])

	const dismissAchievementToast = useCallback(
		async (achievementId: string) => {
			trackEvent('achievement_unlocked', { achievementId })
			const next = await repository.markAchievementsNotified([achievementId])
			setRoot(next)
			setAchievementToastQueue((prev) =>
				prev.filter((id) => id !== achievementId),
			)
		},
		[repository],
	)

	const clearActiveSession = useCallback(async () => {
		const next = await repository.clearActiveSession()
		setRoot(next)
		if (sessionSource === 'campaign') {
			setSessionSource('none')
		}
	}, [repository, sessionSource])

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
				freeHintConsumed: session.freeHintConsumed,
				freeUndoConsumed: session.freeUndoConsumed,
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

	const markDailySession = useCallback(() => {
		setSessionSource('daily')
	}, [])

	const clearSessionSource = useCallback(() => {
		setSessionSource('none')
	}, [])

	const buildRestoredGameSession = useCallback((): GameSessionState | null => {
		const active = repository.isHydrated()
			? repository.getRoot().activeSession
			: root.activeSession
		if (!active) {
			return null
		}
		const state = gameSessionFromPersisted(active)
		if (!state) {
			return null
		}
		return { ...state, undoAfterCompletion: false }
	}, [repository, root.activeSession])

	const value = useMemo<AppStateContextValue>(
		() => ({
			hydrateStatus,
			initialRoute,
			root,
			trainingCompleted: root.trainingCompleted,
			highestCompletedLevel: root.highestCompletedLevel,
			activeSession: root.activeSession,
			daily: root.daily,
			statistics: root.statistics,
			themePreference: root.settings.themePreference,
			bestStars: root.bestStars,
			totalStars: totalStars(root.bestStars),
			sessionSource,
			repository,
			completeTraining,
			startCampaignLevel,
			startDailyPuzzle,
			commitProgressionCompletion,
			commitReplayCompletion,
			syncDailyFromGameplay,
			commitDailyCompletion,
			buildRestoredDailySession,
			getDailySummary,
			discardStaleDailyIfDateChanged,
			clearActiveSession,
			syncSessionFromGameplay,
			setThemePreference,
			recordGameplayStats,
			evaluateAndNotifyAchievements,
			achievementToastQueue,
			pushAchievementToasts,
			dismissAchievementToast,
			resetProgress,
			markDevFixtureSession,
			markCampaignSession,
			markDailySession,
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
			startDailyPuzzle,
			commitProgressionCompletion,
			commitReplayCompletion,
			syncDailyFromGameplay,
			commitDailyCompletion,
			buildRestoredDailySession,
			getDailySummary,
			discardStaleDailyIfDateChanged,
			clearActiveSession,
			syncSessionFromGameplay,
			setThemePreference,
			recordGameplayStats,
			evaluateAndNotifyAchievements,
			achievementToastQueue,
			pushAchievementToasts,
			dismissAchievementToast,
			resetProgress,
			markDevFixtureSession,
			markCampaignSession,
			markDailySession,
			clearSessionSource,
			buildRestoredGameSession,
		],
	)

	if (hydrateStatus === 'pending') {
		return (
			<View
				style={[
					styles.loading,
					{ backgroundColor: loadingColors.background },
				]}
				testID="app-loading"
				accessibilityLabel={strings.loading}
			>
				<ActivityIndicator color={loadingColors.accent} />
				<Text
					style={[styles.loadingText, { color: loadingColors.textMuted }]}
				>
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
export function formatDevDiagnostics(root: PersistedRootV3): string {
	const level = root.activeSession?.level ?? '—'
	const dailyDate = root.daily.activeDaily?.dateKey ?? '—'
	return (
		`schema ${root.schemaVersion} · campaign v${CAMPAIGN_VERSION} ` +
		`· level ${level} · daily ${dailyDate} · rev ${root.revision}`
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
