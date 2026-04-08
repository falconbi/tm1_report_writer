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

No backend typecheck or lint tools are configured.

## Core Project Purpose
A standalone web app that turns governed TM1 cube data into clean, professional, exportable HTML report packs with proper governance.

## Architecture

- **Two apps in one repo**: FastAPI backend (port 8080) + React/Vite frontend (port 5173)
- **API base URL** (`frontend/src/lib/api.ts`): `http://${window.location.hostname}:8080` — resolves from the browser, works across the network, not just localhost
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

### Status indicators
- `draft` = never published
- `•` yellow dot = published, has pending changes
- clean = published, no pending changes

## Key Gotchas

- **MDX WHERE clause**: uses `axes_raw[2]['Hierarchies'][i]['Name']` for dimension name, NOT member name. Prior bug — do not revert.
- **Selector role field**: must default to `'none'` when initialising from dataset axis 2.
- **Two Vite instances**: port conflicts from stale processes. `ps aux | grep vite` → `kill <pid>`.
- **Backend port**: `fuser -k 8080/tcp` more reliable than `pkill` for clearing the port.
- **No ad-hoc MDX**: view picker filters to `SYS` prefix only.
- **Published reports are immutable**: viewer always reads `published_definition`.

## Backend Structure

Routers mounted in `main.py`:
- `tm1_router` — cubes, views, members
- `reports_router` — report CRUD, dataset, confirm
- `packs_router` — pack CRUD, publish validation
- `notes_router` — rich text notes (Tiptap HTML)
- `visuals_router` — KPI + chart definitions
- `admin_router` — stats, audit, schema

## Frontend Tech Notes

- **Tailwind v4** uses `@tailwindcss/postcss` in postcss.config.js (not tailwind.config.js)
- **React 19** + TypeScript 5.9 + Zustand for state
- **Tiptap** for rich text (notes)
- **Recharts** for charts (visuals)
- No dedicated test suite configured

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
