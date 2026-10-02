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
import { createInterstitialLifecycle } from './interstitialLifecycle'
import type { InterstitialLifecycleController } from './interstitialLifecycle'
import { createRewardedLifecycle } from './rewardedLifecycle'
import type { RewardedLifecycleSnapshot } from './rewardedLifecycle'
import {
	loadRewardedAdOwned,
	type DisposableRewardedAd,
	type RewardedLoaderHandle,
} from './rewardedLoadOwnership'

let adsInitialized = false
let interstitialLoader: InterstitialAdLoader | null = null
let loadedInterstitial: InterstitialAd | null = null
let interstitialLoading = false
let interstitialShowing = false
let interstitialRequestSeq = 0
let activeInterstitialLifecycle: InterstitialLifecycleController | null = null
let activeInterstitialAd: InterstitialAd | null = null
let interstitialPolicy: InterstitialPolicyState =
	createInterstitialPolicyState()
let rewardedBusy = false
let rewardedRequestSeq = 0

/**
 * Bound rewarded load so hung native loadAd cannot lock help forever.
 * Late results after timeout are disposed via loadRewardedAdOwned.
 */
export const REWARDED_LOAD_TIMEOUT_MS = 45_000

type RewardedLoaderFactory = () => Promise<RewardedLoaderHandle>

const defaultRewardedLoaderFactory: RewardedLoaderFactory = async () => {
	const loader = await RewardedAdLoader.create()
	return {
		loadAd: async (params) => {
			const ad = await loader.loadAd(params)
			return ad as unknown as DisposableRewardedAd
		},
		cancelLoading: () => loader.cancelLoading(),
	}
}

let rewardedLoaderFactory: RewardedLoaderFactory = defaultRewardedLoaderFactory

/** Jest seam — inject fake loader / ads for ownership tests. */
export function __setRewardedLoaderFactoryForTests(
	factory: RewardedLoaderFactory | null,
): void {
	rewardedLoaderFactory = factory ?? defaultRewardedLoaderFactory
}

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
 * Cancel any in-flight interstitial transition (unmount / Restart / new attempt).
 * Late dismiss/fail/show Promise become no-ops after cancel.
 */
export function cancelActiveInterstitialTransition(): void {
	const lifecycle = activeInterstitialLifecycle
	const ad = activeInterstitialAd
	activeInterstitialLifecycle = null
	activeInterstitialAd = null
	if (lifecycle) {
		lifecycle.cancel()
	}
	if (ad) {
		try {
			// Runtime has public delete(); TS typings mark it private.
			;(ad as unknown as { delete: () => void }).delete()
		} catch {
			// ignore
		}
	}
	interstitialShowing = false
}

/**
 * Show interstitial only when policy + cached ad allow it.
 *
 * Settlement is driven by dismiss / fail / onAdShown-gated init timeout (+
 * explicit cancel), NOT solely by `await ad.show()`.
 * Navigation callers await this function; it resolves exactly once per request.
 */
export async function maybeShowInterstitialAtTransition(options: {
	readonly isTraining: boolean
	readonly naturalBoundary: boolean
	readonly nowMs?: number
	/** Optional external cancel probe (screen/attempt/transition token). */
	readonly isStillCurrent?: () => boolean
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

	if (options.isStillCurrent && !options.isStillCurrent()) {
		return false
	}

	const ad = loadedInterstitial
	loadedInterstitial = null
	interstitialShowing = true
	interstitialPolicy = recordInterstitialShown(interstitialPolicy, nowMs)
	interstitialRequestSeq += 1
	const requestId = `is-${interstitialRequestSeq}`

	const lifecycle = createInterstitialLifecycle({ id: requestId })
	activeInterstitialLifecycle = lifecycle
	activeInterstitialAd = ad
	lifecycle.markShowRequested()

	ad.onAdShown = () => {
		lifecycle.onAdShown()
	}
	ad.onAdDismissed = () => {
		lifecycle.onDismissed()
	}
	ad.onAdFailedToShow = () => {
		lifecycle.onFailed()
	}

	try {
		// Fire-and-forget show — never block navigation on this promise alone.
		void ad
			.show()
			.then(() => {
				// Some SDK builds resolve show() without a dismiss callback.
				// Only treat as dismiss if already visible or never shown.
				const snap = lifecycle.snapshot()
				if (!snap.settled) {
					if (snap.visible) {
						lifecycle.onDismissed()
					} else {
						// show() resolved without onAdShown — still wait for
						// dismiss/fail/init-timeout; do not invent dismiss yet.
					}
				}
			})
			.catch(() => {
				lifecycle.onFailed()
			})

		const settled = await lifecycle.waitForSettlement()
		if (options.isStillCurrent && !options.isStillCurrent()) {
			lifecycle.cancel()
			return false
		}
		if (settled === 'dismissed') {
			trackEvent('ad_interstitial_shown', {})
			return true
		}
		trackEvent('ad_interstitial_failed', {
			error_category:
				settled === 'cancelled' ? 'cancelled' : 'show_failed',
		})
		return false
	} catch (error) {
		lifecycle.onFailed()
		await lifecycle.waitForSettlement()
		trackEvent('ad_interstitial_failed', {
			error_category: normalizeAdErrorCategory(error),
		})
		return false
	} finally {
		if (activeInterstitialLifecycle === lifecycle) {
			activeInterstitialLifecycle = null
		}
		if (activeInterstitialAd === ad) {
			activeInterstitialAd = null
		}
		lifecycle.dispose()
		try {
			;(ad as unknown as { delete: () => void }).delete()
		} catch {
			// ignore
		}
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
 * NOT solely by `await ad.show()`.
 *
 * Load ownership: timeout / abandon / stale_session always dispose late ads.
 * Grant runs only from the verified reward callback, at most once, and only
 * when `isSessionValid()` (attempt token) still matches.
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

	let loadOwnership: Awaited<ReturnType<typeof loadRewardedAdOwned>> | null =
		null

	try {
		lifecycle.markLoading()
		const loader = await rewardedLoaderFactory()
		loadOwnership = await loadRewardedAdOwned({
			loader,
			adUnitId: AD_UNIT_IDS.rewarded,
			timeoutMs: REWARDED_LOAD_TIMEOUT_MS,
			isAbandoned: () => !options.isSessionValid(),
		})

		if (loadOwnership.timedOut || !loadOwnership.ad) {
			loadOwnership.disposeLateOrUnused()
			lifecycle.onFailed()
			const settled = await lifecycle.waitForSettlement()
			return mapResult(settled)
		}

		const ad = loadOwnership.ad

		// Session may have Restarted / unmounted while load was in flight.
		if (!options.isSessionValid()) {
			loadOwnership.disposeLateOrUnused()
			lifecycle.dispose()
			return 'stale_session'
		}

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
				lifecycle.onDismissed()
			})
			.catch(() => {
				lifecycle.onFailed()
			})

		const settled = await lifecycle.waitForSettlement()
		return mapResult(settled)
	} catch (error) {
		loadOwnership?.disposeLateOrUnused()
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
		// After show lifecycle ends, delete the ad to release native listeners.
		loadOwnership?.disposeLateOrUnused()
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
