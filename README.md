# Number Match

Android / RuStore ForestMusic project.

- Working title: **Number Match**
- Package / applicationId: `com.calculatorplatform.numbermatch`
- Expo/RN scheme: `number-match`
- ForestMusic DevTools: **v1.1.1** (`ad2ff4469e2aaf301a4b4e93eb633ddf17c8490c`)

## Paths

| Role | Path |
| --- | --- |
| Cursor | `D:\PetProject\numberMatchGameRuStore` |
| Codex / Android QA | `D:\petProject\numberMatchGameRuStore` |
| GitHub | https://github.com/alex1c/numberMatchGameRuStore |

## Scripts

```bash
npm test
npm run typecheck
npm run lint
npm run solver:bench
npm run generator:audit -- --small
npm start
```

Android device QA (after native prebuild / dev client exists):

```powershell
.\scripts\android\android-device-qa.ps1
```

Standard Metro: port **8081** (`--host lan`). Do not work around with 8082.

## Phase status

- **PHASE 0** — project bootstrap (Expo 57 / RN / React 19, safe-area, theme, navigation, BannerSlot geometry, Android QA helpers)
- **PHASE 1** — pure TypeScript Number Match game core + Jest coverage
- **PHASE 2** — deterministic solver + replay + benchmark harness
- **PHASE 3** — seeded generator + provisional difficulty profiles + 1000-puzzle audit

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/CORE_RULES.md](docs/CORE_RULES.md), [docs/SOLVER.md](docs/SOLVER.md), [docs/GENERATOR.md](docs/GENERATOR.md).

## Intentionally not implemented yet

Campaign catalog, polished gameplay UI, persistence I/O, Daily, achievements, AppMetrica, Yandex Ads SDK, rewarded, release signing.

**Next checkpoint:** PHASE 4 — Gameplay UI
