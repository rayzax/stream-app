#!/usr/bin/env bash
# Provisions a user directly in Firestore. Use this once to create your
# first admin (nothing exists yet to log in with otherwise); after that,
# admins can create/manage users from the Admin Portal in the app itself.
#
# Nothing typed here is echoed, logged, or committed.
#
# Usage: PROJECT_ID=... ROLE=admin ./scripts/create-admin-user.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-stream-iptv-prd}"
ROLE="${ROLE:-admin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if [ ! -d "$REPO_ROOT/apps/api/node_modules/bcrypt" ] || [ ! -d "$REPO_ROOT/apps/api/node_modules/@google-cloud/firestore" ]; then
  echo "ERROR: dependencies not found under apps/api/node_modules — run 'npm install' from the repo root first." >&2
  exit 1
fi

read -r -p "Username: " USERNAME
read -r -s -p "Password (min 8 chars): " PASSWORD
echo
read -r -s -p "Confirm password: " PASSWORD_CONFIRM
echo

if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
  echo "ERROR: passwords didn't match. Nothing was written." >&2
  exit 1
fi
if [ "${#PASSWORD}" -lt 8 ]; then
  echo "ERROR: password must be at least 8 characters." >&2
  exit 1
fi

echo "Creating $ROLE user '$USERNAME' in project $PROJECT_ID..."

NODE_PATH="$REPO_ROOT/apps/api/node_modules" \
GOOGLE_CLOUD_PROJECT="$PROJECT_ID" \
GCLOUD_PROJECT="$PROJECT_ID" \
STREAM_USERNAME="$USERNAME" STREAM_PASSWORD="$PASSWORD" STREAM_ROLE="$ROLE" \
node -e '
const { Firestore } = require("@google-cloud/firestore");
const bcrypt = require("bcrypt");

async function main() {
  const db = new Firestore();
  const username = process.env.STREAM_USERNAME.trim().toLowerCase();
  const role = process.env.STREAM_ROLE;

  const existing = await db.collection("users").where("username", "==", username).limit(1).get();
  if (!existing.empty) {
    console.error(`ERROR: username "${username}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(process.env.STREAM_PASSWORD, 12);
  const ref = await db.collection("users").add({
    username,
    passwordHash,
    role,
    disabled: false,
    createdAt: new Date().toISOString(),
  });
  console.log(`Created user "${username}" (role: ${role}, id: ${ref.id}).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
'

unset PASSWORD PASSWORD_CONFIRM

echo "Done. Sign in at the app's /login page with that username and password."
