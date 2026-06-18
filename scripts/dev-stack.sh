#!/usr/bin/env bash
# Start VNX mirror (3001) + verlattice dashboard (3900) for local dev.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SWARM="$ROOT/hedera-vnx-paid-swarm"
VERLATTICE="$ROOT/verlattice"

if ! curl -sf http://localhost:3001/api/v1/health >/dev/null 2>&1; then
  echo "Starting VNX mirror on :3001..."
  (cd "$SWARM" && npm run mirror:start) &
  for i in $(seq 1 30); do
    if curl -sf http://localhost:3001/api/v1/health >/dev/null 2>&1; then
      echo "Mirror ready."
      break
    fi
    sleep 1
  done
else
  echo "VNX mirror already running on :3001"
fi

echo "Starting verlattice on http://localhost:3900/dashboard/"
cd "$VERLATTICE" && npm run dev