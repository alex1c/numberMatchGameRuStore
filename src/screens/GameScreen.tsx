/**
 * Production Game screen (PHASE 5 campaign flow + Campaign v2 stars + monetization).
 * Layout: SAFE TOP → HEADER → META → BOARD → STATUS → CONTROLS
 * BannerSlot is owned by AppShell below this screen (above bottom inset).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
	Alert,
	AppState,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'

import { evaluateAchievementUnlocks, useAppState } from '../app'
import {
	currentLocalDateKey,
	formatLocalDateRu,
	type LocalDateKey,
} from '../daily'
import {
	cancelActiveInterstitialTransition,
	maybeShowInterstitialAtTransition,
	notifyCampaignLevelCompleted,
	notifyCampaignLevelStarted,
	requestRewarded,
} from '../ads'
import { trackEvent } from '../analytics'
import { CAMPAIGN_LEVEL_COUNT, CAMPAIGN_VERSION } from '../game/campaign'
import { DENSITY_FIXTURES, loadDensityFixture } from '../dev/density'
import { isScreenshotQaMode } from '../dev/screenshotQaMode'
import { CompletionOverlay } from '../components/game/CompletionOverlay'
import { GameControls } from '../components/game/GameControls'
import { GameHeader } from '../components/game/GameHeader'
import { NumberBoard } from '../components/game/NumberBoard'
import {
	decideHelpEntitlement,
	isHelpMonetized,
	type HelpSource,
} from '../game/helpPolicy'
import { strings } from '../i18n/strings.ru'
import { GENERATION_VERSION } from '../game/generator'
import { starsFromAttempt, type StarCount } from '../game/stars'
import { useGameSession } from '../game/session/GameSessionContext'
import type { HintOutcome } from '../game/session/hintRequest'
import { spacing, typography, useTheme } from '../theme'
import {
	beginTransition,
	bumpScreenGeneration,
	cancelActiveTransition,
	createInitialTransitionGuardState,
	invalidateScreen,
	isTransitionAlive,
	syncAttemptId,
	type TransitionGuardState,
} from './gameTransitionGuard'
import type { TransitionToken } from '../game/session/attemptIdentity'

/** Immutable presentation data captured at Daily completion (survives activeDaily clear). */
interface DailyCompletionSnapshot {
	readonly dateKey: LocalDateKey
	readonly fingerprint: string
	readonly attemptStars: StarCount
	readonly usedHint: boolean
	readonly usedUndo: boolean
	readonly streakAfter: number
}

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

function hintResultParam(outcome: HintOutcome): string {
	if (outcome.kind === 'match') {
		return 'match'
	}
	if (outcome.kind === 'append') {
		return 'add_guidance'
	}
	return 'unavailable'
}

