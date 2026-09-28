# ForestMusic DevTools pin

This project tracks:

- Repository: https://github.com/alex1c/forestMusicDevTools
- Version: **1.1.1**
- `origin/main` SHA: **ad2ff4469e2aaf301a4b4e93eb633ddf17c8490c**
- Tag: `v1.1.1`

## v1.1.1 update (PS 5.1 encoding)

Canonical Android helpers were refreshed after DevTools fixed Windows PowerShell
5.1 UTF-8-without-BOM parse failures caused by typographic punctuation (em dash /
Unicode arrows) in executable `.ps1` sources.

Copied into this repo:

- `scripts/android/android-device-qa.ps1`
- `scripts/android/android-screenshot.ps1`
- `scripts/android/validate-ps51-encoding.ps1`

Helper blob SHAs (must match DevTools):

- `android-device-qa.ps1` → `6e855a5e0b9d6d7a114f3040bd0f9366bd69c66f`
- `android-screenshot.ps1` → `343c0e304ab419bd4d5b6057aca6da9d20fb114b`

Windows PowerShell 5.1 is the supported QA shell; PowerShell 7 is not required.

## Earlier bootstrap (v1.1.0 / PHASE 0–1)

Applied playbooks/checklists from DevTools v1.1.0 and retained thereafter.
