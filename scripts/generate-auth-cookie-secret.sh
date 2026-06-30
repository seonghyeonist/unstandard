#!/usr/bin/env bash
# Generate AUTH_COOKIE_SECRET for Vercel Production + Preview.
# Usage: ./scripts/generate-auth-cookie-secret.sh
# Output: base64url secret (32 random bytes). Copy once into Vercel env — never commit.

set -euo pipefail

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required" >&2
  exit 1
fi

SECRET="$(openssl rand -base64 32 | tr -d '\n' | tr '+/' '-_' | tr -d '=')"

echo "AUTH_COOKIE_SECRET (copy to Vercel Production + Preview):"
echo "${SECRET}"
echo
echo "Notes:"
echo "  - Set the same value on Production AND Preview if both use Supabase auth."
echo "  - Rotating invalidates existing unlock cookies (expected after reset)."
echo "  - Do not paste this into git, issues, or chat logs."
