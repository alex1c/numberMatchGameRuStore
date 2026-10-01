# Monetization + AppMetrica (implemented)

All 1000 Campaign levels remain free. Training is ad-free.

## Surfaces

| Placement | Block ID | Screens |
|-----------|----------|---------|
| game | R-M-20145948-1 | Game (sticky bottom) |
| home_levels | R-M-20145948-2 | Home, Levels |
| secondary | R-M-20145948-3 | Settings, About |
| interstitial | R-M-20145948-4 | After completion Next/Home when eligible |
| rewarded | R-M-20145948-5 | Extra Hint / Undo |

Training and Density Lab: **no ads**.

## Rewarded help lifecycle (physical QA fix)

Do **not** recover UI solely from `await ad.show()` — on some Android devices
the promise never settles after close (ForestMusic `REWARDED_GAME_RELEASE`).

Settlement is driven by:

- verified `onRewarded` (only grant path, once);
- dismiss / fail-to-show;
- short grace for close→reward ordering;
- fail-safe timeout (never invents a reward).

UI phases:

- ad loading/showing → status `Загрузка рекламы…` (Hint button disabled, **not** `Ищу…`);
- after reward → Hint computation → `Ищу…`;
- every terminal path clears ad busy.

Free entitlement uses existing schema v2 `usedHint` / `usedUndo` (set only on
delivered help). Transient ad transaction state is never persisted.

## Interstitial gate (process session)

- ≥5 Campaign level completions
- ≥5 minutes since session start (monotonic)
- max 1 per app process
- never Training; only post-completion Next/Home
- rewarded interaction suppresses until next level start

## Privacy / RuStore (release checklist — not done in this phase)

- Privacy policy must mention AppMetrica analytics + Yandex advertising
- RuStore data-safety declarations for analytics/ads as required by current flow

## Native rebuild

Ads + AppMetrica require a new Android dev-client / native build after `expo prebuild`.
