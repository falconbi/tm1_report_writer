# Install in 5 Minutes — Any OS

No coding. No build steps. Just Docker.

---

## Do you have a TM1 server handy?

**No — just evaluating?**
No problem. The app ships with a sample report pack called **Toy Story Airline** built entirely from CSV data. You do not need a TM1 server to see it. Skip the TM1 credentials in Step 3 and you will have live sample reports in your browser within minutes.

**Yes — connecting to a real TM1 server?**
Follow every step as written. You will need your TM1 address, port, username, and OAuth2 client ID and secret.

---

## What you need

- A computer running **Windows**, **Mac**, or **Linux**
- Docker Desktop (free — instructions in Step 1)
- *Only if connecting to TM1:* network access to your TM1 / Planning Analytics server and your OAuth2 credentials

That's it.

---

## Step 1 — Install Docker Desktop

Docker is the only software you need to install. It runs the app in a self-contained box on your machine.

Go to **[docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)** and download the version for your operating system.

- **Windows** — run the `.exe` installer, follow the prompts, restart if asked
- **Mac** — open the `.dmg`, drag Docker to Applications, open it
- **Linux** — follow the instructions on the Docker website for your distribution

After installing, open Docker Desktop and wait until you see **"Docker is running"** in the bottom left. It looks like a small whale icon in your taskbar / menu bar.

> Docker Desktop is free for personal use and small teams.

---

## Step 2 — Create a folder

Create a new folder on your computer. You can put it anywhere — your Desktop, Documents, wherever you like.

Name it:

```
tm1-report-writer
```

---

## Step 3 — Create your credentials file

Inside the `tm1-report-writer` folder, create a new text file called exactly:

```
.env
```

> **Windows users:** Open Notepad. Go to File → Save As. Set "Save as type" to "All Files" and type `.env` as the filename. Make sure you save it inside the `tm1-report-writer` folder.

**If you are just evaluating (no TM1 server)**, paste this as-is — no changes needed:

```
TM1_ADDRESS=
TM1_PORT=
TM1_USER=
TM1_CLIENT_ID=
TM1_CLIENT_SECRET=
```

The app will start normally. The sample Toy Story Airline pack is built from CSV data and does not touch TM1 at all. TM1 features simply won't be available until real credentials are provided.

**If you are connecting to a real TM1 server**, paste this and fill in your details:

```
TM1_ADDRESS=192.168.1.x
TM1_PORT=8080
TM1_USER=your_tm1_username
TM1_CLIENT_ID=your_client_id
TM1_CLIENT_SECRET=your_client_secret
```

Save the file.

> This file never leaves your machine. Do not share it or commit it to source control.

---

## Step 4 — Create the app config file

In the same `tm1-report-writer` folder, create another new text file called exactly:

```
docker-compose.yml
```

Paste this in exactly as shown — do not change anything:

```yaml
services:
  tm1-report-writer:
    image: falconbi/tm1-report-writer:latest
    ports:
      - "8090:80"
    volumes:
      - ./data:/data
    env_file: .env
    restart: unless-stopped
```

Save the file.

---

## Step 5 — Open a terminal in your folder

You need to open a terminal (command prompt) pointed at your `tm1-report-writer` folder.

**Windows:**
Open the `tm1-report-writer` folder in File Explorer. Click the address bar at the top, type `cmd`, and press Enter. A black Command Prompt window will open in that folder.

**Mac:**
Open the `tm1-report-writer` folder in Finder. Right-click (or Control-click) on the folder and select **"New Terminal at Folder"**.

> If you don't see that option: open Terminal from Applications → Utilities, then type `cd ` (with a space), drag the folder into the Terminal window, and press Enter.

**Linux:**
Right-click the folder and select **"Open Terminal Here"**, or open a terminal and `cd` into the folder.

---

## Step 6 — Start the app

In the terminal window, type this and press Enter:

```
docker compose up -d
```

Docker will download the app automatically — this only happens the first time and takes about a minute depending on your connection. You will see some text scrolling past. When it finishes and you see your prompt again, the app is running.

---

## Step 7 — Open your browser

Open any web browser and go to:

```
http://localhost:8090
```

You should see the Report Writer application.

- **Builder** (create and manage reports): `http://localhost:8090/builder`
- **Viewer** (read published report packs): `http://localhost:8090/viewer`

---

## Your data

A `data` folder will appear inside your `tm1-report-writer` folder. This is where everything is stored — your reports, packs, images, and database. **Back this folder up regularly.**

---

## Stopping the app

```
docker compose down
```

Your data is untouched. Run `docker compose up -d` again any time to start it back up.

---

## Updating to a new version

```
docker compose down
docker compose pull
docker compose up -d
```

Your data is untouched. The app updates itself.

---

## Something went wrong?

**Docker Desktop says it is not running**
Make sure Docker Desktop is open and shows "Docker is running" before running `docker compose up`.

**`docker compose` command not found**
Try `docker-compose` (with a hyphen) — older versions of Docker use this form.

**Cannot connect to TM1 after the app starts**
Double-check the values in your `.env` file. Make sure the TM1 REST API port is accessible from your machine.

**Port 8090 already in use**
Change `"8090:80"` to `"8091:80"` (or any free port) in `docker-compose.yml`, then access the app at `http://localhost:8091`.
