/**
 * Conservative interstitial eligibility (ForestMusic / WaterSort baseline).
 *
 * Production gate:
 * - ≥5 meaningful Campaign level completions this process session
 * - ≥5 minutes since session start (monotonic session clock)
 * - max 1 interstitial per app process session
 * - never during Training
 * - only at natural post-completion transitions (Next / Home after stars)
 * - suppress after a rewarded interaction until the next level start
 *
 * Runtime-only — not persisted across process restarts.
 */

import type { AppRouteName } from '../navigation'
import { resolveBannerPlacement } from './config'

export const INTERSTITIAL_POLICY = {
	/** Completed Campaign levels (not cell taps) required before first show. */
	minimumCompletedLevels: 5,
	/** Minimum session age before first show. */
	minimumIntervalMs: 5 * 60 * 1000,
	/** Hard cap for this app process. */
	maximumPerSession: 1,
} as const

export interface InterstitialPolicyState {
	/** Monotonic session start (performance.now when available). */
	readonly sessionStartMs: number
	/** Meaningful Campaign completions counted this process. */
	readonly completedLevels: number
	readonly lastShownAtMs: number | null
	readonly shownThisSession: boolean
	/**
	 * After rewarded show/complete/cancel, block interstitial until the next
	 * Campaign level start (prevents rewarded → immediate interstitial).
	 */
	readonly blockUntilNextLevelStart: boolean
}

export interface InterstitialEligibilityRequest {
	readonly isTraining: boolean
	/** True only for post-completion Next/Home transitions. */
	readonly naturalBoundary: boolean
	/** Monotonic now (same clock as sessionStartMs). */
	readonly nowMs: number
}

/** Prefer performance.now for in-session gates; fall back to Date.now. */
export function monotonicNowMs(): number {
	if (
		typeof performance !== 'undefined' &&
		typeof performance.now === 'function'
	) {
		return performance.now()
	}
	return Date.now()
}

export function createInterstitialPolicyState(
	nowMs: number = monotonicNowMs(),
): InterstitialPolicyState {
	return {
		sessionStartMs: nowMs,
		completedLevels: 0,
		lastShownAtMs: null,
		shownThisSession: false,
		blockUntilNextLevelStart: false,
	}
}

export function canShowInterstitial(
	state: InterstitialPolicyState,
	request: InterstitialEligibilityRequest,
): boolean {
	if (request.isTraining || !request.naturalBoundary) {
		return false
	}
	if (state.shownThisSession) {
		return false
	}
	if (state.blockUntilNextLevelStart) {
		return false
	}
	if (state.completedLevels < INTERSTITIAL_POLICY.minimumCompletedLevels) {
		return false
	}
	const elapsed = request.nowMs - state.sessionStartMs
	if (elapsed < INTERSTITIAL_POLICY.minimumIntervalMs) {
		return false
	}
	if (
		state.lastShownAtMs !== null &&
		request.nowMs - state.lastShownAtMs <
			INTERSTITIAL_POLICY.minimumIntervalMs
	) {
		return false
	}
	return true
}

/**
 * DEV-only eligibility snapshot — does not change production thresholds.
 */
export function describeInterstitialEligibility(
	state: InterstitialPolicyState,
	request: InterstitialEligibilityRequest,
): {
	readonly eligible: boolean
	readonly reasons: readonly string[]
} {
	const reasons: string[] = []
	if (request.isTraining) {
		reasons.push('training')
	}
	if (!request.naturalBoundary) {
		reasons.push('not_natural_boundary')
	}
	if (state.shownThisSession) {
		reasons.push('session_cap')
	}
	if (state.blockUntilNextLevelStart) {
		reasons.push('rewarded_suppression')
	}
	if (state.completedLevels < INTERSTITIAL_POLICY.minimumCompletedLevels) {
		reasons.push(
			`completions_${state.completedLevels}_of_${INTERSTITIAL_POLICY.minimumCompletedLevels}`,
		)
	}
	const elapsed = request.nowMs - state.sessionStartMs
	if (elapsed < INTERSTITIAL_POLICY.minimumIntervalMs) {
		reasons.push(`time_${Math.floor(elapsed)}ms`)
	}
	return {
		eligible: canShowInterstitial(state, request),
		reasons,
	}
}

export function recordLevelCompleted(
	state: InterstitialPolicyState,
	isTraining: boolean,
): InterstitialPolicyState {
	if (isTraining) {
		return state
	}
	return {
		...state,
		completedLevels: state.completedLevels + 1,
	}
}

export function recordInterstitialShown(
	state: InterstitialPolicyState,
	nowMs: number,
): InterstitialPolicyState {
	return {
		...state,
		lastShownAtMs: nowMs,
		shownThisSession: true,
	}
}

/** Call after rewarded requested/shown/completed/failed/cancelled. */
export function recordRewardedInteraction(
	state: InterstitialPolicyState,
): InterstitialPolicyState {
	return {
		...state,
		blockUntilNextLevelStart: true,
	}
}

/** Clear rewarded suppression when a new Campaign level attempt starts. */
export function recordLevelStarted(
	state: InterstitialPolicyState,
): InterstitialPolicyState {
	return {
		...state,
		blockUntilNextLevelStart: false,
	}
}

/**
 * Whether AppShell should reserve/request a banner for this route.
 * Training / Density Lab / unfinished placeholders → false.
 */
export function shouldReserveBanner(route: AppRouteName | string): boolean {
	return resolveBannerPlacement(route as AppRouteName) !== null
}
