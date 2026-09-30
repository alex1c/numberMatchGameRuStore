/**
 * Production Game screen (PHASE 5 campaign flow + Campaign v2 stars).
 * Layout: SAFE TOP → HEADER → META → BOARD → STATUS → CONTROLS
 * BannerSlot is owned by AppShell below this screen (above bottom inset).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
	Alert,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'

import { useAppState } from '../app'
import { CAMPAIGN_LEVEL_COUNT } from '../game/campaign'
import { DENSITY_FIXTURES, loadDensityFixture } from '../dev/density'
import { CompletionOverlay } from '../components/game/CompletionOverlay'
import { GameControls } from '../components/game/GameControls'
import { GameHeader } from '../components/game/GameHeader'
import { NumberBoard } from '../components/game/NumberBoard'
import { strings } from '../i18n/strings.ru'
import { starsFromAttempt } from '../game/stars'
import { useGameSession } from '../game/session/GameSessionContext'
import { spacing, typography, useTheme } from '../theme'

interface GameScreenProps {
	readonly onHome: () => void
	readonly onTraining: () => void
	/** Replace top route with game (Next / Replay stay on one Game screen). */
	readonly onReplaceGame?: () => void
	/** DEV Density Lab return — only used for density fixtures. */
	readonly onDensityLab?: () => void
}

/**
 * DEV-only geometry experiment flag — production Game uses AppShell BannerSlot.
 */
const DEV_SHOW_COORDS_DEFAULT = false

