#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-postgresql}"
SERVICE_NAME="${2:-postgresql-service}"
LOCAL_PORT="${3:-5432}"
REMOTE_PORT="${4:-5432}"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl not found"
  exit 1
fi

echo "Forwarding ${NAMESPACE}/${SERVICE_NAME} ${LOCAL_PORT}:${REMOTE_PORT}"
kubectl port-forward -n "${NAMESPACE}" "svc/${SERVICE_NAME}" "${LOCAL_PORT}:${REMOTE_PORT}"