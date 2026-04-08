# TM1 Report Writer

A standalone web application for building professional, governed financial report packs from IBM Planning Analytics (TM1) data.

## What It Does

Turns governed TM1 cube data into polished, publishable report packs. Finance users view clean, confirmed data. Report authors build and publish in a separate builder interface.

## Features

- **Reports** — TM1-connected tables with full formatting (rows, columns, headers, number formats, conditional formatting)
- **Notes** — Rich content cards with text, images, charts and report tables
- **Visuals** — KPI tiles and charts driven by TM1 data
- **Packs** — Compose reports, notes and visuals into multi-section page layouts
- **Draft → Publish workflow** — versioned publishing with data confirmation step
- **Builder / Viewer split** — authors build in `/builder`, finance users read in `/viewer`
- **Admin portal** — DB stats, audit log, schema view

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | FastAPI + Python 3.12 + TM1py |
| Database | SQLite via SQLModel |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |

## Quick Start

```bash
# Backend
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8080

# Frontend (separate terminal)
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open [http://localhost:5173/builder](http://localhost:5173/builder)

## Project Status

Active development. Internal tool for governed financial reporting.