export function GameScreen({
	onHome,
	onTraining,
	onReplaceGame,
	onDensityLab,
}: GameScreenProps) {
	const theme = useTheme()
	const {
		session,
		dispatch,
		requestHint,
		isDirty,
		startSession,
	} = useGameSession()
	const {
		activeSession,
		sessionSource,
		syncSessionFromGameplay,
		commitProgressionCompletion,
		commitReplayCompletion,
		startCampaignLevel,
	} = useAppState()

	const [dismissedCompletionKey, setDismissedCompletionKey] = useState<
		string | null
	>(null)
	const [scrollToEndToken, setScrollToEndToken] = useState(0)
	const [showDevCoords, setShowDevCoords] = useState(DEV_SHOW_COORDS_DEFAULT)
	const [nextBusy, setNextBusy] = useState(false)
	const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const completionCommitted = useRef<string | null>(null)
	const lastSyncedKey = useRef<string | null>(null)
	const nextGuard = useRef(false)

	const isCampaign = sessionSource === 'campaign' && activeSession !== null
	const campaignLevel = activeSession?.level ?? null
	const campaignPurpose = activeSession?.purpose ?? null
	const densityMeta =
		sessionSource === 'dev_fixture'
			? DENSITY_FIXTURES.find(
					(f) => f.fingerprint === session?.identity.fingerprint,
				)
			: undefined
	const isDensityLab = Boolean(densityMeta)

	useEffect(() => {
		return () => {
			if (feedbackTimer.current) {
				clearTimeout(feedbackTimer.current)
			}
			if (hintTimer.current) {
				clearTimeout(hintTimer.current)
			}
		}
	}, [])

	// Clear brief invalid tint.
	useEffect(() => {
		if (!session || session.invalidIndices.length === 0) {
			return
		}
		if (feedbackTimer.current) {
			clearTimeout(feedbackTimer.current)
		}
		feedbackTimer.current = setTimeout(() => {
			dispatch({ type: 'CLEAR_FEEDBACK' })
		}, 220)
	}, [session?.invalidIndices, dispatch, session])

	// Clear hint highlight after a short reveal.
	useEffect(() => {
		if (!session || session.hintIndices.length === 0) {
			return
		}
		if (hintTimer.current) {
			clearTimeout(hintTimer.current)
		}
		hintTimer.current = setTimeout(() => {
			dispatch({ type: 'CLEAR_HINT' })
		}, 1600)
	}, [session?.hintIndices, dispatch, session])

	// Sync meaningful gameplay to persistence (not SELECT_CELL-only).
	useEffect(() => {
		if (!session || !isCampaign) {
			return
		}
		const key = [
			session.board.nextCellSeq,
			session.board.cells.filter((c) => c.removed).length,
			session.history.length,
			session.counters.matchesRemoved,
			session.counters.appendActions,
			session.counters.undoActions,
			session.completed ? '1' : '0',
		].join(':')
		if (key === lastSyncedKey.current) {
			return
		}
		// Skip pristine fresh start (nothing to persist beyond initial write).
		if (
			session.history.length === 0 &&
			session.counters.matchesRemoved === 0 &&
			session.counters.appendActions === 0 &&
			!session.completed
		) {
			lastSyncedKey.current = key
			return
		}
		lastSyncedKey.current = key
		void syncSessionFromGameplay(session)
	}, [isCampaign, session, syncSessionFromGameplay])

	// Commit campaign completion once (idempotent).
	useEffect(() => {
		if (!session?.completed || !isCampaign || !campaignLevel) {
			return
		}
		const commitKey = `${campaignPurpose}:${campaignLevel}:${session.identity.fingerprint}`
		if (completionCommitted.current === commitKey) {
			return
		}
		completionCommitted.current = commitKey
		if (campaignPurpose === 'progression') {
			void commitProgressionCompletion(campaignLevel, session)
		} else if (campaignPurpose === 'replay') {
			void commitReplayCompletion(campaignLevel, session)
		}
	}, [
		campaignLevel,
		campaignPurpose,
		commitProgressionCompletion,
		commitReplayCompletion,
		isCampaign,
		session,
	])

	const confirmRestart = useCallback(() => {
		if (!session) {
			return
		}
		// After campaign completion — no restart-loss warning; restart still allowed
		// from menu only while in_progress. Overlay hides restart for campaign done.
		if (session.completed && isCampaign) {
			return
		}
		if (!isDirty && session.history.length === 0) {
			dispatch({ type: 'RESTART' })
			return
		}
		Alert.alert(strings.restartConfirmTitle, strings.restartConfirmBody, [
			{ text: strings.cancel, style: 'cancel' },
			{
				text: strings.restartConfirmOk,
				style: 'destructive',
				onPress: () => dispatch({ type: 'RESTART' }),
			},
		])
	}, [dispatch, isCampaign, isDirty, session])

	const handleAppend = useCallback(() => {
		dispatch({ type: 'APPEND' })
		setScrollToEndToken((n) => n + 1)
	}, [dispatch])

	const handleCellPress = useCallback(
		(index: number) => {
			dispatch({ type: 'SELECT_CELL', index })
		},
		[dispatch],
	)

	const handleNext = useCallback(async () => {
		if (nextGuard.current || nextBusy || !campaignLevel || !session) {
			return
		}
		nextGuard.current = true
		setNextBusy(true)
		try {
			// Ensure progression commit finished before unlocking N+1 (idempotent).
			await commitProgressionCompletion(campaignLevel, session)
			const nextLevel = campaignLevel + 1
			if (nextLevel > CAMPAIGN_LEVEL_COUNT) {
				onHome()
				return
			}
			const result = await startCampaignLevel(nextLevel, 'progression')
			if (!result.ok || !result.identity || !result.board) {
				Alert.alert(strings.errorTitle, result.reason ?? strings.errorGeneric)
				return
			}
			completionCommitted.current = null
			lastSyncedKey.current = null
			setDismissedCompletionKey(null)
			startSession(result.identity, result.board, {
				undoAfterCompletion: false,
			})
			onReplaceGame?.()
		} finally {
			setNextBusy(false)
			nextGuard.current = false
		}
	}, [
		campaignLevel,
		commitProgressionCompletion,
		nextBusy,
		onHome,
		onReplaceGame,
		session,
		startCampaignLevel,
		startSession,
	])

	const handleReplay = useCallback(async () => {
		if (nextGuard.current) {
			return
		}
		if (isDensityLab && densityMeta) {
			nextGuard.current = true
			try {
				const loaded = loadDensityFixture(densityMeta.id)
				if (!loaded.ok) {
					Alert.alert(strings.errorTitle, loaded.error)
					return
				}
				completionCommitted.current = null
				lastSyncedKey.current = null
				setDismissedCompletionKey(null)
				startSession(loaded.identity, loaded.board)
				onReplaceGame?.()
			} finally {
				nextGuard.current = false
			}
			return
		}
		if (!campaignLevel) {
			return
		}
		nextGuard.current = true
		try {
			const result = await startCampaignLevel(campaignLevel, 'replay')
			if (!result.ok || !result.identity || !result.board) {
				Alert.alert(strings.errorTitle, result.reason ?? strings.errorGeneric)
				return
			}
			completionCommitted.current = null
			lastSyncedKey.current = null
			setDismissedCompletionKey(null)
			startSession(result.identity, result.board, {
				undoAfterCompletion: false,
			})
			onReplaceGame?.()
		} finally {
			nextGuard.current = false
		}
	}, [
		campaignLevel,
		densityMeta,
		isDensityLab,
		onReplaceGame,
		startCampaignLevel,
		startSession,
	])

	if (!session) {
		return (
			<View
				style={[styles.root, { backgroundColor: theme.colors.background }]}
				testID="game-empty"
			>
				<Text style={{ color: theme.colors.textMuted }}>
					Нет активной сессии
				</Text>
				<Pressable onPress={onHome} accessibilityRole="button">
					<Text style={{ color: theme.colors.accent }}>{strings.home}</Text>
				</Pressable>
			</View>
		)
	}

	const statusText = resolveStatus(session)
	const appendEnabled =
		!session.completed &&
		!session.hasAvailableMoves &&
		session.board.cells.some((c) => !c.removed)
	const completionKey = session.completed
		? `${session.identity.fingerprint}:${session.counters.matchesRemoved}:${session.counters.undoActions}`
		: null
	const showCompletion =
		completionKey !== null && completionKey !== dismissedCompletionKey

	const undoAllowedAfterCompletion =
		session.undoAfterCompletion !== false && !isCampaign

	const headerTitle = isCampaign && campaignLevel
		? strings.levelHeader(campaignLevel)
		: isDensityLab && densityMeta
			? densityMeta.label
			: strings.appName
	// Campaign: level + optional difficulty only — never seed/fingerprint.
	const headerSubtitle = isCampaign
		? strings.profileLabel(session.identity.profile)
		: isDensityLab
			? session.identity.label
			: session.identity.label

	const showNext =
		isCampaign &&
		campaignPurpose === 'progression' &&
		campaignLevel !== null &&
		campaignLevel < CAMPAIGN_LEVEL_COUNT &&
		session.completed

	const completionTitle =
		isCampaign && campaignLevel
			? strings.levelCompletedTitle(campaignLevel)
			: strings.completedTitle

	const completionMode = !isCampaign
		? 'dev'
		: campaignPurpose === 'replay'
			? 'campaign_replay'
			: 'campaign_progression'

	const completionHome = () => {
		if (isDensityLab && onDensityLab) {
			onDensityLab()
			return
		}
		onHome()
	}

	return (
		<View
			style={[styles.root, { backgroundColor: theme.colors.background }]}
			testID="game-screen"
		>
			<GameHeader
				title={headerTitle}
				subtitle={headerSubtitle}
				onBack={onHome}
				onRestart={confirmRestart}
				onRules={onTraining}
				onHome={onHome}
			/>

			{__DEV__ ? (
				<View style={styles.meta} testID="game-dev-meta">
					<Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
						{session.identity.profile} · seed {session.identity.seed}
						{` · fp ${session.identity.fingerprint}`}
						{` · ${session.counters.matchesRemoved}п/${session.counters.appendActions}+`}
					</Text>
				</View>
			) : null}

			<NumberBoard
				board={session.board}
				selectedIndex={session.selectedIndex}
				invalidIndices={session.invalidIndices}
				hintIndices={session.hintIndices}
				onCellPress={handleCellPress}
				interactionLocked={session.interactionLocked || session.hintBusy}
				scrollToEndToken={scrollToEndToken}
				showDevCoords={__DEV__ && showDevCoords}
			/>

			<Text
				style={[styles.status, { color: theme.colors.textMuted }]}
				testID="game-status"
			>
				{statusText}
			</Text>

			{!session.completed ? (
				<GameControls
					canUndo={session.history.length > 0}
					canAppend={appendEnabled}
					appendPrimary={appendEnabled}
					canHint={true}
					hintBusy={session.hintBusy}
					onUndo={() => dispatch({ type: 'UNDO' })}
					onAppend={handleAppend}
					onHint={requestHint}
				/>
			) : null}

			{__DEV__ ? (
				<Pressable
					onPress={() => setShowDevCoords((v) => !v)}
					style={styles.devToggle}
					testID="dev-coords-toggle"
				>
					<Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
						DEV coords {showDevCoords ? 'ON' : 'OFF'}
					</Text>
				</Pressable>
			) : null}

			<CompletionOverlay
				visible={showCompletion}
				title={completionTitle}
				body={
					isCampaign
						? strings.levelCompletedTitle(campaignLevel ?? 0)
						: strings.completedBody
				}
				counters={session.counters}
				mode={completionMode}
				attemptStars={
					isCampaign
						? starsFromAttempt({
								usedHint: session.usedHint,
								usedUndo: session.usedUndo,
							})
						: undefined
				}
				usedHint={session.usedHint}
				usedUndo={session.usedUndo}
				showNext={showNext}
				nextLabel={
					campaignLevel === CAMPAIGN_LEVEL_COUNT
						? strings.campaignComplete
						: strings.nextLevel
				}
				nextBusy={nextBusy}
				onNext={showNext ? () => void handleNext() : undefined}
				onReplay={
					isCampaign || isDensityLab
						? () => void handleReplay()
						: undefined
				}
				onHome={completionHome}
				homeLabel={
					isDensityLab ? strings.densityLabBack : undefined
				}
				onClose={() => {
					if (completionKey) {
						setDismissedCompletionKey(completionKey)
					}
				}}
				canUndo={
					undoAllowedAfterCompletion && session.history.length > 0
				}
				onUndo={() => dispatch({ type: 'UNDO' })}
				showRestart={!isCampaign && !isDensityLab}
				onRestart={confirmRestart}
			/>
		</View>
	)
}

function resolveStatus(
	session: NonNullable<ReturnType<typeof useGameSession>['session']>,
): string {
	if (session.statusMessage === 'cleared' || session.completed) {
		return strings.statusCleared
	}
	if (session.hintBusy) {
		return strings.hintBusy
	}
	if (session.statusMessage === strings.hintAppend) {
		return strings.hintAppend
	}
	if (session.statusMessage === strings.hintUnavailable) {
		return strings.hintUnavailable
	}
	if (session.statusMessage === strings.hintReady) {
		return strings.hintReady
	}
	if (
		!session.hasAvailableMoves &&
		!session.completed &&
		session.board.cells.some((c) => !c.removed)
	) {
		return strings.statusStuck
	}
	if (session.selectedIndex !== null) {
		return strings.statusSelectSecond
	}
	return strings.statusSelect
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	meta: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
	},
	metaText: {
		...typography.caption,
		textAlign: 'center',
	},
	status: {
		...typography.caption,
		textAlign: 'center',
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
		minHeight: 22,
	},
	devToggle: {
		alignItems: 'center',
		paddingBottom: 2,
	},
})
