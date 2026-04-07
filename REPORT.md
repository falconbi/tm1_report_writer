# TM1 Report Writer — Project Report

**Project Name:** tm1_report_writer  
**Location:** `/home/jdlove/apps/tm1_report_writer`  
**Purpose:** Build a clean, modern, from-scratch custom web app for TM1 / Planning Analytics reporting (Builder + Viewer).  
**TM1 Environment:** TM1 V12 on-prem (192.168.1.178:4444) with Authentik OIDC.  
**Last Updated:** 5 April 2026

## Current Status
**Backend:** ✅ Working and Stable  
- FastAPI server with proper APIRouter structure (routers for TM1 and Reports)  
- TM1 connection is functional  
- `/api/tm1/cubes` returns real cubes from the server  
- Basic `/api/reports/dataset` endpoint is implemented  

**Frontend:** Not started yet (React + TypeScript planned)

## Troubleshooting Summary

**Virtual Environment Problems**  
We had repeated `ModuleNotFoundError: No module named 'tm1py'` errors during initial setup.  
The main process could see the installed packages, but Uvicorn and Gunicorn worker processes kept falling back to the system Python interpreter.  
Multiple fixes were tried (sys.path hacks, PYTHONPATH, full venv paths, different worker classes).  
**Resolution:** Running the server directly with `venv/bin/python -m uvicorn main:app` proved stable and reliable for development.

**Authentication Problems**  
Initial attempts using standard basic auth (`akadmin` / `admin`) failed with 401 Unauthorized.  

**How Authentication Works in This Project**  
- A POST request is made to the endpoint `/tm1/auth/v1/session`  
- `TM1_CLIENT_ID` and `TM1_CLIENT_SECRET` are used as HTTP Basic Auth  
- The JSON body contains `{"User": "akadmin"}`  
- On success, TM1 returns a `TM1SessionId` cookie  
- This cookie is stored in a `requests.Session` object and reused for all subsequent API calls  
- The session is cached with a 10-minute TTL and automatically refreshed when expired  

**Key .env settings**  
- TM1_ADDRESS=192.168.1.178  
- TM1_PORT=4444  
- TM1_USER=akadmin  
- TM1_CLIENT_ID and TM1_CLIENT_SECRET  

## Working Development Command

```bash
cd /home/jdlove/apps/tm1_report_writer/backend
source venv/bin/activate
venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8080

## TailwindCSS Installation Log (5 April 2026)

**Issue:**  
Multiple attempts (9+) to install and initialize TailwindCSS failed with "could not determine executable to run" and PostCSS plugin errors.

**Root Cause:**  
Node.js v18.19.1 was too old for Tailwind v4. Also hit known npm optional dependencies bug.

**Resolution Path:**  
- Upgraded Node.js to v20.20.2
- Performed multiple clean reinstalls (`rm -rf node_modules package-lock.json`, cache clean)
- Used `@tailwindcss/postcss` and updated configuration for Tailwind v4
- Final successful initialization on Attempt #9 using Tailwind 3.4.1 compatible approach

**Log File:** `~/tailwind_fix.log` (contains all 9 attempts)

**Current Status:** TailwindCSS is now initialized (`tailwind.config.js` and `postcss.config.js` created).

## Frontend Setup Details (5 April 2026)

**Tech Stack Used:**
- React 19 with TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Axios (HTTP client)
- lucide-react (icons)

**Exact Installation Steps (for repeatability):**

1. Create the React project:
   ```bash
   cd /home/jdlove/apps/tm1_report_writer
   npm create vite@latest frontend -- --template react-ts
   cd frontend

npm install
npm install axios lucide-react

npm install -D tailwindcss postcss autoprefixer @tailwindcss/postcss

Configure files:
tailwind.config.js — content paths for React files
postcss.config.js — uses @tailwindcss/postcss
src/index.css — contains @import "tailwindcss";

Note:
Node.js was upgraded to v20.20.2 because v18 was incompatible with Tailwind v4 and latest Vite.
Current Run Command for Frontend:
cd frontend
npm run dev

This setup gives us a modern React + Tailwind frontend for the Report Builder.


## Backend Setup Details (5 April 2026)

**Tech Stack Used:**
- FastAPI (Python web framework)
- Python 3.12
- Uvicorn (development server)
- requests (for TM1 REST API)
- Pydantic (data validation)
- dotenv (environment variables)

**Exact Installation Steps (for repeatability):**

1. Create virtual environment:
   ```bash
   cd /home/jdlove/apps/tm1_report_writer/backend
   python3 -m venv venv
   source venv/bin/activate

Core dependancies 
pip install fastapi uvicorn httpx python-dotenv pydantic-settings

Key files created:
main.py — FastAPI app with APIRouters
core/tm1_connect.py — Custom TM1 authentication using /tm1/auth/v1/session
routers/tm1_router.py — TM1 endpoints (cubes, views)
routers/reports_router.py — Report/dataset endpoints
services/dataset_service.py — Dataset fetching logic

Authentication Implementation:

Uses custom POST to /tm1/auth/v1/session
Client ID + Secret as Basic Auth
JSON body with {"User": "akadmin"}
Returns and caches TM1SessionId cookie

Working Development Command:
cd backend
source venv/bin/activate
venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8080

Alias created for convenience:
alias runserver="~/apps/tm1_report_writer/runserver.sh"

This gives a clean, modern FastAPI backend with proper separation of concerns.


**Next Actions**

Improve dataset fetching (add overrides, aliases, full MDX support from TM1_fetch.py)
Start React frontend (Report Viewer and Builder interface)
Add better error handling, logging, and input validation

How to keep this alive: At the start of each new chat, paste the latest content of this REPORT.md or say "continue from REPORT.md".
— Grok (5 April 2026)


Workiva-Inspired Functionality List
1. Report Creation & Management

New Report / Template
Draft vs Published (with versioning)
Save Draft
Publish (creates new version, does not overwrite)
Rename (drafts only)
Delete (drafts and published)
Duplicate report
Search / filter reports

2. Data Connection

Select Cube
Select View (with filtering, e.g. SYS*)
Change data source without breaking layout
Dimension slicers / subsets (future)

3. Page Layout

Multiple sections on one page
Text blocks / titles / rich text
Tables
Charts (linked to table data)
Images / logos
Drag-and-drop section ordering

4. Table Capabilities (the heart of financial reporting)

Dynamic columns (measures + calculated variances)
Column groups / hierarchies
Row grouping / indentation
Automatic subtotals and grand totals
Resizable columns
Conditional formatting (colors, icons, rules based on values)
Number formatting, scaling (K, M), currency, percentages, custom formats
Bold totals, alternate row colors

5. Calculations

Built-in variance ($ and %)
Custom calculated columns
YoY, QoQ, Forecast vs Actual
Running totals

6. Formatting & Styling

Font family, size, bold, color
Background colors per cell/row/column
Borders and padding control
Light / Dark themes + brand themes

7. Output & Sharing

Export to Excel, PDF, PowerPoint
Scheduled refresh
Comments / build notes per report

8. Usability

Clean 3-panel layout (navigation | canvas | properties)
Live preview as you build
Keyboard shortcuts
Responsive / good spacing
