# Number Match core rules (PHASE 1)

Pure domain library: `src/game/core`.

## Values

Two active numbers are value-compatible iff:

- they are equal, **or**
- they sum to 10

Domain: integers `1..9` only. Out-of-domain inputs are rejected by value helpers.

`5 + 5` is one legal pair (satisfies both equal and sum-10).

## Geometry

A match also requires a clear path. Supported:

### Horizontal

Same row. Every cell strictly between the endpoints on that row is removed.

### Vertical

Same column. Every cell strictly between the endpoints in that column is removed.

### Diagonal

Straight diagonal: `|Δrow| === |Δcol|` and `≥ 1`. Intermediate diagonal cells must be removed.

### Linear / row-boundary

Row-major linear order. Every cell with index strictly between the endpoints is removed.  
This covers **end of row N → start of row N+1** and longer empty linear spans.

**Not** same-row torus wrap (last column ↔ first column of the same row).

### Explicitly not implemented

Knight moves, L-paths, multi-turn paths, matching through active blockers, auto-collapse, auto-shuffle.

## Board model

- Fixed `width` on state (no scattered magic constants)
- Removed cells **remain** in geometry (no floating compaction)
- Stable cell `id`s; append creates new IDs
- Serializable-friendly state (`toSerializableBoard` / `toCanonicalBoard`)

## Append

Snapshot active values in row-major order → append new cells at the end → leave existing cells untouched.

## No-move vs game-over

`hasAvailableMoves() === false` is **not** game-over. Classic play may use append. Product limits arrive later.

## Core must not know

Rewards, ads, coins, campaign level numbers, Daily dates, achievements, RuStore, scores.
