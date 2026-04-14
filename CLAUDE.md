# TM1 Report Writer — Claude Code Project Brief

**Last updated:** 2026-04-08
**Status:** Active development
**Location:** `~/apps/tm1_report_writer/`

---

## What This Is

A standalone financial reporting application. Turns governed TM1 cube data into polished, exportable, professional-grade HTML report packs.

**Separate from the governance suite** (`~/apps/tm1_governance/`) — own repo, own process, own database. TM1 connection is copied not shared.

**Two modes:**

- **Builder** (`/builder`) — admin/power user designs reports, manages packs, publishes
- **Viewer** (`/viewer`) — finance user reads published report packs
- **Admin** (`/admin`) — governance view, DB stats, audit log, schema

---

## Commands

```bash
# Start backend
cd ~/apps/tm1_report_writer/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8080

# Start frontend (dev)
cd ~/apps/tm1_report_writer/frontend
npm run dev -- --host 0.0.0.0
# Runs on http://localhost:5173

# Type check
cd frontend && npx tsc --noEmit
```

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | FastAPI 0.135 + Python 3.12 |
| ASGI | Uvicorn |
| Database | SQLite via SQLModel 0.0.38 + SQLAlchemy 2.0 |
| TM1 connection | TM1py 2.2.4 + raw requests.Session |
| Frontend | React 18 + TypeScript + Vite |
| State | Zustand |
| Routing | React Router 6 |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |

---

## Architecture

```text
frontend/src/
├── pages/
│   ├── BuilderPage.tsx        ← /builder
│   ├── ViewerPage.tsx         ← /viewer
│   ├── AdminPage.tsx          ← /admin
│   └── PackComposerPage.tsx   ← /builder/packs/:packId
├── components/
│   ├── builder/
│   │   ├── AppBar.tsx
│   │   ├── CanvasPanel.tsx    ← fetches dataset, renders preview
│   │   ├── PropertiesPanel.tsx ← tab container (Source/Columns/Rows/Format/CF)
│   │   ├── ReportListPanel.tsx ← Reports + Packs + Notes + Visuals sidebar tabs
│   │   ├── SourceTab.tsx
│   │   ├── ColumnsTab.tsx
│   │   ├── RowsTab.tsx
│   │   ├── FormatTab.tsx
│   │   ├── PackEditor.tsx     ← modal for adding artifacts to packs
│   │   ├── NoteEditor.tsx     ← full-screen note composer
│   │   └── VisualEditor.tsx   ← KPI + chart builder
│   └── shared/
│       ├── ReportRenderer.tsx ← pure table renderer (definition + dataset → HTML)
│       ├── VisualRenderer.tsx ← KPI + chart renderer
│       ├── SelectorBar.tsx    ← context dimension dropdowns
│       └── ColourPicker.tsx
├── store/
│   └── useReportStore.ts      ← Zustand store (definition + dataset + reportList)
├── types/
│   └── report.ts              ← all TypeScript types
├── lib/
│   └── api.ts                 ← all API calls (BASE = window.location.hostname:8080)
└── main.tsx                   ← routes: /builder, /viewer, /admin, /builder/packs/:id

backend/
├── main.py                    ← FastAPI app, DB init on startup
├── db/
│   ├── database.py            ← SQLite engine, DATA_DIR env var, get_session()
│   └── models.py              ← Report, ReportVersion, Pack, PackVersion, Note, Visual, EditLock, AuditLog
├── routers/
│   ├── reports_router.py      ← /api/reports/*
│   ├── packs_router.py        ← /api/packs/*
│   ├── notes_router.py        ← /api/notes/*
│   ├── visuals_router.py      ← /api/visuals/*
│   ├── tm1_router.py          ← /api/tm1/cubes, views, members
│   └── admin_router.py        ← /api/admin/stats, reports, packs, audit, schema
├── services/
│   └── dataset_service.py     ← fetches TM1 view data, MDX WHERE clause for overrides
├── core/                      ← TM1 connection (tm1_connect.py)
└── data/
    └── database.db            ← SQLite DB (DATA_DIR env var overrides path for Docker)
```

---

## Data Model

### Publish Lifecycle

```text
New report → Save Draft → status=draft, has_draft=true
           → Publish   → status=published, has_draft=false
                          previous published archived to report_versions
                          published_definition saved as clean snapshot

Published report → Edit → Save Draft → has_draft=true (status stays published)
                        → Publish    → archives old, replaces live, has_draft=false
```

**Published = immutable** — viewers always see `published_definition`.
**Draft alongside published** — builder edits `definition`, viewer reads `published_definition`.

### Status indicators (sidebar)

- `draft` — never published
- `•` yellow dot — published, has unsaved changes
- clean — published, no pending changes

### Packs

- Pack = ordered list of artifact IDs (`statements: string[]`) + section-based layout (`layout: PackSection[]`)
- Artifacts = reports, notes, visuals — all mixed in a pack
- Publish validation — all referenced artifacts must be published and confirmed
- Pack publish archives previous version to `pack_versions`
- Draft pack visible in builder only, not in viewer
- **PackEditor** — modal for adding/removing artifacts (statements list)
- **PackComposer** — full-page layout editor using section presets

