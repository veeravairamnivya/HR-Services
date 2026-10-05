#!/usr/bin/env bash
# One-click start for macOS/Linux: installs dependencies, picks free ports, starts the API and web app,
# and opens the browser on the exact address ABRAH is running at.
set -euo pipefail
cd "$(dirname "$0")"

command -v python3 >/dev/null || { echo "Python 3.11+ is required: https://www.python.org/downloads/"; exit 1; }
command -v npm >/dev/null || { echo "Node.js 20+ is required: https://nodejs.org/"; exit 1; }
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" \
  || { echo "Node.js 20 or newer is required. Install the LTS version from https://nodejs.org/"; exit 1; }

# A port is free when nothing accepts a connection on it (curl exit code 7 = connection refused).
port_free() {
  local rc=0
  curl -s -o /dev/null --max-time 2 "http://localhost:$1" || rc=$?
  [ "$rc" -eq 7 ]
}
WEB_PORT=3847; until port_free "$WEB_PORT"; do WEB_PORT=$((WEB_PORT + 1)); done
API_PORT=8847; until port_free "$API_PORT"; do API_PORT=$((API_PORT + 1)); done

echo "[1/3] Preparing backend..."
[ -d backend/.venv ] || python3 -m venv backend/.venv
backend/.venv/bin/pip install -q -r backend/requirements.txt

echo "[2/3] Preparing frontend (first run takes a few minutes)..."
(cd frontend && npm install --no-audit --no-fund)

echo "[3/3] Starting ABRAH Recruitment on port $WEB_PORT..."
(cd backend && exec .venv/bin/python -m uvicorn app.main:app --port "$API_PORT") &
API_PID=$!
(cd frontend && BACKEND_URL="http://localhost:$API_PORT" exec npx next dev -p "$WEB_PORT") &
WEB_PID=$!
trap 'kill $API_PID $WEB_PID 2>/dev/null' EXIT INT TERM

URL="http://localhost:$WEB_PORT"
ready=""
for _ in $(seq 1 90); do
  if curl -s "$URL/api/health" 2>/dev/null | grep -q hr-services; then ready=1; break; fi
  sleep 2
done
[ -n "$ready" ] || { echo "The app did not start - see the errors above."; exit 1; }

if command -v open >/dev/null; then open "$URL"; elif command -v xdg-open >/dev/null; then xdg-open "$URL"; fi
echo
echo "============================================================"
echo "  ABRAH Recruitment is running at:  $URL"
echo "============================================================"
echo "Press Ctrl+C to stop."
wait
