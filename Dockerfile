# ─── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Output: /app/frontend/dist

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies needed by Chromium
RUN apt-get update && apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgtk-3-0 libx11-xcb1 libxcb-dri3-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright's Chromium browser
RUN playwright install chromium

# Copy backend source
COPY backend/ ./backend/

# Copy compiled frontend into backend's static folder
COPY --from=frontend-builder /app/frontend/dist ./frontend_dist/

# Data directory (SQLite DB + uploaded images) — mount as a volume
# Default path used when DATA_DIR env var not set
RUN mkdir -p /data/images

# Expose port
EXPOSE 80

# Environment defaults (override at runtime)
ENV DATA_DIR=/data
ENV PORT=80

# Start uvicorn
CMD ["sh", "-c", "cd /app/backend && uvicorn main:app --host 0.0.0.0 --port 80"]
