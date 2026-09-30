# Persistence schema v2

## Identity

| Field | Value |
| --- | --- |
| Storage key | `numbermatch.persist.v1` (unchanged) |
| `schemaVersion` | **2** |
| `campaignVersion` | **2** |

## Contents

- `trainingCompleted`
- `highestCompletedLevel` (0..1000)
- `bestStars` — length-1000 array, index 0 = Level 1, values 0..3
- `activeSession` — gv3 identity (`density`, `usedHint`, `usedUndo`, board, history, counters)

## Migration from schema 1 (Campaign v1)

Pre-release policy:

1. Preserve `trainingCompleted` when present.
2. **Reset** Campaign frontier, active session, and stars.
3. Do **not** continue a Campaign v1 board as Campaign v2.

Corrupt / unknown schema → safe defaults (`createDefaultRoot()`).

## Star invariant

For normal Campaign v2 progress, every level `1..highestCompletedLevel` has
`bestStars[level-1] >= 1`. Repair on load fills missing stars with 1.
