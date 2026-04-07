# TM1 Report Writer — Claude Code Project Brief

**Last updated:** April 2026
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
|---|---|
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

```
frontend/src/
├── pages/
│   ├── BuilderPage.tsx       ← /builder
│   ├── ViewerPage.tsx        ← /viewer
│   └── AdminPage.tsx         ← /admin
├── components/
│   ├── builder/
│   │   ├── AppBar.tsx
│   │   ├── CanvasPanel.tsx   ← fetches dataset, renders preview
│   │   ├── PropertiesPanel.tsx ← tab container (Source/Columns/Rows/Format/CF)
│   │   ├── ReportListPanel.tsx ← Reports + Packs sidebar tabs
│   │   ├── SourceTab.tsx
│   │   ├── ColumnsTab.tsx
│   │   ├── RowsTab.tsx
│   │   ├── FormatTab.tsx
│   │   └── PackEditor.tsx    ← modal for creating/editing packs
│   └── shared/
│       ├── ReportRenderer.tsx ← pure table renderer (definition + dataset → HTML)
│       ├── SelectorBar.tsx   ← context dimension dropdowns
│       └── ColourPicker.tsx
├── store/
│   └── useReportStore.ts     ← Zustand store (definition + dataset + reportList)
├── types/
│   └── report.ts             ← all TypeScript types
├── lib/
│   └── api.ts                ← all API calls (BASE = window.location.hostname:8080)
└── main.tsx                  ← routes: /builder, /viewer, /admin

backend/
├── main.py                   ← FastAPI app, DB init on startup
├── db/
│   ├── database.py           ← SQLite engine, DATA_DIR env var, get_session()
│   └── models.py             ← Report, ReportVersion, Pack, PackVersion, EditLock, AuditLog
├── routers/
│   ├── reports_router.py     ← /api/reports/*
│   ├── packs_router.py       ← /api/packs/*
│   ├── tm1_router.py         ← /api/tm1/cubes, views, members
│   └── admin_router.py       ← /api/admin/stats, reports, packs, audit, schema
├── services/
│   └── dataset_service.py    ← fetches TM1 view data, MDX WHERE clause for overrides
├── core/                     ← TM1 connection (tm1_connect.py)
└── data/
    └── database.db           ← SQLite DB (DATA_DIR env var overrides path for Docker)
```

---

## Data Model

### Publish Lifecycle
```
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
- Pack = ordered list of report IDs (`statements: string[]`)
- Publish validation — all referenced reports must be published
- Pack publish archives previous version to `pack_versions`
- Draft pack visible in builder only, not in viewer

### Selector Roles (Roll Forward placeholder)
Each selector has a `role` field: `none | current_period | prior_period | prior_year | budget_period | custom`
Used by Roll Forward (not yet built) to map period values across all reports in a pack.

---

## Database Tables

| Table | Purpose |
|---|---|
| `reports` | One row per report — metadata + latest definition JSON + published_definition JSON |
| `report_versions` | Immutable archive of every published version |
| `packs` | One row per pack — metadata + ordered statements JSON |
| `pack_versions` | Immutable archive of every published pack version |
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

---

## API Routes

| Method | Path | Description |
|---|---|---|
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
| POST | `/api/packs/{id}/publish` | Publish pack (validates all reports published) |
| DELETE | `/api/packs/{id}` | Delete pack |
| GET | `/api/packs/picker/reports` | Published reports for pack picker |
| GET | `/api/admin/stats` | DB stats + counts |
| GET | `/api/admin/reports` | All reports (admin view) |
| GET | `/api/admin/packs` | All packs (admin view) |
| GET | `/api/admin/audit` | Audit log |
| GET | `/api/admin/schema` | Live DB schema from sqlite_master |

---

## Next to Build

1. **Rows/Columns bulk select** — Add All button, remove unwanted
2. **Column Groups** — span headers above columns (type in schema, needs builder UI + renderer)
3. **Conditional Formatting tab** — CFRule type defined, needs builder UI + renderer
4. **Viewer grouped by pack** — sidebar shows packs, reports nested underneath
5. **Sidebar search** — filter in builder and viewer sidebars
6. **Note / Chart / KPI page types** — pageType field, separate builder flows
7. **Roll Forward** — copy pack + reports, prompt for period selector values per role
8. **Edit locking** — edit_locks table exists, needs UI
9. **Docker** — Dockerfile + docker-compose.yml
10. **Authentik OIDC auth** — user identity for owner, audit, locking, access control
11. **Admin portal enhancements** — filters, click to open report, delete from table
12. **PDF export** — WeasyPrint server-side
