# Local production signing (outside Git)

Canonical path for this app (create if missing):

```text
D:\PetProject\secure\numberMatchGameRuStore\
  number-match-release.jks
  keystore.properties
```

`keystore.properties` keys (values never committed):

```properties
storeFile=D:\\PetProject\\secure\\numberMatchGameRuStore\\number-match-release.jks
storePassword=***
keyAlias=number-match
keyPassword=***
```

Wire into generated `android/app/build.gradle` release signingConfig after `npx expo prebuild --platform android`, pointing at this external properties file. Do not commit `android/`, JKS, or properties.

Build:

```powershell
cd D:\PetProject\numberMatchGameRuStore
npx expo prebuild --platform android --clean
# apply signingConfig to android/app/build.gradle (local only)
cd android
.\gradlew.bat bundleRelease --console=plain
copy app\build\outputs\bundle\release\app-release.aab ..\release-artifacts\number-match-1.0.0-1.aab
```

Then verify with bundletool and write `.sha256` sidecar.
