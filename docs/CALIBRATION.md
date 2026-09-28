# Provisional difficulty calibration (v1)

## Broad sample

After fixing zero-opening candidates (post-shuffle adjacent pair placement),
sampled seeds under each profile showed natural clustering by:

- `initialCells` (from profile shape)
- `solutionActionCount`
- `choiceStates`
- `appendActionCount`
- provisional `difficultyScore`

`exploredStates` kept as raw evidence only (solver-order sensitive).

## Score formula

```
cells*0.7 + depth*1.5 + choiceStates*2.4 + peakBranching*1.2
+ appends*7 + diagonalOnly*3 + linearOnly*3.5
+ (deadEndRatio??0)*18 - forcedRatio*6
```

## Observed full-audit medians (baseSeed 10000)

| metric | EASY | MEDIUM | HARD | EXPERT |
| --- | --- | --- | --- | --- |
| cells | 14 | 21 | 28 | 35 |
| depth | 9 | 15 | 20 | 25 |
| choices | 6 | 11 | 15 | 20 |
| score | 61.5 | 107.4 | 144.6 | 186.1 |
| maxRows | 4 | 5 | 6 | 7 |

Monotone separation holds on these independent metrics.

## Recommended production width

**Width 7** for mid/hard content; EASY uses width **5**, MEDIUM **6**.
For a single first-release campaign width, prefer **6** as the compromise between
readability and depth diversity — final product decision deferred.

## Stable vs provisional

Stable: core rules, generationVersion, PRNG, fingerprint semantics.  
Provisional: profile thresholds, guards, mobile row caps, dead-end analysis.
