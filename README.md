# TM1 Report Writer

A standalone web application for building professional, governed financial report packs from **IBM Planning Analytics (TM1)** cube data.

This project is fully isolated from the governance suite:
- Dedicated repository
- Independent SQLite database
- Separate TM1 connection configuration

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
from TM1py import TM1Service
import os

tm1 = TM1Service(
    base_url=os.getenv("TM1_BASE_URL"),
    user=os.getenv("TM1_SERVICE_USER"),
    password=os.getenv("TM1_SERVICE_SECRET"),
    impersonate=current_user_tm1_username,
    async_requests_mode=True,
    ssl=True,
    verify=True
)
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

### Backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open:
http://localhost:5173/builder

---

## Roadmap

### Phase 1 – Image Library
- Upload API
- Image storage and retrieval
- Builder integration

### Phase 2 – Pack Layout Upgrade
- PackPage[] structure
- Page-level styling
- Improved composer UX

### Phase 3+
- A4 print-ready rendering
- PDF export (WeasyPrint)
- Advanced layout controls
- Docker deployment

---

## Project Status

Active development system designed for enterprise-grade financial reporting with strict governance, auditability, and TM1 integration control.
