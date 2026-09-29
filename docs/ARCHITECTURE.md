# Architecture — Number Match

ForestMusic DevTools: v1.1.1
Package: `com.calculatorplatform.numbermatch`
Scheme: `number-match`

## Layering

| Area | Role |
| --- | --- |
| `src/game/core` | Pure TypeScript Number Match domain. No React Native. |
| `src/game/solver` | Deterministic bounded DFS solver + replay (PHASE 2). |
| `src/game/generator` | Seeded generator, metrics, profiles, audit (PHASE 3). |
| `src/game/campaign` | 1000-level catalog + resolve/reconstruct (PHASE 5). |
| `src/storage` | AsyncStorage persistence — `PersistRepository` + schema v1. |
| `src/app` | AppStateProvider — hydrate, campaign progress bridge. |
| `src/features/training` | Interactive training (no ads). |
| `src/navigation`, `src/screens`, `src/components` | App shell UI (not Expo Router). |
| `src/theme` | Light/dark foundation. |
| `src/ads/policy` | Banner placement policy; no ad SDK. |

Game mathematics must never live inside React components.

## Provider order

`SafeAreaProvider → ThemeProvider → AppStateProvider → GameSessionProvider → AppShell`

Initial route is chosen **once** after hydrate: Training if `!trainingCompleted`, else Home.

## Mutability policy

Core transitions are **pure immutable**: `state → operation → newState`.
Invalid moves return the original state reference unchanged.

## Puzzle identity

Campaign sessions key on `mode + level + generationVersion + seed + profile + fingerprint`.
Do not key React lifecycles on mutable move counters alone.

## Banner geometry

Order: `CONTENT → BANNER → SAFE AREA → SYSTEM`.
Reserved on Home / Levels / Daily / Statistics / Achievements / Settings / About.
**Training: no ads.**
**Game: no sticky banner** by default (DEV may toggle for measurement).

## Out of scope (later)

Daily, AppMetrica, production ads, rewarded, RuStore signing.

PHASE 5 details: [PHASE5.md](PHASE5.md). Solver: [SOLVER.md](SOLVER.md). Generator: [GENERATOR.md](GENERATOR.md).
