# Number Match — agent notes

ForestMusic Android / RuStore project. Prefer DevTools playbooks over generic Expo assumptions.

## Stack

- Expo SDK 57, React Native 0.86, React 19, TypeScript strict
- Navigation is a lightweight in-app stack under `src/navigation` (not Expo Router)
- Game math lives only in `src/game/core` (pure TypeScript, Jest on desktop)

## Commands

```bash
npm test
npm run typecheck
npm run lint
npx expo start --dev-client --host lan --port 8081
```

Android QA:

```powershell
.\scripts\android\android-device-qa.ps1
```

## Identity

- package: `com.calculatorplatform.numbermatch`
- scheme: `number-match`

Do not copy identities from Water Sort / CrossMath / Killer Sudoku / other apps.
