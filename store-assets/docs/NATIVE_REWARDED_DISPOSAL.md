# Native rewarded ad disposal (yandex-mobile-ads@8.5.0)

## Problem

Stock `RewardedAd.delete()` (private) only:

1. Removed JS `NativeEventEmitter` subscriptions
2. Cleared `_id`

It did **not** call native `YandexRewardedAdModule.deleteAd`, so Android
`adsStorage` / iOS `adsStorage` retained loaded-but-unshown rewarded ads after
timeout, cancel, or stale-attempt disposal.

`cancelLoading()` only cancels the loader; a late `onAdLoaded` could still
insert into `adsStorage` with no JS waiter (native leak).

No newer npm version than 8.5.0 exposes a public JS disposal API.

## Fix (documented patch-package)

`patches/yandex-mobile-ads+8.5.0.patch` (applied via `postinstall`):

| Layer | Change |
| --- | --- |
| Android | `@ReactMethod fun deleteAd(id)` (existing body) |
| Android | `onAdLoaded`: if no load Promise waiter, drop ad (do not store) |
| iOS | `@objc deleteAd(_:)` + `RCT_EXTERN_METHOD` |
| JS | `RewardedAd.delete()` calls `YandexRewardedAdModule.deleteAd(adId)` |

App ownership (`loadRewardedAdOwned` / `disposeRewardedAdNative`) clears JS
listeners and invokes the same native path so disposal is testable without
claiming JS-only `delete()` is sufficient.

## Native rebuild

**YES** — after pulling this change, regenerate the Android (and iOS) native
binary so the bridged `deleteAd` ReactMethod is present:

```powershell
npx expo prebuild --platform android --clean
# then rebuild the debug/release APK or AAB as usual
```

Jest proves the JS→native call contract with a mocked
`NativeModules.YandexRewardedAdModule.deleteAd`. Physical proof requires a
rebuild that includes the patched Kotlin/ObjC module.

## Reward semantics

Unchanged: grant still runs only from the verified reward callback, at most
once, and only while the attempt session token is valid.
