export {
	AD_UNIT_IDS,
	BANNER_UNIT_BY_PLACEMENT,
	getBannerUnitId,
	resolveBannerPlacement,
} from './config'
export type { BannerPlacement, RewardPurpose } from './config'
export {
	INTERSTITIAL_POLICY,
	canShowInterstitial,
	createInterstitialPolicyState,
	describeInterstitialEligibility,
	monotonicNowMs,
	recordInterstitialShown,
	recordLevelCompleted,
	recordLevelStarted,
	recordRewardedInteraction,
	shouldReserveBanner,
} from './policy'
export type {
	InterstitialEligibilityRequest,
	InterstitialPolicyState,
} from './policy'
export { createRewardGrantGuard } from './rewardedPolicy'
export type { RewardGrantGuard } from './rewardedPolicy'
export {
	initializeAds,
	preloadInterstitial,
	preloadRewarded,
	maybeShowInterstitialAtTransition,
	notifyCampaignLevelCompleted,
	notifyCampaignLevelStarted,
	requestRewarded,
	normalizeAdErrorCategory,
	getInterstitialDiagnostics,
} from './service'
export type { RewardedShowResult } from './service'
