#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${1:-chatbu}"
SECRET_NAME="${2:-backend-secrets}"
AWS_ENV_FILE=".env.aws.local"

./scripts/sync-k8s-env.sh "${NAMESPACE}" "${SECRET_NAME}" .env.k8s.local
./scripts/prepare-local-env.sh .env.k8s.local "${AWS_ENV_FILE}"
cp "${AWS_ENV_FILE}" .env

echo "Active env switched to ${AWS_ENV_FILE} (copied to .env)"
echo "Run in another terminal: npm run aws:db"