# Screenshot QA Mode (store capture)

## Enable (DEV client only)

```powershell
$env:EXPO_PUBLIC_SCREENSHOT_QA_MODE = '1'
npx expo start --dev-client --host lan --port 8081
```

Requires `__DEV__` + flag. Release/production builds never activate this mode.

## Effects

- Banner requests suppressed
- BannerSlot collapses completely (no reserved empty strip) — store presentation only
- Automatic interstitial suppressed
- Production monetization unchanged when flag is unset

## Restore normal DEV ads

```powershell
Remove-Item Env:EXPO_PUBLIC_SCREENSHOT_QA_MODE -ErrorAction SilentlyContinue
npx expo start --dev-client --host lan --port 8081
```
