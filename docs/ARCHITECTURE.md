# Architecture — Number Match

ForestMusic DevTools: v1.1.0  
Package: `com.calculatorplatform.numbermatch`  
Scheme: `number-match`

## Layering

| Area | Role |
| --- | --- |
| `src/game/core` | Pure TypeScript Number Match domain. No React Native. |
| `src/game/solver` | Deterministic bounded DFS solver + replay (PHASE 2). |
| `src/navigation`, `src/screens`, `src/components` | Minimal UI shell (not Expo Router). |
| `src/theme` | Light/dark foundation. |
| `src/storage` | Persistence **boundary/interface** only — no I/O yet. |
| `src/ads/policy` | Banner placement policy; no ad SDK. |

Game mathematics must never live inside React components.

## Mutability policy

Core transitions are **pure immutable**: `state → operation → newState`.  
Invalid moves return the original state reference unchanged.

## Puzzle identity (future)

Do not key React lifecycles or saves on mutable `updatedAt`, move counters, or board hashes that change every move. Future identity is conceptually `mode + level/seed/date + generationVersion`.

## Banner geometry

Order: `CONTENT → BANNER → SAFE AREA → SYSTEM`.  
Reserved on Home / Levels / Daily / Statistics / Achievements / Settings / About / Reminders.  
**Training: no ads.**  
**Game: sticky banner undecided** — not reserved inside the board in Phase 0/1.

## Out of scope (later phases)

Generator, campaign, polished UI, persistence I/O, AppMetrica, production ads, rewarded, RuStore signing.

Solver details: [SOLVER.md](SOLVER.md).