function boardRowCount(cellCount: number): number {
	return Math.ceil(cellCount / 8)
}

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
		attemptId,
		getAttemptId,
	} = useGameSession()
	const {
		activeSession,
		daily,
		sessionSource,
		bestStars,
		syncSessionFromGameplay,
		syncDailyFromGameplay,
		commitProgressionCompletion,
		commitReplayCompletion,
		commitDailyCompletion,
		startCampaignLevel,
		startDailyPuzzle,
		getDailySummary,
		pushAchievementToasts,
		recordGameplayStats,
		discardStaleDailyIfDateChanged,
		clearSessionSource,
	} = useAppState()

	const [dismissedCompletionKey, setDismissedCompletionKey] = useState<
		string | null
	>(null)
	const [scrollToEndToken, setScrollToEndToken] = useState(0)
	const [showDevCoords, setShowDevCoords] = useState(DEV_SHOW_COORDS_DEFAULT)
	const [nextBusy, setNextBusy] = useState(false)
	const [helpAdBusy, setHelpAdBusy] = useState(false)
	/** Survives activeDaily clear so Daily completion overlay keeps mode/stars/streak. */
	const [dailyCompletionSnapshot, setDailyCompletionSnapshot] =
		useState<DailyCompletionSnapshot | null>(null)
	const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const completionCommitted = useRef<string | null>(null)
	const levelStartedKey = useRef<string | null>(null)
	const levelCompletedAnalyticsKey = useRef<string | null>(null)
	const lastSyncedKey = useRef<string | null>(null)
	const nextGuard = useRef(false)
	const rewardedGuard = useRef(false)
	/** Track counter deltas so lifetime statistics increment once per action. */
	const lastStatsCounters = useRef({
		matches: 0,
		appends: 0,
		undos: 0,
		hints: 0,
	})
	/** Fingerprint whose counters already seeded the stats baseline (no double-count). */
	const statsBaselineKey = useRef<string | null>(null)
	/** Latest session for rewarded callbacks (avoids stale closures). */
	const sessionLiveRef = useRef(session)
	/** Screen + transition guard — invalidated on unmount / Restart / new attempt. */
	const transitionGuardRef = useRef<TransitionGuardState>(
		createInitialTransitionGuardState(),
	)
	const rewardedAttemptRef = useRef<number | null>(null)

	/** Centralized cleanup for rewarded UI chrome (never leaves Загрузка stuck). */
	const finalizeRewardedUi = useCallback(() => {
		setHelpAdBusy(false)
		rewardedGuard.current = false
	}, [])

	useEffect(() => {
		sessionLiveRef.current = session
	}, [session])

	useEffect(() => {
		syncAttemptId(transitionGuardRef.current, attemptId)
		// New attempt invalidates pending Next/Home transitions + interstitial.
		cancelActiveTransition(transitionGuardRef.current)
		cancelActiveInterstitialTransition()
		rewardedAttemptRef.current = null
		rewardedGuard.current = false
		// Clear ad chrome asynchronously — avoid sync setState in effect body.
		const clearBusy = setTimeout(() => {
			setHelpAdBusy(false)
		}, 0)
		return () => {
			clearTimeout(clearBusy)
		}
	}, [attemptId])

	useEffect(() => {
		const guard = transitionGuardRef.current
		bumpScreenGeneration(guard)
		syncAttemptId(guard, getAttemptId())
		return () => {
			invalidateScreen(guard)
			cancelActiveTransition(guard)
			cancelActiveInterstitialTransition()
			rewardedAttemptRef.current = null
			rewardedGuard.current = false
		}
		// Mount / unmount only.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const isCampaign = sessionSource === 'campaign' && activeSession !== null
	const isDaily = sessionSource === 'daily' && daily.activeDaily !== null
	/** Completion UI may still be Daily after persisted activeDaily was cleared. */
	const isDailyCompletion =
		dailyCompletionSnapshot !== null && session?.completed === true
	const showingAsDaily = isDaily || isDailyCompletion
	const dailyDateKey =
		daily.activeDaily?.dateKey ?? dailyCompletionSnapshot?.dateKey ?? null
	const campaignLevel = activeSession?.level ?? null
	const campaignPurpose = activeSession?.purpose ?? null
	const monetized = isHelpMonetized(sessionSource)
	const densityMeta =
		sessionSource === 'dev_fixture'
			? DENSITY_FIXTURES.find(
					(f) => f.fingerprint === session?.identity.fingerprint,
				)
			: undefined
	const isDensityLab = Boolean(densityMeta)

	/**
	 * Active Daily expiry contract — device-local calendar is authority.
	 * Returns false when gameplay must stop (stale day discarded).
	 */
	const ensureDailyCurrent = useCallback((): boolean => {
		if (sessionSource !== 'daily') {
			return true
		}
		const today = currentLocalDateKey()
		const activeDate = daily.activeDaily?.dateKey
		if (!activeDate || activeDate === today) {
			return true
		}
		void (async () => {
			await discardStaleDailyIfDateChanged(today)
			clearSessionSource()
			setDailyCompletionSnapshot(null)
			finalizeRewardedUi()
			cancelActiveInterstitialTransition()
			cancelActiveTransition(transitionGuardRef.current)
			Alert.alert(strings.dailyExpiredTitle, strings.dailyExpiredBody, [
				{
					text: strings.dailyExpiredOpenToday,
					onPress: () => {
						onHome()
					},
				},
			])
		})()
		return false
	}, [
		clearSessionSource,
		daily.activeDaily?.dateKey,
		discardStaleDailyIfDateChanged,
		finalizeRewardedUi,
		onHome,
		sessionSource,
	])

	// Local-date authority while Daily Game is open — discard stale mid-session.
	useEffect(() => {
		if (sessionSource !== 'daily') {
			return
		}
		const revalidate = () => {
			ensureDailyCurrent()
		}
		revalidate()
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') {
				revalidate()
			}
		})
		return () => {
			sub.remove()
		}
	}, [ensureDailyCurrent, sessionSource])

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

	// Campaign level_started + interstitial suppression clear (once per attempt).
	useEffect(() => {
		if (!session || !isCampaign || campaignLevel === null) {
			return
		}
		const key = `${campaignPurpose}:${campaignLevel}:${session.identity.fingerprint}`
		if (levelStartedKey.current === key) {
			return
		}
		levelStartedKey.current = key
		notifyCampaignLevelStarted()
		trackEvent('level_started', {
			level: campaignLevel,
			difficulty: session.identity.profile,
			initialRows: boardRowCount(session.initialBoard.cells.length),
			purpose: campaignPurpose === 'replay' ? 'replay' : 'progression',
			campaignVersion: CAMPAIGN_VERSION,
			generationVersion: GENERATION_VERSION,
		})
	}, [campaignLevel, campaignPurpose, isCampaign, session])

	// Daily puzzle_started analytics (once per attempt).
	useEffect(() => {
		if (!session || !isDaily || !dailyDateKey) {
			return
		}
		const key = `daily:${dailyDateKey}:${session.identity.fingerprint}`
		if (levelStartedKey.current === key) {
			return
		}
		levelStartedKey.current = key
		trackEvent('daily_started', {
			dateKey: dailyDateKey,
			difficulty: session.identity.profile,
		})
	}, [dailyDateKey, isDaily, session])

	// Lifetime statistics — pairs / appends / undos from counter deltas.
	// Bootstrap + counter regression (Restart / restore) set baseline without counting.
	useEffect(() => {
		if (!session || (!isCampaign && !isDaily)) {
			return
		}
		const prev = lastStatsCounters.current
		const regress =
			session.counters.matchesRemoved < prev.matches ||
			session.counters.appendActions < prev.appends ||
			session.counters.undoActions < prev.undos
		const needsBootstrap =
			statsBaselineKey.current !== session.identity.fingerprint

		if (needsBootstrap || regress) {
			statsBaselineKey.current = session.identity.fingerprint
			lastStatsCounters.current = {
				matches: session.counters.matchesRemoved,
				appends: session.counters.appendActions,
				undos: session.counters.undoActions,
				hints: 0,
			}
			return
		}

		const pairs = Math.max(0, session.counters.matchesRemoved - prev.matches)
		const appends = Math.max(0, session.counters.appendActions - prev.appends)
		const undos = Math.max(0, session.counters.undoActions - prev.undos)
		lastStatsCounters.current = {
			matches: session.counters.matchesRemoved,
			appends: session.counters.appendActions,
			undos: session.counters.undoActions,
			hints: prev.hints,
		}
		if (pairs > 0 || appends > 0 || undos > 0) {
			void recordGameplayStats({
				pairs: pairs > 0 ? pairs : undefined,
				appends: appends > 0 ? appends : undefined,
				undos: undos > 0 ? undos : undefined,
			})
		}
	}, [isCampaign, isDaily, recordGameplayStats, session])

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
			// Help flags must sync even when the board looks pristine (Restart).
			session.usedHint ? '1' : '0',
			session.usedUndo ? '1' : '0',
			session.freeHintConsumed ? '1' : '0',
			session.freeUndoConsumed ? '1' : '0',
		].join(':')
		if (key === lastSyncedKey.current) {
			return
		}
		const boardPristine =
			session.history.length === 0 &&
			session.counters.matchesRemoved === 0 &&
			session.counters.appendActions === 0 &&
			!session.completed
		const helpPristine =
			!session.usedHint &&
			!session.usedUndo &&
			!session.freeHintConsumed &&
			!session.freeUndoConsumed
		// Skip only when board AND help are pristine AND disk already matches.
		// After Restart, help flags clear while disk may still hold consumed
		// entitlement — that must sync (key differs via help bits, or dirty disk).
		if (boardPristine && helpPristine) {
			const persisted = activeSession
			const diskDirty =
				persisted != null &&
				(persisted.usedHint ||
					persisted.usedUndo ||
					persisted.freeHintConsumed ||
					persisted.freeUndoConsumed ||
					persisted.history.length > 0 ||
					persisted.counters.matchesRemoved > 0 ||
					persisted.counters.appendActions > 0 ||
					persisted.counters.undoActions > 0)
			if (!diskDirty) {
				lastSyncedKey.current = key
				return
			}
		}
		lastSyncedKey.current = key
		void syncSessionFromGameplay(session)
	}, [activeSession, isCampaign, session, syncSessionFromGameplay])

	// Sync daily gameplay to persistence (include help entitlement bits).
	useEffect(() => {
		if (!session || !isDaily) {
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
			session.usedHint ? '1' : '0',
			session.usedUndo ? '1' : '0',
			session.freeHintConsumed ? '1' : '0',
			session.freeUndoConsumed ? '1' : '0',
		].join(':')
		if (key === lastSyncedKey.current) {
			return
		}
		const boardPristine =
			session.history.length === 0 &&
			session.counters.matchesRemoved === 0 &&
			session.counters.appendActions === 0 &&
			!session.completed
		const helpPristine =
			!session.usedHint &&
			!session.usedUndo &&
			!session.freeHintConsumed &&
			!session.freeUndoConsumed
		if (boardPristine && helpPristine) {
			const persisted = daily.activeDaily
			const diskDirty =
				persisted != null &&
				(persisted.usedHint ||
					persisted.usedUndo ||
					persisted.freeHintConsumed ||
					persisted.freeUndoConsumed ||
					persisted.history.length > 0 ||
					persisted.counters.matchesRemoved > 0 ||
					persisted.counters.appendActions > 0 ||
					persisted.counters.undoActions > 0)
			if (!diskDirty) {
				lastSyncedKey.current = key
				return
			}
		}
		lastSyncedKey.current = key
		void syncDailyFromGameplay(session)
	}, [daily.activeDaily, isDaily, session, syncDailyFromGameplay])

	// Commit campaign completion once (idempotent) + analytics + achievements toast queue.
	useEffect(() => {
		if (!session?.completed || !isCampaign || !campaignLevel) {
			return
		}
		const commitKey = `${campaignPurpose}:${campaignLevel}:${session.identity.fingerprint}`
		if (completionCommitted.current === commitKey) {
			return
		}
		completionCommitted.current = commitKey
		void (async () => {
			let next = null
			if (campaignPurpose === 'progression') {
				next = await commitProgressionCompletion(campaignLevel, session)
			} else if (campaignPurpose === 'replay') {
				next = await commitReplayCompletion(campaignLevel, session)
			}
			if (next) {
				const unlocks = evaluateAchievementUnlocks(next)
				if (unlocks.newUnlockIds.length > 0) {
					pushAchievementToasts(unlocks.newUnlockIds)
				}
			}
			if (levelCompletedAnalyticsKey.current !== commitKey) {
				levelCompletedAnalyticsKey.current = commitKey
				notifyCampaignLevelCompleted()
				const attemptStars = starsFromAttempt({
					usedHint: session.usedHint,
					usedUndo: session.usedUndo,
				})
				const best = bestStars[campaignLevel - 1] ?? 0
				trackEvent('level_completed', {
					level: campaignLevel,
					difficulty: session.identity.profile,
					initialRows: boardRowCount(session.initialBoard.cells.length),
					starsEarnedThisAttempt: attemptStars,
					bestStars: Math.max(best, attemptStars),
					usedHint: session.usedHint,
					usedUndo: session.usedUndo,
					appendCount: session.counters.appendActions,
					campaignVersion: CAMPAIGN_VERSION,
					generationVersion: GENERATION_VERSION,
				})
			}
		})()
	}, [
		bestStars,
		campaignLevel,
		campaignPurpose,
		commitProgressionCompletion,
		commitReplayCompletion,
		isCampaign,
		pushAchievementToasts,
		session,
	])

	// Commit daily completion + analytics + achievement toasts.
	// Snapshot becomes authoritative ONLY after commit accepts today's date.
	useEffect(() => {
		if (!session?.completed || !isDaily || !dailyDateKey) {
			return
		}
		const commitKey = `daily:${dailyDateKey}:${session.identity.fingerprint}`
		if (completionCommitted.current === commitKey) {
			return
		}
		completionCommitted.current = commitKey
		const attemptStars = starsFromAttempt({
			usedHint: session.usedHint,
			usedUndo: session.usedUndo,
		})
		const candidate: DailyCompletionSnapshot = {
			dateKey: dailyDateKey,
			fingerprint: session.identity.fingerprint,
			attemptStars,
			usedHint: session.usedHint,
			usedUndo: session.usedUndo,
			streakAfter: getDailySummary(dailyDateKey).activeStreak,
		}
		void (async () => {
			// Re-check calendar immediately before commit (midnight race).
			const today = currentLocalDateKey()
			if (candidate.dateKey !== today) {
				completionCommitted.current = null
				setDailyCompletionSnapshot(null)
				await discardStaleDailyIfDateChanged(today)
				clearSessionSource()
				Alert.alert(strings.dailyExpiredTitle, strings.dailyExpiredBody, [
					{
						text: strings.dailyExpiredOpenToday,
						onPress: () => {
							onHome()
						},
					},
				])
				return
			}
			const unlocks = await commitDailyCompletion(session)
			if (!unlocks) {
				// Commit rejected (expiry / no active) — no false success overlay.
				completionCommitted.current = null
				setDailyCompletionSnapshot(null)
				if (!ensureDailyCurrent()) {
					return
				}
				return
			}
			const streakAfter = unlocks.dailyStreakAfter ?? candidate.streakAfter
			setDailyCompletionSnapshot({
				...candidate,
				streakAfter,
			})
			if (levelCompletedAnalyticsKey.current !== commitKey) {
				levelCompletedAnalyticsKey.current = commitKey
				trackEvent('daily_completed', {
					dateKey: candidate.dateKey,
					stars: attemptStars,
					difficulty: session.identity.profile,
					usedHint: session.usedHint,
					usedUndo: session.usedUndo,
					streak: streakAfter,
				})
			}
			if (unlocks.newUnlockIds.length > 0) {
				pushAchievementToasts(unlocks.newUnlockIds)
			}
		})()
	}, [
		clearSessionSource,
		commitDailyCompletion,
		dailyDateKey,
		discardStaleDailyIfDateChanged,
		ensureDailyCurrent,
		getDailySummary,
		isDaily,
		onHome,
		pushAchievementToasts,
		session,
	])

	const confirmRestart = useCallback(() => {
		if (!session) {
			return
		}
		// After campaign completion — no restart-loss warning; restart still allowed
		// from menu only while in_progress. Overlay hides restart for campaign done.
		if (session.completed && (isCampaign || isDaily)) {
			return
		}
		const doRestart = () => {
			if (!ensureDailyCurrent()) {
				return
			}
			if (isCampaign && campaignLevel !== null) {
				trackEvent('level_restarted', {
					level: campaignLevel,
					usedHint: session.usedHint,
					usedUndo: session.usedUndo,
					appendCount: session.counters.appendActions,
				})
			}
			// Invalidate pending transitions / interstitial before new attempt.
			cancelActiveTransition(transitionGuardRef.current)
			cancelActiveInterstitialTransition()
			rewardedAttemptRef.current = null
			finalizeRewardedUi()
			// Explicit Restart persistence transaction — do not wait for incidental sync.
			const restarted = {
				...session,
				board: session.initialBoard,
				history: [] as typeof session.history,
				counters: {
					matchesRemoved: 0,
					appendActions: 0,
					undoActions: 0,
				},
				usedHint: false,
				usedUndo: false,
				freeHintConsumed: false,
				freeUndoConsumed: false,
				completed: false,
			}
			dispatch({ type: 'RESTART' })
			// New attempt — allow level_started again for same fingerprint.
			levelStartedKey.current = null
			levelCompletedAnalyticsKey.current = null
			completionCommitted.current = null
			setDailyCompletionSnapshot(null)
			// Force help-flag sync after Restart (free entitlement must clear on disk).
			lastSyncedKey.current = null
			if (isCampaign) {
				void syncSessionFromGameplay(restarted)
			} else if (isDaily) {
				void syncDailyFromGameplay(restarted)
			}
		}
		if (!isDirty && session.history.length === 0) {
			doRestart()
			return
		}
		Alert.alert(strings.restartConfirmTitle, strings.restartConfirmBody, [
			{ text: strings.cancel, style: 'cancel' },
			{
				text: strings.restartConfirmOk,
				style: 'destructive',
				onPress: doRestart,
			},
		])
	}, [
		campaignLevel,
		dispatch,
		ensureDailyCurrent,
		finalizeRewardedUi,
		isCampaign,
		isDaily,
		isDirty,
		session,
		syncDailyFromGameplay,
		syncSessionFromGameplay,
	])

	const handleAppend = useCallback(() => {
		if (!ensureDailyCurrent()) {
			return
		}
		const before = sessionLiveRef.current
		dispatch({ type: 'APPEND' })
		setScrollToEndToken((n) => n + 1)
		if (isCampaign && campaignLevel !== null && before) {
			const active = before.board.cells.filter((c) => !c.removed).length
			const resultingRows = boardRowCount(before.board.cells.length + active)
			trackEvent('numbers_added', {
				level: campaignLevel,
				resultingRows,
				appendCount: before.counters.appendActions + 1,
			})
		}
	}, [campaignLevel, dispatch, ensureDailyCurrent, isCampaign])

	const handleCellPress = useCallback(
		(index: number) => {
			if (!ensureDailyCurrent()) {
				return
			}
			dispatch({ type: 'SELECT_CELL', index })
		},
		[dispatch, ensureDailyCurrent],
	)

	const runHintWithSource = useCallback(
		async (source: HelpSource) => {
			if (!ensureDailyCurrent()) {
				return
			}
			const hintAttempt = getAttemptId()
			const outcome = await requestHint()
			if (getAttemptId() !== hintAttempt) {
				return
			}
			if (!outcome || !outcome.delivered) {
				return
			}
			if (isCampaign || isDaily) {
				void recordGameplayStats({ hints: 1 })
			}
			if (isCampaign && campaignLevel !== null) {
				trackEvent('hint_used', {
					level: campaignLevel,
					source: source === 'dev_bypass' ? 'free' : source,
					result: hintResultParam(outcome),
				})
			}
		},
		[
			campaignLevel,
			ensureDailyCurrent,
			getAttemptId,
			isCampaign,
			isDaily,
			recordGameplayStats,
			requestHint,
		],
	)

	const handleHint = useCallback(() => {
		if (!session || session.completed || helpAdBusy || rewardedGuard.current) {
			return
		}
		if (!ensureDailyCurrent()) {
			return
		}
		const decision = decideHelpEntitlement(
			'hint',
			{
				freeHintConsumed: session.freeHintConsumed,
				freeUndoConsumed: session.freeUndoConsumed,
			},
			{ monetized, completed: session.completed },
		)
		if (!decision.allowed) {
			return
		}
		if (!decision.requiresReward) {
			void runHintWithSource(decision.source)
			return
		}

		Alert.alert(strings.rewardedHintTitle, strings.rewardedHintBody, [
			{ text: strings.cancel, style: 'cancel' },
			{
				text: strings.rewardedWatch,
				onPress: () => {
					if (rewardedGuard.current) {
						return
					}
					rewardedGuard.current = true
					setHelpAdBusy(true)
					const captureAttempt = getAttemptId()
					rewardedAttemptRef.current = captureAttempt
					const requestToken = `attempt:${captureAttempt}:hint`
					void (async () => {
						try {
							const result = await requestRewarded({
								purpose: 'hint',
								sessionToken: requestToken,
								level: campaignLevel ?? undefined,
								onSnapshot: (snap) => {
									if (getAttemptId() !== captureAttempt) {
										setHelpAdBusy(false)
										return
									}
									setHelpAdBusy(snap.adBusy)
								},
								isSessionValid: () => {
									if (getAttemptId() !== captureAttempt) {
										return false
									}
									const live = sessionLiveRef.current
									if (!live || live.completed) {
										return false
									}
									return rewardedAttemptRef.current === captureAttempt
								},
								onGrant: () => {
									if (getAttemptId() !== captureAttempt) {
										return
									}
									setHelpAdBusy(false)
									void runHintWithSource('rewarded')
								},
							})
							if (getAttemptId() !== captureAttempt) {
								finalizeRewardedUi()
								return
							}
							if (
								result === 'unavailable' ||
								result === 'busy' ||
								result === 'stale_session'
							) {
								Alert.alert(strings.errorTitle, strings.adUnavailable)
							}
						} finally {
							if (getAttemptId() === captureAttempt) {
								finalizeRewardedUi()
							} else {
								setHelpAdBusy(false)
								rewardedGuard.current = false
							}
						}
					})()
				},
			},
		])
	}, [
		campaignLevel,
		ensureDailyCurrent,
		finalizeRewardedUi,
		getAttemptId,
		helpAdBusy,
		monetized,
		runHintWithSource,
		session,
	])

	const handleUndo = useCallback(() => {
		if (!session || session.completed || helpAdBusy || rewardedGuard.current) {
			return
		}
		if (!ensureDailyCurrent()) {
			return
		}
		const decision = decideHelpEntitlement(
			'undo',
			{
				freeHintConsumed: session.freeHintConsumed,
				freeUndoConsumed: session.freeUndoConsumed,
			},
			{
				monetized,
				completed: session.completed,
				hasUndoHistory: session.history.length > 0,
			},
		)
		if (!decision.allowed) {
			return
		}
		if (!decision.requiresReward) {
			dispatch({ type: 'UNDO' })
			if (isCampaign && campaignLevel !== null) {
				trackEvent('undo_used', {
					level: campaignLevel,
					source: decision.source === 'dev_bypass' ? 'free' : decision.source,
				})
			}
			return
		}

		Alert.alert(strings.rewardedUndoTitle, strings.rewardedUndoBody, [
			{ text: strings.cancel, style: 'cancel' },
			{
				text: strings.rewardedWatch,
				onPress: () => {
					if (rewardedGuard.current) {
						return
					}
					rewardedGuard.current = true
					setHelpAdBusy(true)
					const captureAttempt = getAttemptId()
					rewardedAttemptRef.current = captureAttempt
					const requestToken = `attempt:${captureAttempt}:undo`
					void (async () => {
						try {
							const result = await requestRewarded({
								purpose: 'undo',
								sessionToken: requestToken,
								level: campaignLevel ?? undefined,
								onSnapshot: (snap) => {
									if (getAttemptId() !== captureAttempt) {
										setHelpAdBusy(false)
										return
									}
									setHelpAdBusy(snap.adBusy)
								},
								isSessionValid: () => {
									if (getAttemptId() !== captureAttempt) {
										return false
									}
									const live = sessionLiveRef.current
									if (!live || live.completed) {
										return false
									}
									if (live.history.length === 0) {
										return false
									}
									return rewardedAttemptRef.current === captureAttempt
								},
								onGrant: () => {
									if (getAttemptId() !== captureAttempt) {
										return
									}
									setHelpAdBusy(false)
									const live = sessionLiveRef.current
									if (!live || live.history.length === 0) {
										return
									}
									dispatch({ type: 'UNDO' })
									if (isCampaign && campaignLevel !== null) {
										trackEvent('undo_used', {
											level: campaignLevel,
											source: 'rewarded',
										})
									}
								},
							})
							if (getAttemptId() !== captureAttempt) {
								finalizeRewardedUi()
								return
							}
							if (
								result === 'unavailable' ||
								result === 'busy' ||
								result === 'stale_session'
							) {
								Alert.alert(strings.errorTitle, strings.adUnavailable)
							}
						} finally {
							if (getAttemptId() === captureAttempt) {
								finalizeRewardedUi()
							} else {
								setHelpAdBusy(false)
								rewardedGuard.current = false
							}
						}
					})()
				},
			},
		])
	}, [
		campaignLevel,
		dispatch,
		ensureDailyCurrent,
		finalizeRewardedUi,
		getAttemptId,
		helpAdBusy,
		isCampaign,
		monetized,
		session,
	])

	/**
	 * After completion overlay CTA: optionally show interstitial, then navigate.
	 * Token-checked at every await boundary — stale Next/Home never mutates.
	 */
	const withOptionalInterstitial = useCallback(
		async (
			token: TransitionToken,
			navigate: () => void | Promise<void>,
		) => {
			if (isCampaign && !isDensityLab) {
				await maybeShowInterstitialAtTransition({
					isTraining: false,
					naturalBoundary: true,
					isStillCurrent: () =>
						isTransitionAlive(transitionGuardRef.current, token),
				})
			}
			if (!isTransitionAlive(transitionGuardRef.current, token)) {
				cancelActiveInterstitialTransition()
				return
			}
			await navigate()
		},
		[isCampaign, isDensityLab],
	)

	const handleNext = useCallback(async () => {
		if (nextGuard.current || nextBusy || !campaignLevel || !session) {
			return
		}
		nextGuard.current = true
		setNextBusy(true)
		syncAttemptId(transitionGuardRef.current, getAttemptId())
		const token = beginTransition(transitionGuardRef.current)
		try {
			await withOptionalInterstitial(token, async () => {
				if (!isTransitionAlive(transitionGuardRef.current, token)) {
					return
				}
				await commitProgressionCompletion(campaignLevel, session)
				if (!isTransitionAlive(transitionGuardRef.current, token)) {
					return
				}
				const nextLevel = campaignLevel + 1
				if (nextLevel > CAMPAIGN_LEVEL_COUNT) {
					if (!isTransitionAlive(transitionGuardRef.current, token)) {
						return
					}
					onHome()
					return
				}
				const result = await startCampaignLevel(nextLevel, 'progression')
				if (!isTransitionAlive(transitionGuardRef.current, token)) {
					return
				}
				if (!result.ok || !result.identity || !result.board) {
					Alert.alert(strings.errorTitle, result.reason ?? strings.errorGeneric)
					return
				}
				completionCommitted.current = null
				levelStartedKey.current = null
				levelCompletedAnalyticsKey.current = null
				lastSyncedKey.current = null
				setDismissedCompletionKey(null)
				startSession(result.identity, result.board, {
					undoAfterCompletion: false,
				})
				onReplaceGame?.()
			})
		} finally {
			if (isTransitionAlive(transitionGuardRef.current, token)) {
				cancelActiveTransition(transitionGuardRef.current)
			}
			setNextBusy(false)
			nextGuard.current = false
		}
	}, [
		campaignLevel,
		commitProgressionCompletion,
		getAttemptId,
		nextBusy,
		onHome,
		onReplaceGame,
		session,
		startCampaignLevel,
		startSession,
		withOptionalInterstitial,
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
				cancelActiveTransition(transitionGuardRef.current)
				cancelActiveInterstitialTransition()
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
		syncAttemptId(transitionGuardRef.current, getAttemptId())
		const token = beginTransition(transitionGuardRef.current)
		try {
			await withOptionalInterstitial(token, async () => {
				if (!isTransitionAlive(transitionGuardRef.current, token)) {
					return
				}
				const result = await startCampaignLevel(campaignLevel, 'replay')
				if (!isTransitionAlive(transitionGuardRef.current, token)) {
					return
				}
				if (!result.ok || !result.identity || !result.board) {
					Alert.alert(strings.errorTitle, result.reason ?? strings.errorGeneric)
					return
				}
				completionCommitted.current = null
				levelStartedKey.current = null
				levelCompletedAnalyticsKey.current = null
				lastSyncedKey.current = null
				setDismissedCompletionKey(null)
				startSession(result.identity, result.board, {
					undoAfterCompletion: false,
				})
				onReplaceGame?.()
			})
		} finally {
			if (isTransitionAlive(transitionGuardRef.current, token)) {
				cancelActiveTransition(transitionGuardRef.current)
			}
			nextGuard.current = false
		}
	}, [
		campaignLevel,
		densityMeta,
		getAttemptId,
		isDensityLab,
		onReplaceGame,
		startCampaignLevel,
		startSession,
		withOptionalInterstitial,
	])

	const handleDailyReplay = useCallback(async () => {
		if (nextGuard.current) {
			return
		}
		if (!ensureDailyCurrent()) {
			return
		}
		nextGuard.current = true
		try {
			cancelActiveTransition(transitionGuardRef.current)
			cancelActiveInterstitialTransition()
			const result = await startDailyPuzzle()
			if (!result.ok || !result.identity || !result.board) {
				Alert.alert(strings.errorTitle, result.reason ?? strings.errorGeneric)
				return
			}
			completionCommitted.current = null
			levelStartedKey.current = null
			levelCompletedAnalyticsKey.current = null
			lastSyncedKey.current = null
			setDismissedCompletionKey(null)
			setDailyCompletionSnapshot(null)
			startSession(result.identity, result.board, {
				undoAfterCompletion: false,
			})
			onReplaceGame?.()
		} finally {
			nextGuard.current = false
		}
	}, [ensureDailyCurrent, onReplaceGame, startDailyPuzzle, startSession])

	const completionHome = useCallback(() => {
		if (isDensityLab && onDensityLab) {
			onDensityLab()
			return
		}
		if (session?.completed && isCampaign) {
			syncAttemptId(transitionGuardRef.current, getAttemptId())
			const token = beginTransition(transitionGuardRef.current)
			void withOptionalInterstitial(token, async () => {
				if (!isTransitionAlive(transitionGuardRef.current, token)) {
					return
				}
				onHome()
			}).finally(() => {
				if (isTransitionAlive(transitionGuardRef.current, token)) {
					cancelActiveTransition(transitionGuardRef.current)
				}
			})
			return
		}
		onHome()
	}, [
		getAttemptId,
		isCampaign,
		isDensityLab,
		onDensityLab,
		onHome,
		session?.completed,
		withOptionalInterstitial,
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

	const statusText = helpAdBusy
		? strings.adLoading
		: resolveStatus(session)
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
		session.undoAfterCompletion !== false && !isCampaign && !showingAsDaily

	const headerTitle = isCampaign && campaignLevel
		? strings.levelHeader(campaignLevel)
		: showingAsDaily && dailyDateKey
			? strings.dailyPuzzleHeader
			: isDensityLab && densityMeta
				? densityMeta.label
				: strings.appName
	// Campaign: level + optional difficulty only — never seed/fingerprint.
	const headerSubtitle = isCampaign
		? strings.profileLabel(session.identity.profile)
		: showingAsDaily && dailyDateKey
			? formatLocalDateRu(dailyDateKey)
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
			: showingAsDaily
				? strings.dailyPuzzleHeader
				: strings.completedTitle

	const completionMode = showingAsDaily
		? 'daily'
		: !isCampaign
			? 'dev'
			: campaignPurpose === 'replay'
				? 'campaign_replay'
				: 'campaign_progression'

	const dailyStreakNote =
		showingAsDaily && dailyDateKey
			? strings.dailyCompletionStreak(
					dailyCompletionSnapshot?.streakAfter ??
						getDailySummary(dailyDateKey).activeStreak,
				)
			: undefined

	const completionAttemptStars = isCampaign
		? starsFromAttempt({
				usedHint: session.usedHint,
				usedUndo: session.usedUndo,
			})
		: showingAsDaily
			? (dailyCompletionSnapshot?.attemptStars ??
				starsFromAttempt({
					usedHint: session.usedHint,
					usedUndo: session.usedUndo,
				}))
			: undefined

	const completionUsedHint =
		dailyCompletionSnapshot?.usedHint ?? session.usedHint
	const completionUsedUndo =
		dailyCompletionSnapshot?.usedUndo ?? session.usedUndo

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

			{typeof __DEV__ !== 'undefined' && __DEV__ && !isScreenshotQaMode() ? (
				<View style={styles.meta} testID="game-dev-meta">
					<Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
						{session.identity.profile} · seed {session.identity.seed}
						{` · fp ${session.identity.fingerprint}`}
						{` · ${session.counters.matchesRemoved}п/${session.counters.appendActions}+`}
					</Text>
					<Text
						style={[styles.metaText, { color: theme.colors.textMuted }]}
						testID="game-dev-help-entitlement"
					>
						{`Hint free: ${session.freeHintConsumed ? 'used' : 'available'} · Undo free: ${session.freeUndoConsumed ? 'used' : 'available'}`}
						{` · stars H/U: ${session.usedHint ? '1' : '0'}/${session.usedUndo ? '1' : '0'}`}
					</Text>
				</View>
			) : null}

			<NumberBoard
				board={session.board}
				selectedIndex={session.selectedIndex}
				invalidIndices={session.invalidIndices}
				hintIndices={session.hintIndices}
				onCellPress={handleCellPress}
				interactionLocked={
					session.interactionLocked || session.hintBusy || helpAdBusy
				}
				scrollToEndToken={scrollToEndToken}
				showDevCoords={
					typeof __DEV__ !== 'undefined' &&
					__DEV__ &&
					!isScreenshotQaMode() &&
					showDevCoords
				}
			/>

			<Text
				style={[styles.status, { color: theme.colors.textMuted }]}
				testID="game-status"
			>
				{statusText}
			</Text>

			{!session.completed ? (
				<GameControls
					canUndo={session.history.length > 0 && !helpAdBusy}
					canAppend={appendEnabled && !helpAdBusy}
					appendPrimary={appendEnabled}
					canHint={!helpAdBusy && !session.hintBusy}
					hintBusy={session.hintBusy}
					onUndo={handleUndo}
					onAppend={handleAppend}
					onHint={handleHint}
				/>
			) : null}

			{typeof __DEV__ !== 'undefined' && __DEV__ && !isScreenshotQaMode() ? (
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
						: showingAsDaily
							? strings.completedBody
							: strings.completedBody
				}
				counters={session.counters}
				mode={completionMode}
				footerNote={dailyStreakNote}
				attemptStars={completionAttemptStars}
				usedHint={completionUsedHint}
				usedUndo={completionUsedUndo}
				showNext={showNext}
				nextLabel={
					campaignLevel === CAMPAIGN_LEVEL_COUNT
						? strings.campaignComplete
						: strings.nextLevel
				}
				nextBusy={nextBusy}
				onNext={showNext ? () => void handleNext() : undefined}
				onReplay={
					showingAsDaily
						? () => void handleDailyReplay()
						: isCampaign || isDensityLab
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
				showRestart={!isCampaign && !isDensityLab && !showingAsDaily}
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
