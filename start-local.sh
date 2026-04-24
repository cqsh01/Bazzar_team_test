#!/usr/bin/env bash
set -euo pipefail

PORT_API=8000
PORT_VITE=5173

echo "=== Bazaar Simulator — Local Startup ==="
echo ""

# --- Python check ---
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
  echo "ERROR: Python is not installed or not on PATH."
  echo "Install Python 3.9+ and try again."
  exit 1
fi
PY=$(command -v python3 || command -v python)
PY_VER=$($PY --version 2>&1)
echo "[✓] Python found: $PY_VER"

# --- Node check ---
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed or not on PATH."
  echo "Install Node 18+ and try again."
  exit 1
fi
NODE_VER=$(node --version)
echo "[✓] Node found: $NODE_VER"

# --- npm check ---
if ! command -v npm &>/dev/null; then
  echo "ERROR: npm is not installed."
  exit 1
fi

# --- Install Python deps if needed ---
echo ""
echo "Installing Python server dependencies..."
$PY -m pip install -e ".[server]" --quiet 2>/dev/null || $PY -m pip install -e ".[server]"

# --- Install web deps if needed ---
if [ ! -d "web/node_modules" ]; then
  echo "Installing web dependencies..."
  (cd web && npm install)
fi

# --- Start API bridge ---
echo ""
echo "Starting API bridge on port $PORT_API..."
$PY -m minimal_sim_core.server --port $PORT_API &
API_PID=$!

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $API_PID 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# --- Health check ---
echo "Waiting for API bridge..."
RETRIES=0
MAX_RETRIES=20
while [ $RETRIES -lt $MAX_RETRIES ]; do
  if curl -sf "http://localhost:$PORT_API/api/schema" >/dev/null 2>&1; then
    echo "[✓] API bridge is healthy."
    break
  fi
  RETRIES=$((RETRIES + 1))
  sleep 0.5
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
  echo "ERROR: API bridge failed to start on port $PORT_API."
  echo "Check the terminal output above for Python errors."
  kill $API_PID 2>/dev/null || true
  exit 1
fi

# --- Start Vite ---
echo ""
echo "Starting Vite dev server..."
(cd web && npm run dev) &
VITE_PID=$!

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $API_PID 2>/dev/null || true
  kill $VITE_PID 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

sleep 2

# --- Open browser ---
URL="http://localhost:$PORT_VITE"
echo ""
echo "=== Ready! Opening $URL ==="
if command -v xdg-open &>/dev/null; then
  xdg-open "$URL"
elif command -v open &>/dev/null; then
  open "$URL"
else
  echo "Open your browser and navigate to: $URL"
fi

wait
