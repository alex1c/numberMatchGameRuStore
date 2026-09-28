# Generator + Difficulty (PHASE 3)

## Versions

- `generationVersion`: **1**
- `difficultyProfileVersion`: **1** (provisional algorithmic labels)

## Pipeline

```
seed → namespaced stream → candidate board → solve → replay → metrics → guards → profile accept/reject
```

## Commands

```bash
npm run generator:audit -- --small
npm run generator:audit -- --400 --write
npm run generator:audit -- --full --compare --write
```

- `--small`: 5 puzzles × 4 profiles (CI-friendly)
- `--400`: 100 × 4 profiles
- `--full`: 300/300/250/150 = 1000 accepted
- `--compare`: deterministic rerun (ignores elapsedMs)
- `--write`: compact JSON under `artifacts/generator-audit/` (gitignored)

Full audit reproduction (PHASE 3):

```bash
npm run generator:audit -- --full --compare --write
```

- baseSeed: `10000`
- maxAttemptsPerPuzzle: `120`
- solver: `when_stuck`, maxAppends 3, maxStates 25000, maxDepth 128

## PRNG

Mulberry32 with explicit uint32 ops. Seed normalization documented in `prng.ts`.
Profile streams use `deriveStreamSeed(generationVersion, profile, seed)`.

## Fingerprint

Canonical: `gv{version}|w{width}|{digits/.}`  
Fingerprint: portable FNV-1a hex bucket; duplicates confirmed by canonical equality.

## Profiles (provisional algorithmic)

See `profiles.ts` and [CALIBRATION.md](CALIBRATION.md).

## Tutorial / UI seeds

- `tutorialCandidates.ts` — 10 curated learning-goal boards
- `representativeSeeds.ts` — PHASE 4 UI QA seeds

## Next

PHASE 4 — Gameplay UI
