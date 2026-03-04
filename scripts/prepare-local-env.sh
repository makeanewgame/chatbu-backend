#!/usr/bin/env bash
set -euo pipefail

SOURCE_FILE="${1:-.env.k8s.local}"
TARGET_FILE="${2:-.env.local}"

if [[ ! -f "${SOURCE_FILE}" ]]; then
  echo "Source env file not found: ${SOURCE_FILE}"
  exit 1
fi

cp "${SOURCE_FILE}" "${TARGET_FILE}"

upsert() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "${TARGET_FILE}"; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "${TARGET_FILE}"
  else
    echo "${key}=${value}" >> "${TARGET_FILE}"
  fi
}

SOURCE_DB_URL="$(grep '^DATABASE_URL=' "${SOURCE_FILE}" | sed 's/^DATABASE_URL=//')"
if [[ -n "${SOURCE_DB_URL}" ]]; then
  LOCAL_DB_URL="$(python3 - <<'PY' "${SOURCE_DB_URL}"
import sys
from urllib.parse import urlparse, urlunparse

raw = sys.argv[1]
parsed = urlparse(raw)

userinfo = ""
if parsed.username:
    userinfo += parsed.username
if parsed.password:
    userinfo += f":{parsed.password}"
if userinfo:
    userinfo += "@"

host = "localhost"
port = parsed.port or 5432
netloc = f"{userinfo}{host}:{port}"

updated = parsed._replace(netloc=netloc)
print(urlunparse(updated))
PY
)"
  upsert "DATABASE_URL" "${LOCAL_DB_URL}"
else
  upsert "DATABASE_URL" "postgresql://postgres:postgres@localhost:5432/postgres"
fi

upsert "ELASTICSEARCH_URL" "http://localhost:9200"
upsert "MINIO_ENDPOINT" "localhost"
upsert "MINIO_PORT" "9000"
upsert "MINIO_USE_SSL" "false"
upsert "API_URL" "http://localhost:3001"
upsert "CORS_ORIGIN" "http://localhost:3000"
upsert "FRONTEND_URL" "http://localhost:3000"
upsert "FRONTEND_GOOGLE_REDIRECT_URI" "http://localhost:3000/auth/google/redirect"
upsert "GOOGLE_REDIRECT_URI" "http://localhost:3001/api/auth/google/redirect"

chmod 600 "${TARGET_FILE}"
echo "Prepared local env: ${TARGET_FILE}"