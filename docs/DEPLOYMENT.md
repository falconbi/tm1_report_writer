# Deployment Guide

Two paths depending on what you need:

- **[Quick Start](#quick-start)** — pull the pre-built image and run. Five minutes to a working instance. Good for evaluation and most production deployments.
- **[Build from Source](#build-from-source)** — clone the repo and build the image yourself. For organisations that require internal image registries, custom builds, or want to modify the code.

---

## Quick Start

No code, no build step. You need Docker and network access to your TM1 server.

### 1. Create a working folder

```bash
mkdir tm1-report-writer
cd tm1-report-writer
```

### 2. Create `.env`

```env
TM1_ADDRESS=192.168.1.x
TM1_PORT=8080
TM1_USER=your_tm1_username
TM1_CLIENT_ID=your_client_id
TM1_CLIENT_SECRET=your_client_secret
```

> The `.env` file never leaves your machine. Do not commit it to source control.

### 3. Create `docker-compose.yml`

```yaml
services:
  tm1-report-writer:
    image: falconbi/tm1-report-writer:latest
    ports:
      - "8090:80"
    volumes:
      - ./data:/data
    environment:
      DATA_DIR: /data
      TM1_ADDRESS: ${TM1_ADDRESS}
      TM1_PORT: ${TM1_PORT}
      TM1_USER: ${TM1_USER}
      TM1_CLIENT_ID: ${TM1_CLIENT_ID}
      TM1_CLIENT_SECRET: ${TM1_CLIENT_SECRET}
    restart: unless-stopped
```

### 4. Start

```bash
docker compose up -d
```

### 5. Open

```
http://localhost:8090
```

The Builder is at `/builder`, the Viewer at `/viewer`. The `data/` folder is created automatically on first run — this is where your database and uploaded images are stored.

---

## Build from Source

For organisations that need to build and push to an internal registry, or want to modify the application.

### Requirements

| Requirement | Detail |
| --- | --- |
| Docker | Docker Desktop (Windows/Mac) or Docker Engine (Linux) |
| Git | To clone the repository |
| Node.js 20+ | To build the frontend |
| Python 3.12+ | Already bundled in the Docker image — only needed for local dev |

### 1. Clone the repository

```bash
git clone https://github.com/falconbi/tm1-report-writer.git
cd tm1-report-writer
```

### 2. Build the image

```bash
docker build -t tm1-report-writer:latest .
```

The Dockerfile builds the Vite frontend, installs Python dependencies, and bundles everything into a single container. Chromium for PDF export is included.

### 3. Tag and push to your registry (optional)

```bash
docker tag tm1-report-writer:latest registry.yourcompany.com/tm1-report-writer:latest
docker push registry.yourcompany.com/tm1-report-writer:latest
```

### 4. Run

Use the same `docker-compose.yml` as the Quick Start, substituting your image name:

```yaml
image: registry.yourcompany.com/tm1-report-writer:latest
```

---

## Folder Structure

```text
tm1-report-writer/
├── .env                    ← TM1 credentials (never share)
├── docker-compose.yml
└── data/                   ← created automatically on first run
    ├── database.db         ← all reports, packs, notes, visuals
    └── images/             ← uploaded image library files
```

**The `data/` folder is everything.** Back it up regularly.

---

## Environment Variables

### TM1 Connection

| Variable | Required | Description |
| --- | --- | --- |
| `TM1_ADDRESS` | Yes | IP or hostname of the TM1 / PA server |
| `TM1_PORT` | Yes | TM1 REST API port (usually 8080 or 443) |
| `TM1_USER` | Yes | TM1 username |
| `TM1_CLIENT_ID` | Yes | OAuth2 client ID |
| `TM1_CLIENT_SECRET` | Yes | OAuth2 client secret |

### Application

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATA_DIR` | No | `backend/data` | Path inside the container for the database and images. Always set to `/data` when using Docker. |

### Authentication (optional)

Password protection is off by default. Set these to enable it.

| Variable | Description |
| --- | --- |
| `ADMIN_PASSWORD` | If set, a login page gates the Builder and Admin panel |
| `VIEWER_PASSWORD` | If set, a login page gates the Viewer |
| `APP_SECRET` | HMAC signing secret. Auto-generated on first run if not set. Set explicitly to preserve sessions across container restarts. |

If neither password variable is set the app is open — suitable for internal networks where access is controlled at the reverse proxy or network level.

---

## Updating

```bash
docker compose down
docker compose pull
docker compose up -d
```

Your `data/` folder is untouched. The new container migrates the database schema automatically on startup if needed.

---

## Backups

### What to back up

The entire `data/` folder:

- `data/database.db` — all report and pack definitions, audit log
- `data/images/` — uploaded image library

### Simple file backup

```bash
cp -r ./data ./data-backup-$(date +%Y%m%d)
```

### Continuous replication (recommended for production)

[Litestream](https://litestream.io/) replicates the SQLite database continuously to S3, GCS, or Azure Blob Storage. Add it as a sidecar in `docker-compose.yml`:

```yaml
services:
  litestream:
    image: litestream/litestream
    command: replicate
    volumes:
      - ./data:/data
      - ./litestream.yml:/etc/litestream.yml
    environment:
      - LITESTREAM_ACCESS_KEY_ID=${S3_KEY}
      - LITESTREAM_SECRET_ACCESS_KEY=${S3_SECRET}
```

`litestream.yml`:

```yaml
dbs:
  - path: /data/database.db
    replicas:
      - url: s3://your-bucket/tm1-report-writer
```

---

## Reverse Proxy (HTTPS)

For production deployments behind nginx or Caddy, proxy to the container port and terminate TLS at the proxy.

**nginx example:**
```nginx
server {
    listen 443 ssl;
    server_name reports.yourcompany.com;

    location / {
        proxy_pass http://localhost:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## TM1 Connection Notes

- The app only reads from TM1 — it never writes back.
- Views are filtered to the `SYS` prefix. Only `SYS*` views appear in the Builder.
- The TM1 user needs read access to the cubes and dimensions referenced by your reports.
- OAuth2 credentials (`TM1_CLIENT_ID` / `TM1_CLIENT_SECRET`) are required — basic auth is not supported.

---

## Troubleshooting

**Cannot connect to TM1**

- Verify `.env` values are correct
- Confirm the host machine has network access to the TM1 server
- Check the TM1 REST API is enabled on the target port

**Port already in use**

- Change the host port in `docker-compose.yml` (left side of the `ports:` mapping)

**App starts but shows no data**

- Check `DATA_DIR` is set to `/data` in the container environment
- Verify the `./data` volume mount is correct in `docker-compose.yml`

**Sessions lost after container restart**

- Set `APP_SECRET` explicitly — without it a new secret is generated on each start, invalidating all login tokens

**PDF export fails**

- PDF generation uses Playwright (Chromium) inside the container — no extra install needed
- If PDFs are blank or fail silently, check container logs: `docker compose logs tm1-report-writer`