### Selector Roles (Roll Forward placeholder)

Each selector has a `role` field: `none | current_period | prior_period | prior_year | budget_period | custom`
Used by Roll Forward (not yet built) to map period values across all reports in a pack.

---

## Database Tables

| Table | Purpose |
| --- | --- |
| `reports` | One row per report — metadata + latest definition JSON + published_definition JSON |
| `report_versions` | Immutable archive of every published version |
| `packs` | One row per pack — metadata + ordered statements JSON + layout JSON |
| `pack_versions` | Immutable archive of every published pack version |
| `notes` | One row per note — metadata + content HTML + published_content HTML |
| `visuals` | One row per visual — metadata + definition JSON + published_definition JSON |
| `edit_locks` | Pessimistic locking (table exists, UI not built yet) |
| `audit_log` | Every save/publish/delete action with timestamp |

---

## Key Gotchas

- **DATA_DIR** — SQLite path controlled by env var. Default: `backend/data/database.db`. Override for Docker.
- **API base URL** — `window.location.hostname:8080` — works from any machine on the network, not just localhost.
- **SYS views only** — view picker filters to `SYS` prefix. No ad-hoc MDX from the builder.
- **MDX WHERE clause** — uses `axes_raw[2]['Hierarchies'][i]['Name']` for dimension name, NOT member name. Prior bug — don't revert.
- **Two Vite instances** — if port conflicts occur, check for stale Vite processes (`ps aux | grep vite`). Kill old ones before starting new.
- **Backend restart** — `fuser -k 8080/tcp` is more reliable than `pkill` for clearing the port.
- **Selector role field** — must default to `'none'` when initialising selectors from dataset axis 2, otherwise TypeScript errors.
- **hasDraft vs status** — `status` field is `draft|published`. `has_draft` bool tracks unpublished changes on published reports. Both needed — don't collapse into one field.
- **Pack statements vs layout** — `statements` is the flat ordered list of artifact IDs. `layout` is the Composer section structure. Both must be kept in sync on save/publish. Artifacts added via PackEditor go into `statements` only — viewer handles orphan statements (not in layout) by appending them as full-width rows.
- **Viewer always re-fetches pack** — `handleSelectPack` calls `api.getPack()` fresh rather than using stale list data.
- **Tiptap table cell formatting** — do NOT attempt custom cell fill/border styling via Tiptap toolbar. The combination of ProseMirror focus model, React state staleness, and bundled module copies of `CellSelection` makes this extremely brittle. If tables are needed in a note, use a published Report as a slot instead.

---

