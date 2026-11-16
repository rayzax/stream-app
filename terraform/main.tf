locals {
  secret_ids = [
    "xtream-server",
    "xtream-username",
    "xtream-password",
    "app-password-hash",
    "session-signing-key",
    "stream-token-hmac-key",
  ]

  required_apis = [
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "billingbudgets.googleapis.com",
    "dns.googleapis.com",
    "domains.googleapis.com",
    "compute.googleapis.com",
    "cloudscheduler.googleapis.com",
    "sts.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)
  project  = var.project_id
  service  = each.value

  disable_on_destroy = false
}

# ---------------------------------------------------------------------------
# Artifact Registry — holds the app image and the homelab proxy image.
# ---------------------------------------------------------------------------
resource "google_artifact_registry_repository" "stream" {
  project       = var.project_id
  location      = var.region
  repository_id = "stream"
  format        = "DOCKER"
  description   = "Stream app + homelab proxy container images"

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# Secret Manager — containers only. Values are populated out-of-band by
# scripts/setup-secrets.sh so plaintext never lands in Terraform state.
# ---------------------------------------------------------------------------
resource "google_secret_manager_secret" "secrets" {
  for_each  = toset(local.secret_ids)
  project   = var.project_id
  secret_id = each.value

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]

  lifecycle {
    # Secret versions are managed by setup-secrets.sh, not Terraform.
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# GCS bucket for the catalog/XMLTV cache (last-good copy for fast cold starts).
# ---------------------------------------------------------------------------
resource "google_storage_bucket" "cache" {
  project                     = var.project_id
  name                        = "${var.project_id}-cache"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true

  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }
}

# ---------------------------------------------------------------------------
# Least-privilege runtime service account for the Cloud Run app.
# ---------------------------------------------------------------------------
resource "google_service_account" "run_runtime" {
  project      = var.project_id
  account_id   = "stream-run-runtime"
  display_name = "Stream Cloud Run runtime SA"
}

resource "google_secret_manager_secret_iam_member" "runtime_secret_access" {
  for_each  = google_secret_manager_secret.secrets
  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run_runtime.email}"
}

resource "google_storage_bucket_iam_member" "runtime_cache_access" {
  bucket = google_storage_bucket.cache.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.run_runtime.email}"
}

resource "google_project_iam_member" "runtime_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.run_runtime.email}"
}

# ---------------------------------------------------------------------------
# Cloud Run service (backend + built frontend, single image).
# ---------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "app" {
  project             = var.project_id
  name                = "stream-app"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false # single personal-use service; revisit once stable

  template {
    service_account       = google_service_account.run_runtime.email
    timeout               = "3600s"
    max_instance_request_concurrency = 20

    scaling {
      min_instance_count = 0
      max_instance_count = var.cloud_run_max_instances
    }

    containers {
      image = var.app_image

      ports {
        container_port = 8080
      }

      env {
        name  = "STREAM_MODE"
        value = var.stream_mode
      }
      env {
        name  = "HOMELAB_PROXY_URL"
        value = var.homelab_proxy_url
      }
      env {
        name  = "CACHE_BUCKET"
        value = google_storage_bucket.cache.name
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      # Cloud Run resolves these to the secret's actual latest value at
      # container start (not a reference) — app code reads them as plain env vars.
      dynamic "env" {
        for_each = {
          XTREAM_SERVER          = "xtream-server"
          XTREAM_USERNAME        = "xtream-username"
          XTREAM_PASSWORD        = "xtream-password"
          APP_PASSWORD_HASH      = "app-password-hash"
          SESSION_SIGNING_KEY    = "session-signing-key"
          STREAM_TOKEN_HMAC_KEY  = "stream-token-hmac-key"
        }
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.secrets[env.value].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_iam_member.runtime_secret_access,
  ]
}

# Public ingress — the app gates access with its own login page (bcrypt +
# signed session cookie), not GCP IAM, since it's a single-user app with no
# Google-account-based auth.
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------------------------------------------------------------------
# Custom domain mapping.
# ---------------------------------------------------------------------------
resource "google_cloud_run_domain_mapping" "app" {
  project  = var.project_id
  location = var.region
  name     = var.domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }

  depends_on = [google_cloud_run_v2_service.app]
}

# ---------------------------------------------------------------------------
# Billing budget alert.
# ---------------------------------------------------------------------------
resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account_id
  display_name    = "${var.project_id}-monthly-${var.budget_amount_usd}"

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_amount_usd)
    }
  }

  threshold_rules { threshold_percent = 0.5 }
  threshold_rules { threshold_percent = 0.9 }
  threshold_rules { threshold_percent = 1.0 }
  threshold_rules { threshold_percent = 1.2 }
}
