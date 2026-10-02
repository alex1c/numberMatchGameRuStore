/**
 * Yandex Mobile Ads service — single process-wide init, interstitial + rewarded.
 * BannerView lifecycle lives in BannerSlot; this module owns full-screen ads.
 *
 * Failures never throw to callers in a way that blocks gameplay.
 */

import {
	InterstitialAdLoader,
	MobileAds,
	RewardedAdLoader,
	type InterstitialAd,
} from 'yandex-mobile-ads'

import { trackEvent } from '../analytics'
import { isScreenshotQaMode } from '../dev/screenshotQaMode'
import { AD_UNIT_IDS, type RewardPurpose } from './config'
import {
	canShowInterstitial,
	createInterstitialPolicyState,
	describeInterstitialEligibility,
	monotonicNowMs,
	recordInterstitialShown,
	recordLevelCompleted,
	recordLevelStarted,
	recordRewardedInteraction,
	type InterstitialPolicyState,
} from './policy'
import { createRewardedLifecycle } from './rewardedLifecycle'
import type { RewardedLifecycleSnapshot } from './rewardedLifecycle'

let adsInitialized = false
let interstitialLoader: InterstitialAdLoader | null = null
let loadedInterstitial: InterstitialAd | null = null
let interstitialLoading = false
let interstitialShowing = false
let interstitialPolicy: InterstitialPolicyState =
	createInterstitialPolicyState()
let rewardedBusy = false
let rewardedRequestSeq = 0

/** Normalize SDK errors into low-cardinality analytics categories. */
export function normalizeAdErrorCategory(error: unknown): string {
	if (error == null) {
		return 'unknown'
	}
	const text =
		typeof error === 'string'
			? error
			: error instanceof Error
				? error.message
				: String(error)
	const lower = text.toLowerCase()
	if (lower.includes('nofill') || lower.includes('no fill')) {
		return 'no_fill'
	}
	if (lower.includes('network') || lower.includes('timeout')) {
		return 'network'
	}
	if (lower.includes('invalid') || lower.includes('unit')) {
		return 'invalid_request'
	}
	if (lower.includes('show') || lower.includes('display')) {
		return 'show_failed'
	}
	return 'sdk_error'
}

export function initializeAds(): void {
	if (adsInitialized) {
		return
	}
	adsInitialized = true
	try {
		const result = MobileAds.initialize()
		if (result && typeof (result as Promise<void>).catch === 'function') {
			void (result as Promise<void>).catch(() => undefined)
		}
	} catch {
		// Missing/failed ad SDK must never block startup.
	}
}

export async function preloadInterstitial(): Promise<void> {
	if (interstitialLoading || loadedInterstitial) {
		return
	}
	interstitialLoading = true
	try {
		interstitialLoader ??= await InterstitialAdLoader.create()
		loadedInterstitial = await interstitialLoader.loadAd({
			adUnitId: AD_UNIT_IDS.interstitial,
		})
	} catch {
		loadedInterstitial = null
		trackEvent('ad_interstitial_failed', { error_category: 'load_failed' })
	} finally {
		interstitialLoading = false
	}
}

export async function preloadRewarded(): Promise<void> {
	// Intentionally lightweight: WaterSort loads on demand per show.
	// A dedicated preload cache can be added later without API changes.
}

/**
 * Notify interstitial policy that a Campaign level attempt started.
 * Clears rewarded→interstitial suppression.
 */
export function notifyCampaignLevelStarted(): void {
	interstitialPolicy = recordLevelStarted(interstitialPolicy)
}

/**
 * Record a Campaign completion toward the meaningful-action counter.
 * Does not show an ad — call maybeShowInterstitialAtTransition separately.
 */
export function notifyCampaignLevelCompleted(): void {
	interstitialPolicy = recordLevelCompleted(interstitialPolicy, false)
}

/**
 * Show interstitial only when policy + cached ad allow it.
 * Never blocks navigation — callers await then continue either way.
 */
export async function maybeShowInterstitialAtTransition(options: {
	readonly isTraining: boolean
	readonly naturalBoundary: boolean
	readonly nowMs?: number
}): Promise<boolean> {
	// Store-capture mode never auto-shows interstitial.
	if (isScreenshotQaMode()) {
		return false
	}
	const nowMs = options.nowMs ?? monotonicNowMs()

	if (
		!canShowInterstitial(interstitialPolicy, {
			isTraining: options.isTraining,
			naturalBoundary: options.naturalBoundary,
			nowMs,
		}) ||
		!loadedInterstitial ||
		interstitialShowing
	) {
		if (__DEV__) {
			const debug = describeInterstitialEligibility(interstitialPolicy, {
				isTraining: options.isTraining,
				naturalBoundary: options.naturalBoundary,
				nowMs,
			})
			console.log(
				'[NumberMatch][ads] interstitial skipped',
				debug.reasons.join(',') || 'no_cached_ad',
			)
		}
		void preloadInterstitial()
		return false
	}

	const ad = loadedInterstitial
	loadedInterstitial = null
	interstitialShowing = true
	interstitialPolicy = recordInterstitialShown(interstitialPolicy, nowMs)
	try {
		await ad.show()
		trackEvent('ad_interstitial_shown', {})
		return true
	} catch (error) {
		trackEvent('ad_interstitial_failed', {
			error_category: normalizeAdErrorCategory(error),
		})
		return false
	} finally {
		interstitialShowing = false
		void preloadInterstitial()
	}
}

