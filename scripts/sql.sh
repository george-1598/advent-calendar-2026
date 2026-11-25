#!/usr/bin/env bash
# Run SQL against the Supabase project through the Management API.
#   scripts/sql.sh path/to/file.sql
#   echo "select 1" | scripts/sql.sh
# The access token is read from SUPABASE_ACCESS_TOKEN or the macOS keychain
# entry created by `npx supabase login` — it is never stored in this repo.
set -euo pipefail

PROJECT_REF="bqxkqiugvsclczhnszlp"
TOKEN="${SUPABASE_ACCESS_TOKEN:-$(security find-generic-password -s 'Supabase CLI' -a supabase -w 2>/dev/null || true)}"
TOKEN="${TOKEN#go-keyring-base64:}"
if [[ "$TOKEN" != sbp_* ]]; then TOKEN="$(printf '%s' "$TOKEN" | base64 -d 2>/dev/null || true)"; fi
if [[ "$TOKEN" != sbp_* ]]; then
  echo "No Supabase access token found. Run: npx supabase login --token sbp_..." >&2
  exit 1
fi

SQL="$(cat "${1:-/dev/stdin}")"
BODY="$(python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' <<<"$SQL")"

curl -sS --fail-with-body \
  -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary "$BODY"
echo
