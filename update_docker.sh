#!/bin/bash
echo "🔄 Updating TM1 Report Writer..."

cd /home/jdlove/tm1-report-writer

docker compose down
docker compose pull
docker compose up -d

echo "✅ Done — app running at http://localhost:8090"
