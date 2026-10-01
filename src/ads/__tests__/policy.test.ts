/**
 * Interstitial eligibility policy — pure unit tests (no ad SDK).
 */

import {
	INTERSTITIAL_POLICY,
	canShowInterstitial,
	createInterstitialPolicyState,
	recordInterstitialShown,
	recordLevelCompleted,
	recordLevelStarted,
	recordRewardedInteraction,
} from '../policy'
import { AD_UNIT_IDS, getBannerUnitId, resolveBannerPlacement } from '../config'
import { createRewardGrantGuard } from '../rewardedPolicy'

describe('interstitial policy', () => {
	const eligibleBase = {
		isTraining: false,
		naturalBoundary: true,
		nowMs: INTERSTITIAL_POLICY.minimumIntervalMs + 1,
	}

	function readyState() {
		let state = createInterstitialPolicyState(0)
		for (let i = 0; i < INTERSTITIAL_POLICY.minimumCompletedLevels; i += 1) {
			state = recordLevelCompleted(state, false)
		}
		return state
	}

	it('blocks before 5 minutes', () => {
		const state = readyState()
		expect(
			canShowInterstitial(state, {
				...eligibleBase,
				nowMs: INTERSTITIAL_POLICY.minimumIntervalMs - 1,
			}),
		).toBe(false)
	})

	it('blocks with insufficient completions', () => {
		let state = createInterstitialPolicyState(0)
		state = recordLevelCompleted(state, false)
		expect(canShowInterstitial(state, eligibleBase)).toBe(false)
	})

	it('allows when eligible', () => {
		expect(canShowInterstitial(readyState(), eligibleBase)).toBe(true)
	})

	it('blocks second show in same session', () => {
		let state = readyState()
		state = recordInterstitialShown(
			state,
			INTERSTITIAL_POLICY.minimumIntervalMs + 1,
		)
		expect(
			canShowInterstitial(state, {
				...eligibleBase,
				nowMs: INTERSTITIAL_POLICY.minimumIntervalMs * 3,
			}),
		).toBe(false)
	})

	it('suppresses after rewarded until next level start', () => {
		let state = readyState()
		state = recordRewardedInteraction(state)
		expect(canShowInterstitial(state, eligibleBase)).toBe(false)
		state = recordLevelStarted(state)
		expect(canShowInterstitial(state, eligibleBase)).toBe(true)
	})

	it('never shows during training', () => {
		expect(
			canShowInterstitial(readyState(), {
				...eligibleBase,
				isTraining: true,
			}),
		).toBe(false)
	})

	it('ignores training completions in counter', () => {
		let state = createInterstitialPolicyState(0)
		for (let i = 0; i < 10; i += 1) {
			state = recordLevelCompleted(state, true)
		}
		expect(state.completedLevels).toBe(0)
	})
})

describe('banner placements', () => {
	it('maps production block IDs', () => {
		expect(getBannerUnitId('game')).toBe(AD_UNIT_IDS.gameBanner)
		expect(getBannerUnitId('home_levels')).toBe(AD_UNIT_IDS.homeLevelsBanner)
		expect(getBannerUnitId('secondary')).toBe(AD_UNIT_IDS.secondaryBanner)
		expect(AD_UNIT_IDS.interstitial).toBe('R-M-20145948-4')
		expect(AD_UNIT_IDS.rewarded).toBe('R-M-20145948-5')
	})

	it('resolves routes without Training / Density Lab ads', () => {
		expect(resolveBannerPlacement('game')).toBe('game')
		expect(resolveBannerPlacement('home')).toBe('home_levels')
		expect(resolveBannerPlacement('levels')).toBe('home_levels')
		expect(resolveBannerPlacement('settings')).toBe('secondary')
		expect(resolveBannerPlacement('about')).toBe('secondary')
		expect(resolveBannerPlacement('training')).toBeNull()
		expect(resolveBannerPlacement('densityLab')).toBeNull()
		expect(resolveBannerPlacement('daily')).toBeNull()
	})
})

describe('reward grant guard', () => {
	it('grants exactly once even on duplicate callbacks', () => {
		const onGrant = jest.fn()
		const guard = createRewardGrantGuard(onGrant)
		expect(guard.onVerifiedReward()).toBe(true)
		expect(guard.onVerifiedReward()).toBe(false)
		expect(onGrant).toHaveBeenCalledTimes(1)
	})

	it('skips grant when session token invalid', () => {
		const onGrant = jest.fn()
		const guard = createRewardGrantGuard(onGrant, () => false)
		expect(guard.onVerifiedReward()).toBe(false)
		expect(onGrant).not.toHaveBeenCalled()
	})

	it('does nothing on dismiss', () => {
		const onGrant = jest.fn()
		const guard = createRewardGrantGuard(onGrant)
		guard.onDismissed()
		expect(guard.hasGranted()).toBe(false)
		expect(onGrant).not.toHaveBeenCalled()
	})
})
