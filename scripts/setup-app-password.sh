#!/usr/bin/env bash
# Sets app-password-hash, session-signing-key, and stream-token-hmac-key in
# Secret Manager. Split out from setup-secrets.sh so it can be re-run alone
# (e.g. to rotate the app password) without re-entering Xtream credentials.
# Nothing typed here is echoed, logged, or committed.
#
# Usage: PROJECT_ID=... ./setup-app-password.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-stream-iptv-prd}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

create_or_update_secret() {
  local secret_id="$1" value="$2"
  if ! gcloud secrets describe "$secret_id" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$secret_id" --project="$PROJECT_ID" --replication-policy=automatic >/dev/null
  fi
  printf '%s' "$value" | gcloud secrets versions add "$secret_id" --project="$PROJECT_ID" --data-file=- >/dev/null
  echo "  -> $secret_id updated."
}

prompt_secret() {
  local prompt_text="$1" var_name="$2" value=""
  read -r -s -p "$prompt_text: " value
  echo
  printf -v "$var_name" '%s' "$value"
}

echo "Stream — app password setup for project $PROJECT_ID"
echo "Nothing you type here is echoed, logged, or committed."
echo

prompt_secret "App login password (what you'll type on the Stream login page)" APP_PASSWORD
prompt_secret "Confirm app login password" APP_PASSWORD_CONFIRM

if [ "$APP_PASSWORD" != "$APP_PASSWORD_CONFIRM" ]; then
  echo "ERROR: passwords didn't match. Nothing was written." >&2
  exit 1
fi

if [ ! -d "$REPO_ROOT/apps/api/node_modules/bcrypt" ]; then
  echo "ERROR: bcrypt not found at $REPO_ROOT/apps/api/node_modules/bcrypt — run 'npm install' in apps/api first." >&2
  exit 1
fi

echo "Hashing app password with bcrypt locally..."
APP_PASSWORD_HASH=$(NODE_PATH="$REPO_ROOT/apps/api/node_modules" APP_PW="$APP_PASSWORD" node -e '
const bcrypt = require("bcrypt");
bcrypt.hash(process.env.APP_PW, 12).then((h) => { process.stdout.write(h); process.exit(0); });
')

echo "Generating session signing key + stream token HMAC key..."
SESSION_SIGNING_KEY=$(openssl rand -base64 32)
STREAM_TOKEN_HMAC_KEY=$(openssl rand -base64 32)

echo
echo "Writing secrets to Secret Manager (project: $PROJECT_ID)..."
create_or_update_secret "app-password-hash"     "$APP_PASSWORD_HASH"
create_or_update_secret "session-signing-key"   "$SESSION_SIGNING_KEY"
create_or_update_secret "stream-token-hmac-key" "$STREAM_TOKEN_HMAC_KEY"

unset APP_PASSWORD APP_PASSWORD_CONFIRM APP_PASSWORD_HASH SESSION_SIGNING_KEY STREAM_TOKEN_HMAC_KEY APP_PW

echo
echo "Done. Re-run any time to rotate the app password."
