#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-chatbu}"
SECRET_NAME="${2:-backend-secrets}"
OUTPUT_FILE="${3:-.env.k8s.local}"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl not found"
  exit 1
fi

kubectl get secret "${SECRET_NAME}" -n "${NAMESPACE}" >/dev/null

kubectl get secret "${SECRET_NAME}" -n "${NAMESPACE}" \
  -o go-template='{{range $k,$v := .data}}{{printf "%s=%s\n" $k ($v | base64decode)}}{{end}}' \
  | LC_ALL=C sort > "${OUTPUT_FILE}"

chmod 600 "${OUTPUT_FILE}"
echo "Synced ${SECRET_NAME} -> ${OUTPUT_FILE}"