# Number Match — Rules Decision

Project-specific source of truth for gameplay geometry and board evolution.
Status: **authoritative for generationVersion 2+**.

## Decision summary (PHASE 4 physical QA fix)

| Topic | Decision |
| --- | --- |
| Values | Equal **or** sum to 10 |
| Horizontal / vertical / diagonal | Classic straight clear paths; removed cells allowed between |
| Linear / row-boundary | **Model A** — row-major continuation (kept) |
| Fully empty complete rows | **Collapse in core** after successful `removePair` |
| Partial final row | Not a complete row; collapse only if every *existing* cell is removed (trim) |
| UI vs core | UI must truthfully show core coordinates; no cosmetic row compression |
| generationVersion | **1 → 2** (successor boards change under collapse) |

### Why not UI-only?

Physical OPPO QA showed identical values that looked like an “obvious pair” across a
large blank region. Root causes were **combined**:

1. Removed cells rendered as invisible voids (no spatial grid).
2. Fully empty rows remained in core forever, creating real multi-row gaps.
3. Layout was already top-stacked (no `space-between`); the “huge hole” was mostly
   invisible empty geometry, not React distributing rows.

Training text alone cannot fix invisible geometry. Empty-row collapse is a **core
rule**, not a React transform. Visible empty slots remain required inside
non-empty rows.

### Linear Model A (retained)

Two distinct indices are linearly connectable when every cell strictly between
them in row-major order is removed. This includes:

- classic end-of-row → start-of-next-row;
- longer spans when the entire middle is empty.

It does **not** include same-row left↔right wrap.

After empty-row collapse, long multi-empty-row linear spans become rare because
those rows are removed from the board; adjacent-row continuation remains.

### Empty-row collapse (new)

After a successful pair removal:

1. Mark both endpoints removed (stable cell IDs preserved).
2. Drop every **complete** row (`width` cells) where every cell is removed.
3. If the **partial final row** exists and every existing cell in it is removed,
   drop that trailing segment (trim).
4. Do not invent cells for missing partial-row columns.

Collapse runs inside production `removePair` so solver/generator/UI share one
successor function. Undo restores pre-collapse snapshots.

---

## Value rule

Two **active** cells may match when:

- `a.value === b.value`, **or**
- `a.value + b.value === 10`.

Value compatibility alone is **not** a legal move.

## Geometry rule

Endpoints must be connectable by at least one of:

### Horizontal

Same row; every cell strictly between on that row is removed.

```
6 . . 6     → legal (equal)
2 . 8       → legal (sum 10)
2 5 8       → illegal (5 blocks)
```

### Vertical

Same column; every cell strictly between in that column is removed.

```
3 .
. .
7 .         → legal if middle removed
```

### Diagonal

`|Δrow| === |Δcol|` and ≥ 1; intermediates on that diagonal removed.

### Linear / row-boundary (Model A)

Every index strictly between the endpoints in row-major order is removed.

```
width 3:
1 2 3
7 5 6
```

`3` ↔ `7` is legal (linear only; not H/V/diagonal).

### Same values, wrong geometry (physical-gap class)

```
width 5:
2 6 . . .
. . . 2 6
```

- `2`↔`2`: not H/V; `|Δrow|=1`, `|Δcol|=3` → not diagonal; linear blocked by `6`.
- `6`↔`6`: same.
- Expected: **no legal moves** (Add).
- Values are compatible; geometry is not.

### Empty complete rows — before / after collapse

Before (mid-removal, conceptual):

```
1 9 3
. . .
2 8 4
```

After removing `1`↔`9` if that cleared nothing else… (illustrative post-state):

If a complete middle row is all removed:

```
before collapse:
1 . 3
. . .
2 8 4

after collapse:
1 . 3
2 8 4
```

Coordinates of surviving cells change; **cell IDs do not**.

### Partial final row

```
1 2 3 4 5 6 7
8 9 1
```

Missing columns 4–7 on row 2 are **not** cells. Collapse never treats them as
removed slots.

If the partial row is entirely removed (all existing cells removed), it is
trimmed from the end.

### Append

`appendRemainingNumbers` copies **current active** values in current row-major
order onto the end of the **normalized** board. Historical pre-collapse
coordinates are irrelevant.

---

## Explicit non-goals

- Knight / L / multi-turn paths
- Same-row torus wrap
- UI-only row compression that lies about coordinates
- Permanent highlight of all legal moves

## Versioning

- `generationVersion` **2**: empty-row collapse changes puzzle successors for the
  same initial board under play/solve.
- `difficultyProfileVersion`: reassess after gv2 audit; bump only if thresholds
  must change.
