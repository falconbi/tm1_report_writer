#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "🔨 Building Docker image..."
docker compose build

echo "🏷️  Tagging image..."
docker tag tm1_report_writer-tm1-report-writer jdlove/tm1-report-writer:latest

echo "🚀 Pushing to Docker Hub..."
docker push jdlove/tm1-report-writer:latest

echo "✅ Done — image live at hub.docker.com/r/jdlove/tm1-report-writer"
