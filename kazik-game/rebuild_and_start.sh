#!/bin/bash
echo 'rebuilding frontend'
cd frontend-react && npm install && npm run build
echo 'starting app...'
cd .. && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

