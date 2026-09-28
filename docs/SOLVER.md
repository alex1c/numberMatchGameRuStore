# Number Match solver (PHASE 2)

Pure TypeScript search over production core APIs.

## Model

- Algorithm: bounded iterative DFS + failure transposition cache
- Transitions: `getAvailableMoves` → `removePair`; optional `appendRemainingNumbers`
- Geometry: **unchanged** PHASE 1 rules (including multi-row `isLinearClear`)

## Statuses

| Status | Meaning |
| --- | --- |
| `solved` | Board can be cleared; `path` is replayable |
| `unsolvable` | Finite model fully exhausted — **never** a budget stop |
| `cutoff` | `max_states` / `max_depth` / `timeout` fired |
| `invalid` | `validateBoard` failed before search |

## Append policy

Configurable: `when_stuck` (default) | `anytime`.

Default matches classic UX (add numbers when no pairs). Product monetization limits are **not** encoded here — only technical `maxAppends`.

## Default budgets

```ts
maxStates: 25_000
maxDepth: 128
maxAppends: 4
appendPolicy: 'when_stuck'
```

Optional `timeoutMs` exists as a production guard; unit tests use state/depth budgets.

## Cache key

`toCanonicalBoard(board) + remainingAppends`

- Ignores cell IDs / `nextCellSeq` (mathematical equality)
- Includes remaining append allowance (required for correct futures)

## API

```ts
solveBoard(board, options?) => SolveResult
replaySolution(initial, path) => ReplayResult
firstSolutionMove(board, options?) => SolverAction | null
```

## Benchmark

```bash
npm run solver:bench
```

Desktop synthetic fixtures only — not Android timing.

## Next

PHASE 3 — Generator + difficulty analysis
