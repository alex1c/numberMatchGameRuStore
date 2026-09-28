/**
 * Screen-by-screen banner geometry policy (no ad SDK in Phase 0/1).
 *
 * Training is never an ad surface.
 * Gameplay sticky banner is intentionally undecided — do not reserve a banner
 * inside the dense board until measured on Android.
 */

export type BannerPlacement =
	| 'home'
	| 'levels'
	| 'daily'
	| 'statistics'
	| 'achievements'
	| 'settings'
	| 'about'
	| 'reminders'
	| 'training'
	| 'game'

/** Surfaces that reserve bottom banner geometry before SDK integration. */
export const BANNER_RESERVED_PLACEMENTS: ReadonlySet<BannerPlacement> = new Set([
	'home',
	'levels',
	'daily',
	'statistics',
	'achievements',
	'settings',
	'about',
	'reminders',
])

export function shouldReserveBanner(placement: BannerPlacement): boolean {
	return BANNER_RESERVED_PLACEMENTS.has(placement)
}
