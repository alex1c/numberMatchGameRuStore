/**
 * DEV / store-capture Screenshot QA Mode.
 *
 * Enable only in a DEV client:
 *   $env:EXPO_PUBLIC_SCREENSHOT_QA_MODE = '1'
 *   npx expo start --dev-client ...
 *
 * Effects when active:
 * - no banner ad requests;
 * - BannerSlot collapses (no reserved empty strip) for store presentation;
 * - interstitial auto-show suppressed.
 *
 * Hard-gated by __DEV__ so ordinary release users cannot get ad-free builds
 * through normal UI or an accidentally shipped env flag alone.
 */

export function isScreenshotQaMode(): boolean {
	if (typeof __DEV__ === 'undefined' || !__DEV__) {
		return false
	}
	return process.env.EXPO_PUBLIC_SCREENSHOT_QA_MODE === '1'
}
