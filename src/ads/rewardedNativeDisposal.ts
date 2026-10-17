/**
 * Proven native disposal for loaded rewarded ads.
 *
 * Stock yandex-mobile-ads@8.5.0 RewardedAd.delete() only cleared JS
 * subscriptions — native adsStorage retained the ad. We apply a documented
 * patch-package bridge that exposes YandexRewardedAdModule.deleteAd and
 * invokes it from RewardedAd.delete().
 *
 * This helper is the app-owned disposal entry used by ownership / service
 * code and tests so we can assert the native module call separately from
 * listener cleanup.
 */

import { NativeModules } from 'react-native'

export interface RewardedAdNativeModule {
	readonly deleteAd?: (adId: string) => void | Promise<void>
}

export interface DisposableRewardedWithId {
	readonly delete: () => void
	/** Present on real SDK ads — used to invoke native deleteAd directly. */
	readonly _id?: string
	onRewarded: ((reward?: unknown) => void) | null
	onAdDismissed: (() => void) | null
	onAdFailedToShow: ((error?: unknown) => void) | null
}

/** Resolve the patched native rewarded module (injectable in tests). */
export function getYandexRewardedAdNativeModule(
	modules: typeof NativeModules = NativeModules,
): RewardedAdNativeModule | null {
	const mod = modules.YandexRewardedAdModule as RewardedAdNativeModule | undefined
	return mod ?? null
}

/**
 * Invoke native adsStorage removal for a rewarded ad id.
 * Returns true when the native bridge method was called.
 */
export function invokeNativeRewardedDeleteAd(
	adId: string,
	modules: typeof NativeModules = NativeModules,
): boolean {
	if (!adId) {
		return false
	}
	const native = getYandexRewardedAdNativeModule(modules)
	if (!native || typeof native.deleteAd !== 'function') {
		return false
	}
	native.deleteAd(adId)
	return true
}

/**
 * Clear JS listeners via ad.delete() (patched SDK also hits native deleteAd).
 * Additionally calls native deleteAd with the captured id when available so
 * disposal remains proven even if a mock delete() only clears JS state.
 *
 * Returns whether a native deleteAd invocation was performed by this helper
 * (true) or only JS delete ran (false — e.g. test doubles without _id).
 */
export function disposeRewardedAdNative(
	ad: DisposableRewardedWithId,
	modules: typeof NativeModules = NativeModules,
): { readonly jsDeleted: boolean; readonly nativeDeleted: boolean } {
	const adId =
		typeof ad._id === 'string' && ad._id.length > 0 ? ad._id : ''

	try {
		ad.onRewarded = null
		ad.onAdDismissed = null
		ad.onAdFailedToShow = null
	} catch {
		// ignore listener assignment failures on odd mocks
	}

	let jsDeleted = false
	try {
		ad.delete()
		jsDeleted = true
	} catch {
		jsDeleted = false
	}

	// If delete() already called native (patched SDK), a second call is a
	// no-op once adsStorage removed the id. Tests with fake delete() still
	// need an explicit native invocation when _id is present.
	const nativeDeleted =
		adId.length > 0 ? invokeNativeRewardedDeleteAd(adId, modules) : false

	return { jsDeleted, nativeDeleted }
}
