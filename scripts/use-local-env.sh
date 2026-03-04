#!/usr/bin/env bash
set -euo pipefail

SOURCE_FILE="${1:-.env.localdev}"

if [[ ! -f "${SOURCE_FILE}" ]]; then
  if [[ -f ".env.local" ]]; then
    SOURCE_FILE=".env.local"
  else
    echo "Local env file not found: ${SOURCE_FILE}"
    echo "Create once with: cp .env ${SOURCE_FILE}"
    exit 1
  fi
fi

cp "${SOURCE_FILE}" .env
echo "Active env switched to ${SOURCE_FILE} (copied to .env)"