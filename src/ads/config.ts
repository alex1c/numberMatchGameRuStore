/**
 * Central Yandex Mobile Ads unit IDs for Number Match (RuStore / RСЯ).
 * Screens must use typed placements — never hard-code block IDs in UI.
 */

import type { AppRouteName } from '../navigation'

/** Production RСЯ block IDs — do not invent additional ones. */
export const AD_UNIT_IDS = {
	gameBanner: 'R-M-20145948-1',
	homeLevelsBanner: 'R-M-20145948-2',
	secondaryBanner: 'R-M-20145948-3',
	interstitial: 'R-M-20145948-4',
	rewarded: 'R-M-20145948-5',
} as const

/**
 * Semantic banner placements mapped to production block IDs.
 * - game: sticky Game banner
 * - home_levels: Home + Levels hubs
 * - secondary: Settings / About (and future suitable hubs)
 */
export type BannerPlacement = 'game' | 'home_levels' | 'secondary'

export const BANNER_UNIT_BY_PLACEMENT: Record<BannerPlacement, string> = {
	game: AD_UNIT_IDS.gameBanner,
	home_levels: AD_UNIT_IDS.homeLevelsBanner,
	secondary: AD_UNIT_IDS.secondaryBanner,
}

export function getBannerUnitId(placement: BannerPlacement): string {
	return BANNER_UNIT_BY_PLACEMENT[placement]
}

/**
 * Map navigation route → banner placement, or null when ads must not load.
 * Training and Density Lab never request banners.
 * Placeholder hubs (daily / statistics / achievements) stay ad-free until real UI exists.
 */
export function resolveBannerPlacement(
	route: AppRouteName,
): BannerPlacement | null {
	switch (route) {
		case 'game':
			return 'game'
		case 'home':
		case 'levels':
			return 'home_levels'
		case 'settings':
		case 'about':
			return 'secondary'
		case 'training':
		case 'densityLab':
		case 'daily':
		case 'statistics':
		case 'achievements':
			return null
		default: {
			const _exhaustive: never = route
			return _exhaustive
		}
	}
}

/** Rewarded purpose for analytics — one physical block serves both. */
export type RewardPurpose = 'hint' | 'undo'
