# TM1 Report Writer — Installation Guide

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Network access to your TM1 / Planning Analytics server

---

## Step 1 — Create a folder for your installation

Create a folder on your machine to hold your configuration and data:

```bash
mkdir tm1-report-writer
cd tm1-report-writer
```

---

## Step 2 — Create your TM1 connection file

Create a file called `.env` in your folder with your TM1 connection details:

```
TM1_ADDRESS=192.168.1.x
TM1_PORT=8080
TM1_USER=your_tm1_username
TM1_CLIENT_ID=your_client_id
TM1_CLIENT_SECRET=your_client_secret
```

Replace the values with your actual TM1 server details.

> **Note:** The `.env` file stays on your machine and is never shared or uploaded anywhere.

---

## Step 3 — Create a docker-compose.yml

Create a file called `docker-compose.yml` in your folder with the following content:

```yaml
services:
  tm1-report-writer:
    image: jdlove/tm1-report-writer:latest
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

---

## Step 4 — Start the application

```bash
docker compose up
```

Docker will pull the image from Docker Hub automatically on first run. This may take a few minutes depending on your internet connection.

---

## Step 5 — Open in your browser

```
http://localhost:8090
```

---

## Your folder structure should look like this

```
tm1-report-writer/
├── .env
├── docker-compose.yml
└── data/               ← created automatically on first run
    ├── database.db     ← your reports and packs
    └── images/         ← your uploaded images
```

---

## Stopping the application

```bash
docker compose down
```

---

## Updating to a new version

```bash
docker compose down
docker compose pull
docker compose up
```

This pulls the latest image from Docker Hub and restarts with the new version. Your data is untouched.

---

## Data backup

Your database and images live in the `data/` folder on your machine. Back this folder up regularly — it contains everything.

---

## Changing the port

If port `8090` is already in use on your machine, change it in `docker-compose.yml`:

```yaml
ports:
  - "9000:80"    # change 8090 to any free port
```

Then restart with `docker compose down && docker compose up`.

---

## Troubleshooting

**Cannot connect to TM1 server**
- Check your `.env` file values are correct
- Make sure your machine has network access to the TM1 server
- Confirm the TM1 port is correct (usually 8080 or 443)

**Port already in use**
- Change the port as described above

**Data not showing after update**
- Your data lives in `./data` — as long as that folder exists your data is safe
