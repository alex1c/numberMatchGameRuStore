# Board density calibration (PHASE 5A / V2)

**Status:** DEV EXPERIMENT — NO PRODUCTION DECISION YET.

**Product principle (provisional):**

> Normal Campaign levels should visually occupy a substantial part of the gameplay area.
> Sparse boards are appropriate for Training, but ordinary levels should not look
> unfinished or empty merely because they are EASY.
>
> **Difficulty and visual density are separate dimensions.**

## Physical evidence so far (OPPO)

- User tested Density Lab V1 on physical OPPO.
- **Width 8 × 6 rows (48 cells)** felt clearly better than sparse current EASY.
- Digits readable; cells tappable; horizontal density comfortable.
- **9-column is unnecessary for now.**
- **8×6 still leaves too much unused vertical gameplay space.**
- Next decision is **rows only** at fixed width **8**.

## What this is

DEV-only **Density Lab**:

- **V2 (primary):** `8×6` … `8×10` — vertical fill comparison
- **V1 (reference):** width survey (5/7/8/9) kept below the fold

Campaign v1 (`cs6e442b58`) is untouched.

## How to open

Home → DEV → **Density Lab** (`__DEV__` only).

Sessions are non-persistent DEV fixtures.

## Cell size formula (unchanged production)

`computeBoardLayout(availableWidth, boardWidth)`:

- gap = 4dp
- cellSize = clamp(floor((width − gaps) / cols), **36**, **56**)
- symmetric side margins

Reference content width: **328**dp · reference board viewport: **520**dp.

## V2 — 8 columns vertical fill (primary)

| Variant | Cells | Cell dp | Board height | Fill % | Opening | Depth | Appends | Max rows | Initial scroll |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 8×6 | 48 | 37 | 242 | 46.5 | 71 | 24 | 0 | 6 | NO |
| 8×7 | 56 | 37 | 283 | 54.4 | 48 | 30 | 1 | 7 | NO |
| 8×8 | 64 | 37 | 324 | 62.3 | 56 | 36 | 1 | 8 | NO |
| 8×9 | 72 | 37 | 365 | 70.2 | 69 | 40 | 1 | 9 | NO |
| 8×10 | 80 | 37 | 406 | 78.1 | 50 | 44 | 1 | 10 | NO |

All widths exact **8**; cell counts exact **width × rows** (no partial final row).

Touch/readability: cell ~37dp (same across V2). No horizontal overflow at reference width.
Post-Add scroll risk rises with taller starts (especially 8×9 / 8×10) — judge on OPPO.

**Do not choose a winner in docs** — OPPO decides.

### Frozen seeds (V2)

| ID | Seed | Fingerprint |
| --- | ---: | --- |
| density-8x6 | 2684023931 | ffbc8a6fd (OPPO-tested V1 identity kept) |
| density-8x7 | 8007001 | f952eb99f |
| density-8x8 | 3436997684 | f90b235b1 |
| density-8x9 | 1021913243 | f6d25f28d |
| density-8x10 | 3049722727 | fe79aa427 |

## V1 width survey (reference only)

| ID | Width | Rows | Cells | Fill %* |
| --- | ---: | ---: | ---: | ---: |
| density-current | 5 | 3 | 15 | 33.8 |
| density-7x5 | 7 | 5 | 34 | 44.4 |
| density-7x6 | 7 | 6 | 42 | 53.5 |
| density-8x5 | 8 | 5 | 40 | 38.7 |
| density-9x4 | 9 | 4 | 36 | 30.0 |
| density-9x5 | 9 | 5 | 44 | 37.7 |

\*Reference layout. 9×4 shows many cells can still look vertically sparse.

## Easy-dense proof (unchanged insight)

CURRENT 15 cells / 8 openings vs 8×5 40 cells / 23 openings (0 append):
visual fullness ≠ algorithmic EXPERT.

## Tooling

```bash
npx tsx src/dev/density/searchV2Cli.ts
```

Does not mutate Campaign catalog.

## Physical V2 order

1. 8×6
2. 8×7
3. 8×8
4. 8×9
5. 8×10

Sample each ~30–90s. Mark: пустовато / нормально / тесно · Лучший: …

## Non-goals

No Campaign rebuild, no generationVersion bump, no profile changes, no ghost numbers.
