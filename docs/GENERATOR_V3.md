# Generator v3 (Campaign density)

## Identity

| Constant | Value | Notes |
| --- | --- | --- |
| `generationVersion` | **3** | Fixed width 8 + `CampaignDensity` rows |
| `GENERATION_VERSION_V2` | 2 | Historical sparse boards; reconstruct still works |
| `difficultyProfileVersion` | **2** | Density-independent score + `PROFILE_RANGES_GV3` |
| `DIFFICULTY_PROFILE_VERSION_V1` | 1 | gv2 cell-count gated ranges |

## Why profile version 2

gv2 scored `initialCells * 0.7`, so denser boards automatically ranked harder.
gv3 drops cell-count from the score and removes `minCells`/`maxCells` gates.
Difficulty is intended to reflect choices, appends, forced ratio, and geometry —
not row count.

## Dense-board reality

On 8×7…8×10, solvable candidates naturally show:

- many opening legal moves (often 30–70)
- solution depth roughly proportional to cell count
- overlapping score distributions across EASY/MEDIUM/HARD/EXPERT

`PROFILE_RANGES_GV3` therefore uses **wide overlapping bands**. Campaign rhythm
labels intent; candidate biases (opening pairs / equal bias) nudge readability.
Absolute score alone does not sharply separate profiles on dense boards — this
is documented, not hidden.

## Density vs difficulty

- **Density** (`7|8|9|10`): visual richness / initial rows at width 8
- **Difficulty profile**: reasoning challenge label from rhythm + soft gates

An 8×9 MEDIUM and an 8×7 HARD are both valid product outcomes.

## Commands

```bash
npm run generator:audit:gv3
npm run generator:audit -- --gv3 --density all
npm run campaign:build
npm run campaign:audit
```
