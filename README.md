# TM1 Report Writer

A standalone web application for building professional, governed financial report packs from IBM Planning Analytics (TM1 / Planning Analytics) cube data.

**Completely separate from the governance suite** — dedicated repository, independent SQLite database, and isolated TM1 connection (copied configuration, not shared).

---

## What It Does

TM1 Report Writer converts governed TM1 view data into polished, version-controlled, export-ready HTML report packs.

It maintains a clear separation of concerns:
- **Builder** (`/builder`) — Report authors and power users design, format, compose, and publish artifacts
- **Viewer** (`/viewer`) — Finance end-users access only published, confirmed report packs
- **Admin** (`/admin`) — Governance oversight with stats, audit logs, and schema inspection

---

## Key Features

- **Reports** — TM1-connected tables with rows/columns configuration, number formatting, dimension selectors, and preview rendering
- **Notes** — Flexible content cards (single-page max) with rich text (Tiptap), images from shared library, embedded visuals/charts, and report slots
- **Visuals** — KPI tiles and charts driven by TM1 data
- **Packs** — Multi-page document composer mixing reports, notes, and visuals with section-based layouts, per-page backgrounds, overlays, and footers
- **Governed Workflow** — Draft → Ready → Confirmed (Green) → Publish with strict validation. Packs require all artifacts to be Confirmed before publishing
- **Versioning & Audit** — Immutable snapshots on publish; full audit log of save/publish/delete actions
- **Paged Layout** — A4-proportioned pages in viewer with custom backgrounds (colour/image), overlays, and configurable footers (pack name, confirmed date, page numbers, custom text)

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Backend    | FastAPI 0.135 + Python 3.12         |
| ASGI       | Uvicorn                             |
| Database   | SQLite via SQLModel 0.0.38 + SQLAlchemy 2.0 |
| TM1        | TM1py 2.2.4                         |
| Frontend   | React 18 + TypeScript + Vite        |
| State      | Zustand                             |
| Routing    | React Router 6                      |
| Styling    | Tailwind CSS 3                      |
| Icons      | Lucide React                        |

---

## Quick Start

### Backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8080
Frontend (Development)
Bashcd frontend
npm install
npm run dev -- --host 0.0.0.0
Open http://localhost:5173/builder
Useful commands:

Type check: cd frontend && npx tsc --noEmit
Kill stuck backend port: fuser -k 8080/tcp


Architecture Highlights

Publishing Model: Draft edits coexist with published immutable snapshots. Viewers always see published_definition / published_content.
Artifact Status Lifecycle: Grey (Draft) → Blue (Ready) → Green (Confirmed) → Yellow (Pending Changes). Yellow blocks further saves until re-confirmation. Packs publish only when all referenced artifacts are Green.
Pack Layout: Migrating to PackPage[] structure (each with sections, background, overlay). Migration shim for legacy flat sections.
TM1 Integration: SYS views only. MDX WHERE clauses built from axis hierarchies. Dataset service handles overrides.
Notes: Card-style with vertical sections. Slots: Text, Image (shared library), Visual, or Report. Overflow warning in builder.

See CLAUDE.md for full architecture, data model, API routes, and gotchas.

Security & Authentication
Web Application Authentication

Method: OpenID Connect (OIDC) via Authentik (or compatible IdP).
Implementation: Backend will validate OIDC tokens; frontend will use Authorization Code flow with PKCE.
Roles: Planned support for Admin, Builder, and Viewer roles to control access to routes and actions.

TM1 Connection & Data Security
All TM1 interactions use TM1py RESAPI Authentication with impersonation:

A dedicated service admin account (with admin rights on the TM1 server) is used for the backend connection.
The logged-in web user (from OIDC) is mapped to their corresponding TM1 username.
Impersonation ensures every TM1 call (cube views, members, data fetches) respects the real user's TM1 security (element security, cell security, private objects, etc.).

Example configuration in core/tm1_connect.py (or equivalent):
Pythonfrom TM1py import TM1Service
import os

tm1 = TM1Service(
    base_url=os.getenv("TM1_BASE_URL"),
    user=os.getenv("TM1_SERVICE_USER"),      # Service admin / "apikey"
    password=os.getenv("TM1_SERVICE_SECRET"), # Service secret / API key
    impersonate=current_user_tm1_username,   # Dynamically set from OIDC user
    async_requests_mode=True,
    ssl=True,
    verify=True                              # Or path to CA cert if needed
)
Key Benefits:

The backend never stores or uses end-user TM1 passwords.
Full respect for existing TM1 security model without duplicating it.
Service account requires Admin (or DataAdmin) rights to enable impersonation.
Impersonation has been supported in TM1py since v1.6 and remains fully functional in v2.2.4.

Important Notes:

Only non-Admin TM1 users should typically be impersonated (see TM1 REST API constraints).
TM1 connection is created per-request or per-session as needed for security and performance.

Additional Security Measures (Planned / Recommended)

HTTPS enforcement via reverse proxy (Nginx/Traefik) in production.
Strict CORS, input sanitization (especially Tiptap HTML and file uploads).
Environment variables or secret manager for all credentials.
Audit logging of user actions tied to OIDC identity.
Future: Edit locking, per-user ownership, rate limiting.

Deployment Recommendation: Use Docker + environment variables for secrets. Disable debug mode in production.

Current Development Priorities (as of 2026-04-08)
Phase 1 — Image Library

DB table, upload/list/delete endpoints, static serving at /images/, builder sidebar picker.

Phase 2 — Paged Pack Layout

Migrate to PackPage[] structure.
Composer UX with page dividers, add/move sections/pages, per-page background/overlay controls.
Pack-level defaults (background, footer settings).

Phase 3+

Viewer paged rendering with A4 sheets and footers.
Note composer redesign (sections + mixed slots).
Later items: Bulk operations, conditional formatting, roll forward, full Docker setup, PDF export (WeasyPrint).

Recently Completed:

Removed brittle Tiptap table cell formatting (use Report slots instead).
Refined note design decisions.


Important Notes & Gotchas

Only SYS prefixed views are available in the builder.
API base URL uses window.location.hostname:8080 (network-friendly).
DATA_DIR env var controls SQLite database and image storage path.
Pack statements (flat list) and layout must stay in sync.
Selector roles default to 'none' to avoid TypeScript issues.


Project Status
Active internal development — Built for finance teams requiring strict governance, data confirmation, auditability, and proper security over TM1-sourced reports.
