# TM1 Report Writer

A standalone web application for building professional, governed financial report packs from IBM Planning Analytics (TM1) data.

### Features
- Builder mode – Design reports with tables, notes, charts, and KPIs
- Viewer mode – Clean read-only view for finance users
- Draft → Publish workflow with versioning
- Report Packs (group multiple reports)
- TM1py integration (SYS views)
- Modern React + FastAPI tech stack

### Tech Stack
- **Backend**: FastAPI + Python + TM1py + SQLModel
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Database**: SQLite

### Quick Start

```bash
# Backend
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8080

# Frontend (in another terminal)
cd frontend
npm install
npm run dev -- --host 0.0.0.0
Open http://localhost:5173
Project Status
Active development. Currently building multi-section document support (tables + notes + charts + KPIs).

Made for internal governed financial reporting.