export type RewardedShowResult =
	| 'granted'
	| 'unavailable'
	| 'busy'
	| 'cancelled'
	| 'stale_session'

/**
 * Load + show one rewarded ad.
 *
 * Settlement is driven by reward / dismiss / fail callbacks (+ fail-safe),
 * NOT solely by `await ad.show()` — physical devices can close the ad while
 * the show() promise never resolves (ForestMusic REWARDED_GAME_RELEASE).
 *
 * Grant runs only from the verified reward callback, at most once.
 */
export async function requestRewarded(options: {
	readonly purpose: RewardPurpose
	readonly sessionToken: string
	readonly isSessionValid: () => boolean
	readonly onGrant: () => void
	readonly level?: number
	readonly onSnapshot?: (snapshot: RewardedLifecycleSnapshot) => void
}): Promise<RewardedShowResult> {
	if (rewardedBusy) {
		return 'busy'
	}
	rewardedBusy = true
	interstitialPolicy = recordRewardedInteraction(interstitialPolicy)
	rewardedRequestSeq += 1
	const requestId = `rw-${rewardedRequestSeq}`

	trackEvent('ad_rewarded_requested', {
		reward: options.purpose,
		...(typeof options.level === 'number' ? { level: options.level } : {}),
	})

	const lifecycle = createRewardedLifecycle({
		id: requestId,
		purpose: options.purpose,
		sessionToken: options.sessionToken,
		isSessionValid: options.isSessionValid,
		applyHelp: options.onGrant,
		onSnapshot: options.onSnapshot,
	})

	const mapResult = (
		result: Awaited<ReturnType<typeof lifecycle.waitForSettlement>>,
	): RewardedShowResult => {
		switch (result) {
			case 'granted':
				return 'granted'
			case 'cancelled':
				return 'cancelled'
			case 'stale_session':
				return 'stale_session'
			case 'failed':
				return 'unavailable'
			default: {
				const _exhaustive: never = result
				return _exhaustive
			}
		}
	}

	try {
		const loader = await RewardedAdLoader.create()
		const ad = await loader.loadAd({ adUnitId: AD_UNIT_IDS.rewarded })
		lifecycle.markShowing()

		ad.onRewarded = () => {
			const ok = lifecycle.onVerifiedReward()
			if (ok) {
				trackEvent('ad_rewarded_completed', {
					reward: options.purpose,
					...(typeof options.level === 'number'
						? { level: options.level }
						: {}),
				})
			}
		}
		ad.onAdDismissed = () => {
			lifecycle.onDismissed()
		}
		ad.onAdFailedToShow = () => {
			lifecycle.onFailed()
		}

		// Fire-and-forget show — never block UI recovery on this promise alone.
		void ad
			.show()
			.then(() => {
				// Some SDK builds resolve show() without a dismiss callback.
				lifecycle.onDismissed()
			})
			.catch(() => {
				lifecycle.onFailed()
			})

		const settled = await lifecycle.waitForSettlement()
		return mapResult(settled)
	} catch (error) {
		trackEvent('ad_rewarded_failed', {
			reward: options.purpose,
			error_category: normalizeAdErrorCategory(error),
			...(typeof options.level === 'number' ? { level: options.level } : {}),
		})
		lifecycle.onFailed()
		const settled = await lifecycle.waitForSettlement()
		return mapResult(settled)
	} finally {
		lifecycle.dispose()
		rewardedBusy = false
	}
}

/** Test seam — replace policy state (Jest only). */
export function __setInterstitialPolicyForTests(
	state: InterstitialPolicyState,
): void {
	interstitialPolicy = state
}

export function __getInterstitialPolicyForTests(): InterstitialPolicyState {
	return interstitialPolicy
}

/** DEV diagnostics for physical QA — never alters thresholds. */
export function getInterstitialDiagnostics(nowMs: number = monotonicNowMs()): {
	readonly eligibleAtBoundary: boolean
	readonly reasons: readonly string[]
	readonly completedLevels: number
	readonly shownThisSession: boolean
	readonly hasCachedAd: boolean
} {
	const probe = describeInterstitialEligibility(interstitialPolicy, {
		isTraining: false,
		naturalBoundary: true,
		nowMs,
	})
	return {
		eligibleAtBoundary: probe.eligible && loadedInterstitial !== null,
		reasons: probe.reasons,
		completedLevels: interstitialPolicy.completedLevels,
		shownThisSession: interstitialPolicy.shownThisSession,
		hasCachedAd: loadedInterstitial !== null,
	}
}
