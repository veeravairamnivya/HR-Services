#!/usr/bin/env bash
# One-click start for macOS/Linux: installs dependencies, starts the API and web app, opens the browser.
set -euo pipefail
cd "$(dirname "$0")"

command -v python3 >/dev/null || { echo "Python 3.11+ is required: https://www.python.org/downloads/"; exit 1; }
command -v npm >/dev/null || { echo "Node.js 20+ is required: https://nodejs.org/"; exit 1; }

echo "[1/3] Preparing backend..."
[ -d backend/.venv ] || python3 -m venv backend/.venv
backend/.venv/bin/pip install -q -r backend/requirements.txt

echo "[2/3] Preparing frontend (first run takes a few minutes)..."
[ -d frontend/node_modules ] || (cd frontend && npm install)

echo "[3/3] Starting TalentBridge HR..."
(cd backend && exec .venv/bin/python -m uvicorn app.main:app --port 8000) &
API_PID=$!
(cd frontend && exec npm run dev) &
WEB_PID=$!
trap 'kill $API_PID $WEB_PID 2>/dev/null' EXIT INT TERM

for _ in $(seq 1 90); do
  curl -s -o /dev/null http://localhost:3000/login && break
  sleep 1
done

URL=http://localhost:3000
if command -v open >/dev/null; then open "$URL"; elif command -v xdg-open >/dev/null; then xdg-open "$URL"; fi
echo
echo "TalentBridge HR is running at $URL  (press Ctrl+C to stop)"
wait
