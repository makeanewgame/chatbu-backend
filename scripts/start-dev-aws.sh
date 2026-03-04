#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  for pid in "${PF_PID:-}" "${PF_FASTAPI_PID:-}"; do
    if [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1; then
      kill "${pid}" >/dev/null 2>&1 || true
    fi
  done
}
trap cleanup EXIT INT TERM

echo "[aws-dev] Preparing AWS-backed env..."
npm run aws >/dev/null

echo "[aws-dev] Starting Kubernetes PostgreSQL port-forward..."
kubectl port-forward -n postgresql svc/postgresql-service 5432:5432 >/tmp/chatbu-backend-aws-db.log 2>&1 &
PF_PID=$!

echo "[aws-dev] Waiting for localhost:5432..."
for _ in {1..30}; do
  if nc -z 127.0.0.1 5432 >/dev/null 2>&1; then
    echo "[aws-dev] DB tunnel is ready"
    break
  fi

  if ! kill -0 "${PF_PID}" >/dev/null 2>&1; then
    echo "[aws-dev] Port-forward exited unexpectedly"
    tail -n 50 /tmp/chatbu-backend-aws-db.log || true
    exit 1
  fi

  sleep 1
done

if ! nc -z 127.0.0.1 5432 >/dev/null 2>&1; then
  echo "[aws-dev] Timeout waiting for DB tunnel"
  tail -n 50 /tmp/chatbu-backend-aws-db.log || true
  exit 1
fi

echo "[aws-dev] Starting FastAPI gateway port-forward..."
kubectl port-forward -n chatbu svc/fastapi-gateway-service 8000:8000 >/tmp/chatbu-backend-aws-fastapi.log 2>&1 &
PF_FASTAPI_PID=$!

echo "[aws-dev] Waiting for localhost:8000..."
for _ in {1..30}; do
  if nc -z 127.0.0.1 8000 >/dev/null 2>&1; then
    echo "[aws-dev] FastAPI tunnel is ready"
    break
  fi

  if ! kill -0 "${PF_FASTAPI_PID}" >/dev/null 2>&1; then
    echo "[aws-dev] FastAPI port-forward exited unexpectedly"
    tail -n 50 /tmp/chatbu-backend-aws-fastapi.log || true
    exit 1
  fi

  sleep 1
done

if ! nc -z 127.0.0.1 8000 >/dev/null 2>&1; then
  echo "[aws-dev] Timeout waiting for FastAPI tunnel"
  tail -n 50 /tmp/chatbu-backend-aws-fastapi.log || true
  exit 1
fi

echo "[aws-dev] Starting Nest backend..."
npm run start:dev