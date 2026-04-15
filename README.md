# TM1 Report Writer

A standalone web application for building professional, governed financial report packs from **IBM Planning Analytics (TM1)** cube data.

**Completely separate** from the governance suite — dedicated repository, independent SQLite database, and isolated TM1 connection (copied configuration, not shared).

---

## What It Does

TM1 Report Writer converts governed TM1 view data into polished, version-controlled, export-ready HTML report packs.

It features a clear separation of concerns:

- **Builder** (`/builder`) — Report authors and power users design, format, compose, and publish artifacts
- **Viewer** (`/viewer`) — Finance end-users browse only published and confirmed report packs
- **Admin** (`/admin`) — Governance oversight with database stats, audit logs, and schema inspection

---

## Key Features

- **Reports** — TM1-connected tables with flexible row/column configuration, number formatting, dimension selectors, and live preview
- **Notes** — Flexible single-page content cards with rich text (Tiptap), images from a shared library, embedded visuals, and report slots
- **Visuals** — KPI tiles and charts powered by TM1 data
- **Packs** — Multi-page document composer combining reports, notes, and visuals with per-page backgrounds, overlays, and footers
- **Governed Publishing Workflow** — Draft → Ready → Confirmed (Green) → Publish. Packs can only be published when all referenced artifacts are Confirmed
- **Versioning & Audit Trail** — Immutable snapshots on every publish with full action logging
- **Paged Document Layout** — A4-proportioned pages in the viewer with custom backgrounds (colour or image), overlays, and configurable footers

---

## Tech Stack

| Layer          | Technology                                      |
|----------------|-------------------------------------------------|
| **Backend**    | FastAPI 0.135 + Python 3.12                     |
| **ASGI Server**| Uvicorn                                         |
| **Database**   | SQLite via SQLModel 0.0.38 + SQLAlchemy 2.0     |
| **TM1 Client** | TM1py 2.2.4                                     |
| **Frontend**   | React 18 + TypeScript + Vite                    |
| **State**      | Zustand                                         |
| **Routing**    | React Router 6                                  |
| **Styling**    | Tailwind CSS 3                                  |
| **Icons**      | Lucide React                                    |

---

## Quick Start

### 1. Start the Backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8080
2. Start the Frontend (in a separate terminal)
Bashcd frontend
npm install
npm run dev -- --host 0.0.0.0
Open your browser and go to: http://localhost:5173/builder
Useful Commands
Bash# Type checking
cd frontend && npx tsc --noEmit

# Kill a stuck backend port
fuser -k 8080/tcp

Architecture Highlights

Publishing Model: Draft changes coexist with immutable published versions. Viewers always see the latest published_definition.
Artifact Status Lifecycle: Grey (Draft) → Blue (Ready) → Green (Confirmed) → Yellow (Pending Changes). Yellow state requires re-confirmation before further saves. Packs require all artifacts to be Green before publishing.
Pack Layout: Transitioning to PackPage[] structure with per-page background and overlay support (migration shim included for legacy flat layouts).
TM1 Integration: Only SYS-prefixed views are exposed. MDX WHERE clauses are built safely from axis hierarchies.
Notes: Rendered as styled cards with vertical sections. Content slots support Text, Image, Visual, or embedded Report.

For full details, see CLAUDE.md.

Security & Authentication
Web Application Authentication

Method: OpenID Connect (OIDC) via Authentik (or any compatible identity provider).
Implementation: Backend validates OIDC tokens; frontend uses Authorization Code flow with PKCE.
Roles: Support for Admin, Builder, and Viewer roles to enforce route and action-level access control.

TM1 Connection & Data Security
All TM1 operations use TM1py with impersonation for strong security:
A dedicated service admin account connects to TM1. The currently logged-in web user (from OIDC) is impersonated, so every TM1 call respects the real user's TM1 security rights (element security, cell security, private objects, etc.).
Example in core/tm1_connect.py:
Pythonfrom TM1py import TM1Service
import os

tm1 = TM1Service(
    base_url=os.getenv("TM1_BASE_URL"),
    user=os.getenv("TM1_SERVICE_USER"),        # Service admin account or API key
    password=os.getenv("TM1_SERVICE_SECRET"),  # Service secret / API key
    impersonate=current_user_tm1_username,     # Dynamically set from OIDC identity
    async_requests_mode=True,
    ssl=True,
    verify=True                                # Or path to CA certificate
)
Benefits:

No end-user TM1 passwords are stored or used by the application.
Full reuse of existing TM1 security model.
Service account requires Admin (or DataAdmin) rights to support impersonation.
Impersonation support has been stable in TM1py since version 1.6 and works reliably in 2.2.4.

Notes:

Typically only non-Admin TM1 users are impersonated.
TM1 connections are created per-request or per-session for security and performance.

Additional Security Measures (Planned)

HTTPS enforced via reverse proxy (Nginx / Traefik)
Strict CORS policy and input sanitization (especially for rich text and file uploads)
All secrets managed via environment variables or a secret manager
Audit logs tied to OIDC user identity
Future enhancements: edit locking, per-user ownership, rate limiting

Deployment Recommendation: Use Docker with environment variables for all secrets. Always disable debug mode in production.

Current Development Priorities (April 2026)
Phase 1 – Image Library

Database table, upload/list/delete API endpoints, static file serving at /images/, and builder sidebar picker.

Phase 2 – Paged Pack Layout

Migrate layout to PackPage[] structure.
Enhanced composer UX with page dividers, section reordering, and per-page background/overlay controls.
Pack-level default settings for background and footer.

Phase 3+

Full paged rendering in Viewer with A4-style pages and pinned footers.
Redesigned Note composer with flexible mixed-content sections.
Future items: bulk row/column operations, conditional formatting, roll-forward, PDF export (WeasyPrint), and full Docker setup.

Recently Completed:

Removed brittle Tiptap table cell formatting (use Report slots instead)
Refined note design decisions


Important Notes & Gotchas

Only SYS prefixed views are available in the builder (no ad-hoc MDX).
API base URL dynamically uses window.location.hostname:8080 for easy network access.
DATA_DIR environment variable controls both the SQLite database and image storage location.
Pack statements (flat ID list) and layout must remain in sync.
Selector roles default to 'none' to prevent TypeScript errors.


Project Status
Active internal development — Designed for finance teams that demand strict governance, data confirmation, auditability, and robust security over TM1-sourced financial reports.


