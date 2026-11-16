variable "project_id" {
  description = "GCP project ID to deploy into."
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run, Artifact Registry, and the cache bucket."
  type        = string
  default     = "us-central1"
}

variable "domain" {
  description = "Custom domain to map to the Cloud Run service, e.g. stream.slottedgolf.us."
  type        = string
}

variable "billing_account_id" {
  description = "Billing account ID to attach the budget alert to."
  type        = string
}

variable "budget_amount_usd" {
  description = "Monthly billing budget alert amount in USD."
  type        = number
  default     = 25
}

variable "stream_mode" {
  description = "Which proxy serves video: \"cloudrun\" (Cloud Run proxies video itself) or \"homelab\" (a homelab proxy is used, with Cloud Run as fallback)."
  type        = string
  default     = "cloudrun"

  validation {
    condition     = contains(["cloudrun", "homelab"], var.stream_mode)
    error_message = "stream_mode must be \"cloudrun\" or \"homelab\"."
  }
}

variable "homelab_proxy_url" {
  description = "Base URL of the homelab stream proxy (used when stream_mode = \"homelab\"). Empty disables homelab mode regardless of stream_mode."
  type        = string
  default     = ""
}

variable "app_image" {
  description = "Fully-qualified container image for the Cloud Run app service (backend + built frontend), e.g. REGION-docker.pkg.dev/PROJECT/stream/app:TAG. Supplied by CI on each deploy."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello" # placeholder for first `terraform apply` before CI has pushed a real image
}

variable "github_repo" {
  description = "GitHub repo (owner/repo) allowed to deploy via Workload Identity Federation, e.g. rayzax/stream-app."
  type        = string
}

variable "cloud_run_max_instances" {
  description = "Max Cloud Run instances for the app service."
  type        = number
  default     = 3
}
