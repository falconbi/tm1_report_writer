#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "🔨 Building Docker image..."
docker compose build

echo "🏷️  Tagging image..."
docker tag tm1_report_writer-tm1-report-writer falconbi/tm1-report-writer:latest

echo "🚀 Pushing to Docker Hub..."
docker push falconbi/tm1-report-writer:latest

echo "✅ Done — image live at hub.docker.com/r/falconbi/tm1-report-writer"
