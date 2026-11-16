#!/usr/bin/env bash
# One-time bootstrap: creates the Terraform state bucket, the GitHub Actions
# deploy service account, and Workload Identity Federation binding it to the
# repo — the things Terraform itself can't create because Terraform needs
# them to run. Safe to re-run (idempotent).
#
# Usage: PROJECT_ID=... REGION=... GITHUB_REPO=owner/repo DOMAIN=... BILLING_ACCOUNT_ID=... ./bootstrap.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-stream-iptv-prd}"
REGION="${REGION:-us-central1}"
GITHUB_REPO="${GITHUB_REPO:-rayzax/stream-app}"
DOMAIN="${DOMAIN:-stream.slottedgolf.us}"
BILLING_ACCOUNT_ID="${BILLING_ACCOUNT_ID:-}"
TFSTATE_BUCKET="${PROJECT_ID}-tfstate"
DEPLOY_SA_NAME="stream-deployer"
DEPLOY_SA_EMAIL="${DEPLOY_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
WIF_POOL_ID="github-pool"
WIF_PROVIDER_ID="github-provider"

echo "==> Project: $PROJECT_ID  Region: $REGION  Repo: $GITHUB_REPO"

echo "==> Ensuring GCS tfstate bucket gs://$TFSTATE_BUCKET exists..."
if ! gcloud storage buckets describe "gs://$TFSTATE_BUCKET" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$TFSTATE_BUCKET" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --uniform-bucket-level-access
  gcloud storage buckets update "gs://$TFSTATE_BUCKET" --versioning
else
  echo "    already exists."
fi

echo "==> Ensuring deploy service account $DEPLOY_SA_EMAIL exists..."
if ! gcloud iam service-accounts describe "$DEPLOY_SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$DEPLOY_SA_NAME" \
    --project="$PROJECT_ID" \
    --display-name="Stream GitHub Actions deployer"
else
  echo "    already exists."
fi

echo "==> Granting deploy SA the roles it needs to run Terraform + push images..."
for role in roles/run.admin roles/artifactregistry.admin roles/secretmanager.admin \
            roles/iam.serviceAccountAdmin roles/iam.serviceAccountUser \
            roles/resourcemanager.projectIamAdmin roles/storage.admin \
            roles/serviceusage.serviceUsageAdmin roles/datastore.owner; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$DEPLOY_SA_EMAIL" \
    --role="$role" \
    --condition=None \
    >/dev/null
done

# Billing budget roles are granted on the billing account, not the project.
if [ -n "$BILLING_ACCOUNT_ID" ]; then
  gcloud billing accounts add-iam-policy-binding "$BILLING_ACCOUNT_ID" \
    --member="serviceAccount:$DEPLOY_SA_EMAIL" \
    --role="roles/billing.costsManager" \
    >/dev/null
else
  echo "    BILLING_ACCOUNT_ID not set — skipping roles/billing.costsManager grant."
  echo "    Terraform's billing budget resource will fail to apply until you grant it:"
  echo "    gcloud billing accounts add-iam-policy-binding BILLING_ACCOUNT_ID --member=serviceAccount:$DEPLOY_SA_EMAIL --role=roles/billing.costsManager"
fi

echo "==> Setting up Workload Identity Federation for GitHub Actions..."
if ! gcloud iam workload-identity-pools describe "$WIF_POOL_ID" --project="$PROJECT_ID" --location="global" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$WIF_POOL_ID" \
    --project="$PROJECT_ID" --location="global" \
    --display-name="GitHub Actions pool"
else
  echo "    pool already exists."
fi

if ! gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER_ID" \
      --project="$PROJECT_ID" --location="global" --workload-identity-pool="$WIF_POOL_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER_ID" \
    --project="$PROJECT_ID" --location="global" \
    --workload-identity-pool="$WIF_POOL_ID" \
    --display-name="GitHub provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='${GITHUB_REPO}'"
else
  echo "    provider already exists."
fi

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
WIF_PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL_ID}/providers/${WIF_PROVIDER_ID}"

echo "==> Allowing $GITHUB_REPO to impersonate $DEPLOY_SA_EMAIL..."
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL_ID}/attribute.repository/${GITHUB_REPO}" \
  >/dev/null

echo "==> Setting GitHub repo variables..."
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh variable set GCP_PROJECT_ID --repo "$GITHUB_REPO" --body "$PROJECT_ID"
  gh variable set GCP_REGION --repo "$GITHUB_REPO" --body "$REGION"
  gh variable set WIF_PROVIDER --repo "$GITHUB_REPO" --body "$WIF_PROVIDER_RESOURCE"
  gh variable set WIF_SERVICE_ACCOUNT --repo "$GITHUB_REPO" --body "$DEPLOY_SA_EMAIL"
  gh variable set ARTIFACT_REGISTRY_REPO --repo "$GITHUB_REPO" --body "${REGION}-docker.pkg.dev/${PROJECT_ID}/stream"
  gh variable set TFSTATE_BUCKET --repo "$GITHUB_REPO" --body "$TFSTATE_BUCKET"
  gh variable set DOMAIN --repo "$GITHUB_REPO" --body "$DOMAIN"
  [ -n "$BILLING_ACCOUNT_ID" ] && gh variable set BILLING_ACCOUNT_ID --repo "$GITHUB_REPO" --body "$BILLING_ACCOUNT_ID"
  # Defaults — change later with `gh variable set STREAM_MODE --body homelab` etc.
  gh variable set STREAM_MODE --repo "$GITHUB_REPO" --body "cloudrun" 2>/dev/null || true
  gh variable set HOMELAB_PROXY_URL --repo "$GITHUB_REPO" --body "" 2>/dev/null || true
  echo "    set via gh CLI."
else
  cat <<EOF
    gh CLI not available/authenticated. Set these repo variables manually
    (Settings > Secrets and variables > Actions > Variables) on $GITHUB_REPO:
      GCP_PROJECT_ID          = $PROJECT_ID
      GCP_REGION              = $REGION
      WIF_PROVIDER            = $WIF_PROVIDER_RESOURCE
      WIF_SERVICE_ACCOUNT     = $DEPLOY_SA_EMAIL
      ARTIFACT_REGISTRY_REPO  = ${REGION}-docker.pkg.dev/${PROJECT_ID}/stream
      TFSTATE_BUCKET          = $TFSTATE_BUCKET
      DOMAIN                  = $DOMAIN
      BILLING_ACCOUNT_ID      = $BILLING_ACCOUNT_ID
      STREAM_MODE             = cloudrun
      HOMELAB_PROXY_URL       = (empty)
EOF
fi

echo
echo "==> Done. Next: terraform -chdir=terraform init -backend-config=\"bucket=$TFSTATE_BUCKET\" -backend-config=\"prefix=stream-app\""
