# Local production signing (outside Git)

Canonical path for this app (ForestMusic pattern
`D:\secure\android-signing\<app>\`):

```text
D:\secure\android-signing\numberMatchGame\
  number-match-release.jks
  keystore.properties
  password.txt
```

Do not move or recreate the keystore. Do not copy the JKS into the
repository. Read `keystore.properties` locally only.

`keystore.properties` keys (values never committed):

```properties
storeFile=D:/secure/android-signing/numberMatchGame/number-match-release.jks
storePassword=***
keyAlias=number-match
keyPassword=***
```

Alias: `number-match`

Expected certificate SHA-256 (verify after every release AAB):

```text
25:12:22:BF:98:65:B7:C9:30:4B:0B:12:83:1F:36:59:4C:DB:05:13:02:77:14:5A:F7:1C:A0:30:39:53:07:F2
```

Wire into generated `android/app/build.gradle` release signingConfig after
`npx expo prebuild --platform android --clean`, loading the external
properties file by absolute path. Do not commit `android/`, JKS,
properties, or passwords.

Build:

```powershell
cd D:\PetProject\numberMatchGameRuStore
npx expo prebuild --platform android --clean
# apply signingConfig to android/app/build.gradle (local only)
cd android
.\gradlew.bat bundleRelease --console=plain
New-Item -ItemType Directory -Force ..\release-artifacts | Out-Null
Copy-Item app\build\outputs\bundle\release\app-release.aab `
  ..\release-artifacts\pairs-chisel-number-match-1.0.0-1.aab
```

Then verify package / versionName / versionCode / signer with bundletool
and write the `.sha256` sidecar.
