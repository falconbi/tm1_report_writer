# TM1 Report Writer — Agent Guide

## Commands

```bash
# Backend
cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8080

# Frontend dev
cd frontend && npm run dev -- --host 0.0.0.0   # http://localhost:5173

# Type check frontend
cd frontend && npx tsc --noEmit
```

No backend typecheck or lint tools configured.

## Core Project Purpose
A standalone web app that turns governed TM1 cube data into clean, professional, exportable HTML report packs with proper governance.

## Architecture
- **Two apps in one repo**: FastAPI backend (port 8080) + React/Vite frontend (port 5173)
- **API base URL** (`frontend/src/lib/api.ts`): `http://${window.location.hostname}:8080`
- **Backend starts on demand**: `load_dotenv()` in `main.py` loads `.env` at runtime
- **SQLite DB**: `backend/data/database.db` (or `$DATA_DIR/database.db` when set)

## Data Model

### Publish Lifecycle (Most Important)
- `definition` = current working draft (always editable)
- `published_definition` = immutable snapshot shown to viewers
- `status` = "draft" or "published"
- `has_draft` = true when a published report has unpublished changes
- Never collapse `status` and `has_draft` into one field
- When publishing: archive old version → save clean snapshot to `published_definition` → set `has_draft = false`

### Status Indicators
- `draft` = never published
- `•` yellow dot = published, has pending changes
- clean = published, no pending changes

## Content Model (Pages, Notes, Sections, Slots)

### Hierarchy
```
Page
└── Sections (ordered)
    └── Slot (one per section)
        └── Artifact: Report | Visual | Note | Image | Text
```

- **Section** = a row/block that holds one Slot, with a layout preset (100%, 50-50, 66-33, 33-66, thirds)
- **Slot** = holds ONE artifact
- **Note** = internally structured like a Page — has sections/slots. Can be embedded in a Page slot or a Note slot (but NOT recursively — no Note within a Note within a Note)
- **Page** = full page in a Pack, also has sections/slots

### Governance / Publishing Rules
Every artifact has a lifecycle: `draft` → `published`. A Note can only be published if ALL embedded artifacts are already published:
- Report in a Note slot → Report must be published
- Visual in a Note slot → Visual must be published
- Image in a Note slot → Image must be published
- Text in a Note slot → always OK (no lifecycle)

This applies recursively: if a Page embeds a Note, that Note must be published first. The same rule applies for Pages embedding Notes.

### NoteDefinition JSON Schema
Notes store `JSON.stringify(NoteDefinition)` in the `content` field. The structure is:
```json
{
  "cardBackground": "#ffffff",
  "sections": [
    {
      "id": "uuid",
      "preset": "full" | "half" | "two-thirds" | "third-two-thirds" | "thirds",
      "slots": [
        {
          "id": "uuid",
          "type": "text",
          "html": "<p>Tiptap HTML…</p>"
        },
        {
          "id": "uuid",
          "type": "image",
          "imageFilename": "uuid-filename.png",
          "imageName": "Display Name"
        },
        {
          "id": "uuid",
          "type": "visual",
          "visualId": "uuid",
          "visualTitle": "KPI: Revenue"
        },
        {
          "id": "uuid",
          "type": "report",
          "reportId": "uuid",
          "reportTitle": "P&L Summary"
        }
      ]
    }
  ]
}
```
- `preset="full"`: 1 slot (100% width)
- `preset="half"`: 2 slots (50/50)
- `preset="two-thirds"`: 2 slots (66/33)
- `preset="third-two-thirds"`: 2 slots (33/66)
- `preset="thirds"`: 3 slots (33/33/33)
- `type="text"`: rich text via Tiptap, `html` field holds HTML
- `type="image"`: image picked from library, stored by filename
- `type="visual"`: reference to a published Visual
- `type="report"`: reference to a published Report
- `parseNoteContent()` in the frontend handles both the new JSON format and legacy HTML notes (backward compatible)

## Backend Structure

Routers mounted in `main.py`:
- `tm1_router` — cubes, views, members
- `reports_router` — report CRUD, dataset, confirm
- `packs_router` — pack CRUD, publish validation
- `notes_router` — notes (JSON content in `content` field)
- `visuals_router` — KPI + chart definitions
- `images_router` — image upload/list/rename/delete, files stored in `backend/data/images/`
- `admin_router` — stats, audit, schema

## Frontend Tech Notes
- **Tailwind v4** uses `@tailwindcss/postcss` in postcss.config.js (not tailwind.config.js)
- **React 19** + TypeScript 5.9 + Zustand for state
- **Tiptap** for rich text (note text slots)
- **Recharts** for charts (visuals)
- No dedicated test suite configured

## Key Gotchas
- **MDX WHERE clause**: uses `axes_raw[2]['Hierarchies'][i]['Name']` for dimension name, NOT member name. Prior bug — do not revert.
- **Selector role field**: must default to `'none'` when initialising from dataset axis 2.
- **Two Vite instances**: port conflicts from stale processes. `ps aux | grep vite` → `kill <pid>`.
- **Backend port**: `fuser -k 8080/tcp` more reliable than `pkill` for clearing the port.
- **No ad-hoc MDX**: view picker filters to `SYS` prefix only.
- **Published reports are immutable**: viewer always reads `published_definition`.
- **Note content field**: stores `JSON.stringify(NoteDefinition)` — NOT raw HTML (frontend owns the structure).

## Environment Variables

| Variable | Purpose |
|---|---|
| `TM1_ADDRESS` | TM1 server host |
| `TM1_PORT` | TM1 port (default 8001) |
| `TM1_USER` | Username |
| `TM1_PASSWORD` | Password |
| `TM1_SSL` | `True`/`False` |
| `TM1_NAMESPACE` | CAM namespace (optional) |
| `DATA_DIR` | Override SQLite DB path (Docker) |

## Database Migration Pattern

`backend/db/database.py` uses `ALTER TABLE` with `try/except pass` for safe schema evolution — old DBs get new columns automatically. Do not drop and recreate tables for minor schema changes.
