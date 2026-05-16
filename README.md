# TM1 Report Writer

A standalone web application for building professional, governed financial report packs from **IBM Planning Analytics (TM1)** cube data.

**[Documentation & Install Guide](https://falconbi.github.io/tm1_report_writer/docs.html)**

This project is fully isolated from the governance suite:

- Dedicated repository
- Independent SQLite database
- Separate TM1 connection configuration

---

> **Compatibility Notice**
> This application has been tested on **IBM Planning Analytics (TM1) on-premises v11 and v12** only.
> Cloud (Planning Analytics as a Service / PAaaS) and other deployment variants are untested and not supported at this time.

---

## Overview

TM1 Report Writer transforms governed TM1 views into structured, version-controlled, export-ready HTML report packs.

It is designed for strict financial governance, auditability, and controlled publishing workflows.

---

## Core Modules

### Builder (`/builder`)

Authoring environment for creating and assembling report packs:

- Reports (TM1-driven tables)
- Notes (rich text + embedded content)
- Visuals (KPI tiles and charts)
- Pack composer (multi-page documents)

### Viewer (`/viewer`)

Read-only interface for end users:

- Displays only **published and confirmed** packs
- A4-style paged layout
- Branded report presentation

### Admin (`/admin`)

Governance and system oversight:

- Audit logs
- Database inspection
- System status and configuration visibility

---

## Key Features

### Reports

- TM1-connected data tables
- Flexible row/column configuration
- Dimension selectors
- Formatting rules
- Live preview

### Notes

- Rich text editing (Tiptap)
- Embedded images and visuals
- Modular content blocks

### Visuals

- KPI tiles
- Charts powered by TM1 data

### Packs

- Multi-page report composition
- Page-level backgrounds and overlays
- Footers and layout controls

---

## Governance Model

### Publishing Workflow

Draft → Ready → Confirmed → Published

- Only **Confirmed** artifacts can be published
- Packs enforce dependency validation before publishing
- Published versions are immutable snapshots

### Artifact States

- Draft (Grey)
- Ready (Blue)
- Confirmed (Green)
- Pending Changes (Yellow)

---

## Architecture

### Frontend

- React 18 + TypeScript + Vite
- Zustand state management
- React Router 6
- Tailwind CSS

### Backend

- FastAPI (Python 3.12)
- Uvicorn ASGI server
- SQLModel + SQLite
- TM1py integration

### Data Model

- SQLite-based persistence
- Versioned artifacts
- Audit logging per action

---

## TM1 Integration

- Uses TM1py for secure connectivity
- Only `SYS`-prefixed views are exposed
- MDX queries are safely constructed
- Supports impersonation via OIDC identity

Example:

```python
import os, requests

base = f"http://{os.getenv('TM1_ADDRESS')}:{os.getenv('TM1_PORT')}/tm1"

auth = requests.post(
    f"{base}/auth/v1/session",
    auth=(os.getenv("TM1_CLIENT_ID"), os.getenv("TM1_CLIENT_SECRET")),
    json={"User": os.getenv("TM1_USER")},
)
token = auth.cookies["TM1SessionId"]
```

---

## Security

- OpenID Connect (OIDC) authentication
- Role-based access: Admin / Builder / Viewer
- No storage of end-user TM1 credentials
- Audit logs tied to authenticated identity
- Secrets managed via environment variables

---

## Quick Start

### Docker (Recommended)

```bash
cp .env.example .env
```

Edit `.env` with your TM1 connection details, then:

```bash
docker compose up -d
```

Open: <http://localhost:8090/builder>

On first run, sample data is automatically loaded into `/data`. Mount a host directory there to persist your data across container restarts.

### Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `TM1_ENABLED` | `false` | Set to `true` to enable live TM1 connection |
| `TM1_ADDRESS` | — | TM1 server hostname or IP |
| `TM1_PORT` | — | TM1 server port |
| `TM1_USER` | — | TM1 service account username |
| `TM1_CLIENT_ID` | — | OAuth2 client ID |
| `TM1_CLIENT_SECRET` | — | OAuth2 client secret |
| `DATA_DIR` | `/data` | Path for SQLite database and uploaded images |

### Local Development

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8080

# Frontend (separate terminal)
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open: <http://localhost:5173/builder>

---

## Project Status

Active development system designed for enterprise-grade financial reporting with strict governance, auditability, and TM1 integration control.
