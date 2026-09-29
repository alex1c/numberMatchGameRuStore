# Board density calibration (PHASE 5A)

**Status:** DEV EXPERIMENT — NO PRODUCTION DECISION YET.

**Product principle (provisional):**

> Normal Campaign levels should visually occupy a substantial part of the gameplay area.
> Sparse boards are appropriate for Training, but ordinary levels should not look
> unfinished or empty merely because they are EASY.
>
> **Difficulty and visual density are separate dimensions.**

## What this is

A DEV-only **Density Lab** with seven solver-proven boards so physical OPPO play
can choose a density feel. Campaign v1 (`cs6e442b58`) is untouched.

## How to open

Home → DEV → **Density Lab** (only when `__DEV__ === true`).

Sessions are non-persistent DEV fixtures (same isolation as playtest fixtures).

## Cell size formula (unchanged production)

From `computeBoardLayout(availableWidth, boardWidth)`:

- gap = 4dp between columns
- raw = floor((availableWidth − gaps) / cols)
- cellSize = clamp(raw, **min 36**, **max 56**)
- side margins absorb leftover width symmetrically

Reference content width in this doc: `360 − 2×16 = 328`dp  
Reference board viewport height: **520**dp (header/status/controls reserved).

## Variants (frozen seeds)

| ID | Width | Rows | Cells | Seed | FP | Depth | Open | App | Score | Cell dp* | Board H* | Fill %* |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| density-current | 5 | 3 | 15 | 10000 | fd71cf927 | 9 | 8 | 1 | 63.5 | 56 | 176 | 33.8 |
| density-7x5 | 7 | 5 | 34 | 3401073915 | f0bccf69f | 20 | 18 | 1 | 133.1 | 43 | 231 | 44.4 |
| density-7x6 | 7 | 6 | 42 | 2387170673 | fc7c57c84 | 21 | 45 | 0 | 177.2 | 43 | 278 | 53.5 |
| density-8x5 | 8 | 5 | 40 | 4211548598 | fa06408a5 | 20 | 23 | 0 | 155.7 | 37 | 201 | 38.7 |
| density-8x6 | 8 | 6 | 48 | 2684023931 | ffbc8a6fd | 24 | 71 | 0 | 229.3 | 37 | 242 | 46.5 |
| density-9x4 | 9 | 4 | 36 | 1762541388 | f0dd11d5c | 18 | 34 | 0 | 155.2 | 36 | 156 | 30.0 |
| density-9x5 | 9 | 5 | 44 | 3346570985 | fad7d2686 | 22 | 25 | 0 | 182.6 | 36 | 196 | 37.7 |

\*Reference layout math (`DENSITY_REFERENCE_*`). Physical OPPO may differ slightly.

Notes:

- 7×5 uses **34** cells (even pairing); 9×5 uses **44** (same reason).
- Algorithmic “score” rises with board size even when openings are plentiful —
  that does **not** mean the board plays like EXPERT. See easy-dense proof below.

## Technical fit flags (reference)

| ID | H overflow | Initial scroll | Post-Add scroll risk | Touch risk | Readability |
| --- | --- | --- | --- | --- | --- |
| density-current | NO | NO | low | low (large tiles) | high |
| density-7x5 | NO | NO | low–med | low | high |
| density-7x6 | NO | NO | med | low | high |
| density-8x5 | NO | NO | low–med | watch (~37dp) | good |
| density-8x6 | NO | NO | med | watch | good |
| density-9x4 | NO | NO | low | higher (~36dp min) | watch |
| density-9x5 | NO | NO | med | higher | watch |

## Easy-dense proof

| | CURRENT EASY | 8×5 dense |
| --- | --- | --- |
| cells | 15 | 40 |
| openings | 8 | 23 |
| depth | 9 | 20 |
| choiceStates | 6 | 18 |
| appends | 1 | 0 |
| score | 63.5 | 155.7 |

Conclusion for calibration only: **a denser board can still offer many openings
and ≤1 append** — visual fullness ≠ algorithmic EXPERT. Final width/row choice
is reserved for OPPO judgment.

## Rebuild tooling

```bash
npx tsx src/dev/density/searchCli.ts
```

Does not mutate Campaign catalog.

## Physical comparison order

1. CURRENT  
2. 7×5  
3. 7×6  
4. 8×5  
5. 8×6  
6. 9×4  
7. 9×5  

Sample each ~30–90s (3–5 matches). Do not require completing all seven.

## Questions for OPPO

- Which looks most like a proper full Number Match board?
- At which width do numbers become uncomfortable?
- Which feels interesting without overcrowding?
- Prefer fixed width throughout Campaign, or gradual widening?

Report simply: `пустовато / нормально / тесно` per variant + best pick.

## Non-goals (this checkpoint)

No Campaign rebuild, no generationVersion bump, no profile changes,
no ghost numbers, no Training enlargement.
