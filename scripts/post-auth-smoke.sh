#!/usr/bin/env bash
# Post-deploy auth smoke (no magic link — safe to run before rate limit clears).
# Usage: BASE_URL=https://your-domain.example ./scripts/post-auth-smoke.sh

set -euo pipefail

BASE_URL="${BASE_URL:-}"
if [[ -z "${BASE_URL}" ]]; then
  echo "Usage: BASE_URL=https://your-domain.example $0" >&2
  exit 1
fi

BASE_URL="${BASE_URL%/}"

echo "== Auth smoke: ${BASE_URL} =="
echo

check_status() {
  local path="$1"
  local expected="$2"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}${path}")"
  if [[ "${code}" == "${expected}" ]]; then
    echo "PASS  ${path} -> HTTP ${code}"
  else
    echo "FAIL  ${path} -> HTTP ${code} (expected ${expected})"
    return 1
  fi
}

fail=0
check_status "/login" "200" || fail=1
check_status "/app/settings" "307" || check_status "/app/settings" "302" || fail=1
check_status "/api/auth/session" "401" || fail=1

echo
if [[ "${fail}" -eq 0 ]]; then
  echo "Pre-login checks passed. After magic link: open ${BASE_URL}/app/settings in browser."
else
  echo "One or more checks failed. Fix env/redeploy before magic link test."
  exit 1
fi
