# PHASE 5 — Campaign UI + persistence

Status: **CODE pending AVD** (do not claim physical PASS).

## Architecture

```
SafeAreaProvider → ThemeProvider → AppStateProvider → GameSessionProvider → AppShell
```

| Module | Role |
| --- | --- |
| `src/game/campaign` | Frozen 1000-level catalog (`CAMPAIGN_VERSION`, signature). Reconstruct via generator gv2. |
| `src/storage` | `PersistedRootV1` under `numbermatch.persist.v1`. `PersistRepository` hydrate + revisioned writes. |
| `src/app/AppStateProvider` | Hydrate once, Russian loading UI, campaign start/complete/sync APIs. |
| `src/features/training` | Interactive training on real core boards (no ads). |
| `src/screens/LevelsScreen` | Responsive 1000-level grid. |
| `src/screens/HomeScreen` | Production CTA + DEV fixtures (non-persistent). |
| `src/screens/GameScreen` | Campaign header, completion Next/Replay, persist sync. |

## Campaign versions

- `CAMPAIGN_VERSION` — catalog identity; hydrate drops active session on mismatch.
- `GENERATION_VERSION` (= 2) — must match session `generationVersion`.
- `CAMPAIGN_CATALOG_SIGNATURE` — audit fingerprint of the generated catalog.

Do **not** rebuild the catalog unless intentionally bumping campaign version.

## Persistence schema (`PersistedRootV1`)

| Field | Meaning |
| --- | --- |
| `schemaVersion` | `1` |
| `campaignVersion` | Must match `CAMPAIGN_VERSION` |
| `revision` | Monotonic write counter |
| `trainingCompleted` | Training finished at least once |
| `highestCompletedLevel` | Frontier `0..1000` |
| `activeSession` | At most one campaign session (progression or replay) |

On progression completion: `highestCompletedLevel = max(…, N)`, session `status: completed`, **history discarded** to shrink storage.

DEV fixtures set `sessionSource: 'dev_fixture'` and must **not** write `activeSession`.

## Audit

```bash
npm run campaign:audit
```

## Policy notes

- Undo hidden after campaign completion (UI policy §241); DEV overlay path may still offer Undo.
- Replace confirmation copy for dirty unfinished sessions (§451).
- Training → Level 1 uses `replace` so Back → Home.
- Game / Levels Back → Home.
