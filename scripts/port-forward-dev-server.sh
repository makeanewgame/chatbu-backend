#!/usr/bin/env bash
set -euo pipefail

# Port-forward AWS dev K8s services to localhost so that the local .env
# entries (DATABASE_URL, ELASTICSEARCH_URL, INGEST_ENPOINT) work as-is.
#
# Mappings (local → remote):
#   5532 → postgresql/chatbu-postgres-rw:5432
#   9200 → elasticsearch/elasticsearch-master:9200
#   8100 → chatbu/fastapi-gateway-service:8000

PF_PG_PID=""
PF_ES_PID=""
PF_INGEST_PID=""

cleanup() {
  echo ""
  echo "[dev-server] Shutting down port-forwards..."
  for pid in "${PF_PG_PID}" "${PF_ES_PID}" "${PF_INGEST_PID}"; do
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
    fi
  done
  echo "[dev-server] Done."
}
trap cleanup EXIT INT TERM

if ! command -v kubectl >/dev/null 2>&1; then
  echo "[dev-server] ERROR: kubectl not found in PATH"
  exit 1
fi

if ! command -v nc >/dev/null 2>&1; then
  echo "[dev-server] ERROR: nc (netcat) not found in PATH"
  exit 1
fi

wait_for_port() {
  local label="$1"
  local port="$2"
  local pid="$3"

  echo "[dev-server] Waiting for localhost:${port} (${label})..."
  for _ in {1..30}; do
    if nc -z 127.0.0.1 "${port}" 2>/dev/null; then
      echo "[dev-server] ${label} tunnel is ready on :${port}"
      return 0
    fi
    if ! kill -0 "${pid}" 2>/dev/null; then
      echo "[dev-server] ERROR: ${label} port-forward exited unexpectedly"
      return 1
    fi
    sleep 1
  done
  echo "[dev-server] ERROR: Timeout waiting for ${label} on :${port}"
  return 1
}

# ── PostgreSQL ────────────────────────────────────────────────────────────────
echo "[dev-server] Starting PostgreSQL port-forward (5532 → chatbu-dev/chatbu-postgres-rw:5432)..."
kubectl port-forward -n chatbu-dev svc/chatbu-postgres-rw 5532:5432 \
  >/tmp/chatbu-pf-postgres.log 2>&1 &
PF_PG_PID=$!
wait_for_port "PostgreSQL" 5532 "${PF_PG_PID}"

# ── Elasticsearch ─────────────────────────────────────────────────────────────
echo "[dev-server] Starting Elasticsearch port-forward (9200 → chatbu-dev/elasticsearch-master:9200)..."
kubectl port-forward -n chatbu-dev svc/elasticsearch-master 9200:9200 \
  >/tmp/chatbu-pf-elasticsearch.log 2>&1 &
PF_ES_PID=$!
wait_for_port "Elasticsearch" 9200 "${PF_ES_PID}"

# ── Ingest (FastAPI gateway) ──────────────────────────────────────────────────
echo "[dev-server] Starting Ingest port-forward (8100 → chatbu-dev/fastapi-gateway-service:8000)..."
kubectl port-forward -n chatbu-dev svc/fastapi-gateway-service 8100:8000 \
  >/tmp/chatbu-pf-ingest.log 2>&1 &
PF_INGEST_PID=$!
wait_for_port "Ingest" 8100 "${PF_INGEST_PID}"

echo ""
echo "[dev-server] All tunnels are active. Press Ctrl+C to stop."
echo "  DATABASE_URL   → localhost:5532"
echo "  ELASTICSEARCH  → localhost:9200"
echo "  INGEST_ENPOINT → localhost:8100"
echo ""

# Keep script alive; child processes run until interrupted
wait "${PF_PG_PID}" "${PF_ES_PID}" "${PF_INGEST_PID}"
