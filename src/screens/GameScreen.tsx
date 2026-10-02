/**
 * Production Game screen (PHASE 5 campaign flow + Campaign v2 stars + monetization).
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

import { evaluateAchievementUnlocks, useAppState } from '../app'
import { formatLocalDateRu } from '../daily'
import {
	maybeShowInterstitialAtTransition,
	notifyCampaignLevelCompleted,
	notifyCampaignLevelStarted,
	requestRewarded,
} from '../ads'
import { trackEvent } from '../analytics'
import { CAMPAIGN_LEVEL_COUNT, CAMPAIGN_VERSION } from '../game/campaign'
import { DENSITY_FIXTURES, loadDensityFixture } from '../dev/density'
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
import { starsFromAttempt } from '../game/stars'
import { useGameSession } from '../game/session/GameSessionContext'
import type { HintOutcome } from '../game/session/hintRequest'
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
	} = useAppState()

	const [dismissedCompletionKey, setDismissedCompletionKey] = useState<
		string | null
	>(null)
	const [scrollToEndToken, setScrollToEndToken] = useState(0)
	const [showDevCoords, setShowDevCoords] = useState(DEV_SHOW_COORDS_DEFAULT)
	const [nextBusy, setNextBusy] = useState(false)
	const [helpAdBusy, setHelpAdBusy] = useState(false)
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

	useEffect(() => {
		sessionLiveRef.current = session
	}, [session])

	/** Centralized cleanup for rewarded UI chrome (never leaves Загрузка stuck). */
	const finalizeRewardedUi = useCallback(() => {
		setHelpAdBusy(false)
		rewardedGuard.current = false
	}, [])

	const isCampaign = sessionSource === 'campaign' && activeSession !== null
	const isDaily = sessionSource === 'daily' && daily.activeDaily !== null
	const dailyDateKey = daily.activeDaily?.dateKey ?? null
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
					persisted.freeUndoConsumed)
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
					persisted.freeUndoConsumed)
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
	useEffect(() => {
		if (!session?.completed || !isDaily || !dailyDateKey) {
			return
		}
		const commitKey = `daily:${dailyDateKey}:${session.identity.fingerprint}`
		if (completionCommitted.current === commitKey) {
			return
		}
		completionCommitted.current = commitKey
		void (async () => {
			const unlocks = await commitDailyCompletion(session)
			if (levelCompletedAnalyticsKey.current !== commitKey) {
				levelCompletedAnalyticsKey.current = commitKey
				const attemptStars = starsFromAttempt({
					usedHint: session.usedHint,
					usedUndo: session.usedUndo,
				})
				trackEvent('daily_completed', {
					dateKey: dailyDateKey,
					stars: attemptStars,
					difficulty: session.identity.profile,
					usedHint: session.usedHint,
					usedUndo: session.usedUndo,
					streak: unlocks?.dailyStreakAfter ?? 0,
				})
			}
			if (unlocks && unlocks.newUnlockIds.length > 0) {
				pushAchievementToasts(unlocks.newUnlockIds)
			}
		})()
	}, [
		commitDailyCompletion,
		dailyDateKey,
		getDailySummary,
		isDaily,
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
			if (isCampaign && campaignLevel !== null) {
				trackEvent('level_restarted', {
					level: campaignLevel,
					usedHint: session.usedHint,
					usedUndo: session.usedUndo,
					appendCount: session.counters.appendActions,
				})
			}
			dispatch({ type: 'RESTART' })
			// New attempt — allow level_started again for same fingerprint.
			levelStartedKey.current = null
			levelCompletedAnalyticsKey.current = null
			completionCommitted.current = null
			// Force help-flag sync after Restart (free entitlement must clear on disk).
			lastSyncedKey.current = null
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
	}, [campaignLevel, dispatch, isCampaign, isDaily, isDirty, session])

	const handleAppend = useCallback(() => {
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
	}, [campaignLevel, dispatch, isCampaign])

	const handleCellPress = useCallback(
		(index: number) => {
			dispatch({ type: 'SELECT_CELL', index })
		},
		[dispatch],
	)

	const runHintWithSource = useCallback(
		async (source: HelpSource) => {
			const outcome = await requestHint()
			if (!outcome || !outcome.delivered) {
				return
			}
			// Delivered Hint (free or rewarded) counts toward lifetime statistics.
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
					const requestToken = `${session.identity.fingerprint}:${campaignLevel}`
					void (async () => {
						try {
							const result = await requestRewarded({
								purpose: 'hint',
								sessionToken: requestToken,
								level: campaignLevel ?? undefined,
								onSnapshot: (snap) => {
									// Ad chrome only — never OR into Hint Ищу… busy.
									setHelpAdBusy(snap.adBusy)
								},
								isSessionValid: () => {
									const live = sessionLiveRef.current
									if (!live || live.completed) {
										return false
									}
									return (
										`${live.identity.fingerprint}:${campaignLevel}` ===
										requestToken
									)
								},
								onGrant: () => {
									// Reward earned → clear ad chrome, then compute Hint.
									setHelpAdBusy(false)
									void runHintWithSource('rewarded')
								},
							})
							if (
								result === 'unavailable' ||
								result === 'busy' ||
								result === 'stale_session'
							) {
								Alert.alert(strings.errorTitle, strings.adUnavailable)
							}
						} finally {
							finalizeRewardedUi()
						}
					})()
				},
			},
		])
	}, [
		campaignLevel,
		finalizeRewardedUi,
		helpAdBusy,
		monetized,
		runHintWithSource,
		session,
	])

	const handleUndo = useCallback(() => {
		if (!session || session.completed || helpAdBusy || rewardedGuard.current) {
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
					const requestToken = `${session.identity.fingerprint}:${campaignLevel}`
					void (async () => {
						try {
							const result = await requestRewarded({
								purpose: 'undo',
								sessionToken: requestToken,
								level: campaignLevel ?? undefined,
								onSnapshot: (snap) => {
									setHelpAdBusy(snap.adBusy)
								},
								isSessionValid: () => {
									const live = sessionLiveRef.current
									if (!live || live.completed) {
										return false
									}
									if (live.history.length === 0) {
										return false
									}
									return (
										`${live.identity.fingerprint}:${campaignLevel}` ===
										requestToken
									)
								},
								onGrant: () => {
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
							if (
								result === 'unavailable' ||
								result === 'busy' ||
								result === 'stale_session'
							) {
								Alert.alert(strings.errorTitle, strings.adUnavailable)
							}
						} finally {
							finalizeRewardedUi()
						}
					})()
				},
			},
		])
	}, [
		campaignLevel,
		dispatch,
		finalizeRewardedUi,
		helpAdBusy,
		isCampaign,
		monetized,
		session,
	])

	/**
	 * After completion overlay CTA: optionally show interstitial, then navigate.
	 * Navigation runs exactly once whether the ad shows, fails, or is ineligible.
	 */
	const withOptionalInterstitial = useCallback(
		async (navigate: () => void | Promise<void>) => {
			if (isCampaign && !isDensityLab) {
				await maybeShowInterstitialAtTransition({
					isTraining: false,
					naturalBoundary: true,
				})
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
		try {
			await withOptionalInterstitial(async () => {
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
			await withOptionalInterstitial(async () => {
				const result = await startCampaignLevel(campaignLevel, 'replay')
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
			nextGuard.current = false
		}
	}, [
		campaignLevel,
		densityMeta,
		isDensityLab,
		onReplaceGame,
		startCampaignLevel,
		startSession,
		withOptionalInterstitial,
	])

	const handleDailyReplay = useCallback(async () => {
		if (nextGuard.current || !dailyDateKey) {
			return
		}
		nextGuard.current = true
		try {
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
			startSession(result.identity, result.board, {
				undoAfterCompletion: false,
			})
			onReplaceGame?.()
		} finally {
			nextGuard.current = false
		}
	}, [dailyDateKey, onReplaceGame, startDailyPuzzle, startSession])

	const completionHome = useCallback(() => {
		if (isDensityLab && onDensityLab) {
			onDensityLab()
			return
		}
		if (session?.completed && isCampaign) {
			void withOptionalInterstitial(async () => {
				onHome()
			})
			return
		}
		onHome()
	}, [
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
		session.undoAfterCompletion !== false && !isCampaign && !isDaily

	const headerTitle = isCampaign && campaignLevel
		? strings.levelHeader(campaignLevel)
		: isDaily && dailyDateKey
			? strings.dailyPuzzleHeader
			: isDensityLab && densityMeta
				? densityMeta.label
				: strings.appName
	// Campaign: level + optional difficulty only — never seed/fingerprint.
	const headerSubtitle = isCampaign
		? strings.profileLabel(session.identity.profile)
		: isDaily && dailyDateKey
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
			: isDaily
				? strings.dailyPuzzleHeader
				: strings.completedTitle

	const completionMode = isDaily
		? 'daily'
		: !isCampaign
			? 'dev'
			: campaignPurpose === 'replay'
				? 'campaign_replay'
				: 'campaign_progression'

	const dailyStreakNote =
		isDaily && dailyDateKey
			? strings.dailyCompletionStreak(
					getDailySummary(dailyDateKey).activeStreak,
				)
			: undefined

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
						: isDaily
							? strings.completedBody
							: strings.completedBody
				}
				counters={session.counters}
				mode={completionMode}
				footerNote={dailyStreakNote}
				attemptStars={
					isCampaign || isDaily
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
					isDaily
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
				showRestart={!isCampaign && !isDensityLab && !isDaily}
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
