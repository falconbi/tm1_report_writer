#!/bin/bash
echo "🚀 Starting TM1 Report Writer server..."

cd /home/jdlove/apps/tm1_report_writer/backend
source venv/bin/activate

# Run the server
venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8080
