# Tutorial candidates (provisional)

Curated deterministic boards in `src/game/generator/tutorialCandidates.ts`.
Not final campaign levels 1–10.

| # | Learning goal | seed | mechanic |
| --- | --- | --- | --- |
| 1 | equal pair | 9001 | equal |
| 2 | sum to 10 | 9002 | sum10 |
| 3 | pair through removed | 9003 | gap-horizontal |
| 4 | horizontal | 9004 | horizontal |
| 5 | vertical | 9005 | vertical |
| 6 | diagonal | 9006 | diagonal |
| 7 | row-boundary linear | 9007 | linear-only |
| 8 | multi-step | 9008 | multi-step |
| 9 | simple append | 9009 | append |
| 10 | mixed | 9010 | mixed |

All are solver `solved` + replay-validated via production core.
