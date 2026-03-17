#!/bin/bash
cd "$(dirname "$0")/backend"
echo "Starting DemiBrick backend on http://localhost:8000 ..."
venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
