#!/usr/bin/env bash
# Interactively collects the Xtream login and writes it, plus two generated
# signing keys, straight to Secret Manager. Nothing is echoed to the
# terminal, written to disk, or passed as a command-line argument (which
# would leak into shell history / `ps`) — values move through env vars and
# stdin pipes only.
#
# App users (with roles) live in Firestore now, not here — see
# scripts/create-admin-user.sh to provision the first admin.
#
# Usage: PROJECT_ID=... ./setup-secrets.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-stream-iptv-prd}"

create_or_update_secret() {
  local secret_id="$1"
  local value="$2"
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

echo "Stream — Secret Manager setup for project $PROJECT_ID"
echo "Nothing you type here is echoed, logged, or committed."
echo

prompt_secret "Xtream server URL (e.g. http://provider.example:8080)" XTREAM_SERVER
prompt_secret "Xtream username" XTREAM_USERNAME
prompt_secret "Xtream password" XTREAM_PASSWORD

echo "Generating session signing key + stream token HMAC key..."
SESSION_SIGNING_KEY=$(openssl rand -base64 32)
STREAM_TOKEN_HMAC_KEY=$(openssl rand -base64 32)

echo
echo "Writing secrets to Secret Manager (project: $PROJECT_ID)..."
create_or_update_secret "xtream-server"         "$XTREAM_SERVER"
create_or_update_secret "xtream-username"       "$XTREAM_USERNAME"
create_or_update_secret "xtream-password"       "$XTREAM_PASSWORD"
create_or_update_secret "session-signing-key"   "$SESSION_SIGNING_KEY"
create_or_update_secret "stream-token-hmac-key" "$STREAM_TOKEN_HMAC_KEY"

unset XTREAM_SERVER XTREAM_USERNAME XTREAM_PASSWORD SESSION_SIGNING_KEY STREAM_TOKEN_HMAC_KEY

echo
echo "Done. Re-run any time to rotate a value — it adds a new version, old versions stay in history."
echo "Next: PROJECT_ID=$PROJECT_ID ./scripts/create-admin-user.sh to provision your first admin login."
