terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # Remote state in GCS. Bucket is created once by scripts/bootstrap.sh
  # (chicken-and-egg: Terraform can't create the bucket that holds its own
  # state). Bucket name is supplied at `terraform init` time via
  # -backend-config=backend.hcl (see backend.hcl.example), so this repo
  # deploys into any project without editing this file.
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region

  # Required for some global APIs (e.g. billingbudgets.googleapis.com) to bill
  # quota against this project rather than the gcloud SDK's own default
  # client project when authenticating with user ADC credentials.
  user_project_override = true
  billing_project        = var.project_id
}
