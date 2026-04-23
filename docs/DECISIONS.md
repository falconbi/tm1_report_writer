# Design Decisions Log

This file records deliberate design decisions, especially reversals and removals.
**Claude must read this before making any change to DB models, lifecycle logic, or status fields.**

---

## Artifact Status Lifecycle — 3-state (Apr 20 2026, commit e3bf0f9)

**Decision:** Simplified from 4-state to 3-state. Removed confirm/ready-to-confirm concept entirely.

**Current model:**
```
Grey  = draft,     has_draft=false  (never published)
Green = published, has_draft=false  (clean, usable in packs)
Yellow = published, has_draft=true  (edited since last publish, blocked from packs)
```

**DB fields that implement this:** `status` (draft|published) + `has_draft` (bool). That's it.

**Deliberately removed — do NOT re-add:**
- `is_confirmed` — removed from reports, visuals, notes tables and models
- `ready_to_confirm` — removed from reports, visuals, notes tables and models
- `confirmed_at` — removed
- `confirmed_by` — removed
- `confirmed_selectors` — removed from reports table only

These were dropped from the SQLite DB on Apr 23 2026 after being orphaned by the lifecycle simplification.

**Pack publish rule:** All artifacts in a pack must be Green (published, no pending changes). Grey or Yellow blocks publish.

---

## Notes Frontend Removed (Apr 2026)

**Decision:** Notes tab and UI removed from the frontend. The Notes backend (router + DB table) still exists but is unused by the UI.

**Do not:** Re-add Notes to the frontend sidebar, composer, or any picker without a deliberate decision to restore the feature.

**Backend files still present (not yet cleaned up):**
- `backend/routers/notes_router.py`
- `notes` table in DB

---

## Pack Layout — Two Parallel Structures (current)

**Decision:** Packs maintain two separate structures that must stay in sync:
- `statements: string[]` — flat ordered list of artifact IDs (legacy, viewer falls back to this)
- `layout: PackPage[]` — full composer section/slot structure

Artifacts added via PackEditor go into `statements` only. The composer builds `layout`. Both are saved together on every draft/publish.

**Do not collapse** these into one structure — the viewer handles orphan statements (in statements but not in layout) by appending them as full-width rows.

---

## SYS View Filter (current)

**Decision:** View picker in Source tab filters to views starting with `SYS` only. No ad-hoc MDX or unrestricted view access from the builder.

---

## MDX WHERE Clause — Hierarchy Name Not Member Name (current)

**Decision:** The WHERE clause override uses `axes_raw[2]['Hierarchies'][i]['Name']` for the dimension name. Using the member name was a prior bug — do not revert.

---

## Tiptap Table Cell Formatting — Removed (current)

**Decision:** Cell fill/border styling via Tiptap toolbar was removed. The combination of ProseMirror focus model, React state staleness, and bundled module copies of `CellSelection` is too brittle. Use a published Report slot in a Note instead of Tiptap tables with formatting.

---

## CSV Source Sentinel (Apr 23 2026)

**Decision:** CSV-sourced reports use `cube = '__csv__'` and `view = filename` as sentinel values. CanvasPanel guards against TM1 fetch when `cube === '__csv__'`. The dataset is stored via `setDataset()` directly from SourceTab, not fetched from TM1.

---

## Rule for Claude

Before touching any of the following, read this file AND check `git log --oneline` first:
- DB models (`backend/db/models.py`)
- Status/lifecycle logic
- Pack statements vs layout
- Any field that looks "missing" from a model

A missing field may be **deliberately removed**. Always verify in git history before adding it back.
