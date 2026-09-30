# Future monetization (RСЯ) — product note only

Not implemented in Campaign v2. Geometry and help-policy hooks only.

## Planned surfaces

- Sticky small banner on **Game** (geometry reserved now via BannerSlot)
- Banners on Home / Levels / Settings / future Statistics
- **Training: no ads**

## Help policy (future)

- First Hint per attempt: free
- Additional Hint: rewarded opportunity
- First Undo per attempt: free
- Additional Undo: rewarded opportunity
- Watching an ad does **not** preserve clean-run stars — `usedHint` / `usedUndo` still apply

## Interstitial (future)

ForestMusic baseline:

- Rare / time-action gated
- Not before completion feedback
- Not on Training
- Not every level

## Rewarded failure

If rewarded ad fails or is unavailable: do not consume entitlement and do not mutate game.

## Levels

All 1000 Campaign levels remain free (no ad/purchase gate).