## API Routes

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/tm1/cubes` | List non-system cubes |
| GET | `/api/tm1/views` | List SYS views for a cube |
| GET | `/api/tm1/members` | List elements for a dimension |
| GET | `/api/reports/dataset` | Execute view → JSON dataset |
| GET | `/api/reports/list` | All reports with status/hasDraft |
| GET | `/api/reports/definitions/{id}` | Load definition (draft or published) |
| POST | `/api/reports/definitions/{id}/draft` | Save draft |
| POST | `/api/reports/definitions/{id}/publish` | Publish (archives previous) |
| DELETE | `/api/reports/definitions/{id}` | Delete report |
| GET | `/api/reports/definitions/{id}/history` | List published versions |
| GET | `/api/packs/list` | All packs |
| GET | `/api/packs/{id}` | Get pack |
| POST | `/api/packs/{id}/draft` | Save pack draft |
| POST | `/api/packs/{id}/publish` | Publish pack (validates all artifacts published + confirmed) |
| DELETE | `/api/packs/{id}` | Delete pack |
| GET | `/api/packs/picker/reports` | Published reports for pack picker |
| GET | `/api/packs/picker/notes` | Published notes for pack picker |
| GET | `/api/packs/picker/visuals` | Published visuals for pack picker |
| GET | `/api/notes/list` | All notes |
| GET | `/api/notes/{id}` | Get note (draft or published) |
| POST | `/api/notes/` | Create new note |
| POST | `/api/notes/{id}/draft` | Save note draft |
| POST | `/api/notes/{id}/publish` | Publish note |
| POST | `/api/notes/{id}/confirm` | Confirm note commentary |
| DELETE | `/api/notes/{id}` | Delete note |
| GET | `/api/visuals/list` | All visuals |
| GET | `/api/visuals/{id}` | Get visual |
| POST | `/api/visuals/` | Create new visual |
| POST | `/api/visuals/{id}/draft` | Save visual draft |
| POST | `/api/visuals/{id}/publish` | Publish visual |
| POST | `/api/visuals/{id}/confirm` | Confirm visual data |
| DELETE | `/api/visuals/{id}` | Delete visual |
| GET | `/api/admin/stats` | DB stats + counts |
| GET | `/api/admin/reports` | All reports (admin view) |
| GET | `/api/admin/packs` | All packs (admin view) |
| GET | `/api/admin/audit` | Audit log |
| GET | `/api/admin/schema` | Live DB schema from sqlite_master |

---

## Note Object — Design Decisions (2026-04-08)

Notes are flexible content cards rendered in packs. Key design decisions agreed:

### Structure

- A note is a **card** — never spans more than one page
- If content exceeds one page height the author is **warned in the builder** — no scrolling in viewer
- Notes have **flexible sections** stacked vertically — same concept as the pack composer
- Each section has a layout preset (full, half/half, 66/33 etc)

### Slot types per section

Each slot in a note section can be one of:

- **Text** — Tiptap rich text (headings, bold, italic, lists, links — no table formatting)
- **Image** — picked from the shared image library
- **Chart/Visual** — picked from the existing visuals library
- **Report** — a published report table (author's responsibility to keep it small enough to fit)

Using a Report slot replaces the need for Tiptap table formatting — do not rebuild cell styling.

### Image library

- Shared asset library — upload once, reuse across any note
- Stored in `backend/data/images/` served as FastAPI static files
- Available as a tab in the builder sidebar
- Upload via file picker, stored server-side with a name/label

### Card styling

- Rendered as a **card** — white/coloured surface, rounded corners, subtle shadow
- Configurable card background colour (per note)
- Sits on a contrasting page background for visual effect

### Tiptap text slots — keep simple

- Headings, bold, italic, underline, strikethrough
- Text colour, highlight
- Bullet lists, numbered lists
- Text alignment
- Hyperlinks
- No table formatting (use Report slot instead)

---

## Next to Build

### Phase 1 — Image Library (prerequisite for notes + page backgrounds)

1. **Image library** — DB table (`images`: id, name, filename, uploaded_at), upload/list/delete endpoints, FastAPI static file serving at `/images/`, builder sidebar tab, reusable picker component

### Phase 2 — Pack Paged Document Layout

2. **Pack page structure** — restructure `layout` from `PackSection[]` to `PackPage[]`. Each `PackPage` contains `{ id, backgroundColour?, backgroundImage?, overlayColour?, overlayOpacity?, sections: PackSection[] }`. Pack-level defaults for background + overlay + footer settings. Migration shim: old flat `PackSection[]` → wrapped into single Page 1 automatically.
3. **Pack composer page UX** — labeled page divider bars (`── Page 2 ── [bg] [delete]`), "Add Section" adds to bottom of current page, "Add Page" inserts new page, up/down arrows reorder sections within a page, "Move to page →" button to shift section to adjacent page
4. **Per-page background panel** — colour picker OR image picker (from library), overlay colour + opacity slider, inherits from pack defaults with per-page override
5. **Pack-level defaults panel** — default background (colour or image), overlay, footer settings (show pack name toggle, show confirmed date toggle, custom text field, show page numbers toggle)

### Phase 3 — Viewer Page Rendering

6. **Viewer paged rendering** — each `PackPage` renders as a fixed A4-proportioned sheet (white card, fixed height, content clipped if overflow), background + overlay applied, pinned footer: `[custom text] · [pack name] · [confirmed date] | Page N / Total`

### Phase 4 — Note Composer Redesign

7. **Note composer redesign** — flexible sections with text/image/chart/report slots, card styling (rounded corners, shadow, configurable background colour), page overflow warning

### Later

8. **Rows/Columns bulk select** — Add All button, remove unwanted
9. **Column Groups** — span headers above columns (type in schema, needs builder UI + renderer)
10. **Conditional Formatting tab** — CFRule type defined, needs builder UI + renderer
11. **Sidebar search** — filter in builder and viewer sidebars
12. **Roll Forward** — copy pack + reports, prompt for period selector values per role
13. **Edit locking** — edit_locks table exists, needs UI
14. **Two-page spread** — side-by-side pages in viewer (phase 2 of document layout)
15. **Docker** — Dockerfile + docker-compose.yml
16. **Authentik OIDC auth** — user identity for owner, audit, locking, access control
16a. **Admin panel user view** — show logged-in users, session tracking, per-user activity
17. **Admin portal enhancements** — filters, click to open report, delete from table
18. **PDF export** — WeasyPrint server-side

### Completed

- Strip Tiptap table toolbar — removed cell fill/border UI, kept insert/add row/col/delete only

## Artifact Status Lifecycle

See **ARTIFACT_STATUS.md** for the official rules governing status for Reports, Notes, Visuals, and Packs.

Key points:
- 4-state lifecycle: Grey (Draft) → Blue (Ready) → Green (Confirmed) → Yellow (Pending Changes)
- Yellow state disables "Save Draft" and requires re-confirmation
- Packs can only be published when all artifacts are Green

## Artifact Status Lifecycle

See **Doc/ARTIFACT_STATUS.md** for the official rules governing status for Reports, Notes, Visuals, and Packs.

Key points:
- 4-state lifecycle: Grey (Draft) → Blue (Ready) → Green (Confirmed) → Yellow (Pending Changes)
- Yellow state disables "Save Draft" and requires re-confirmation
- Packs can only be published when all artifacts are Green
