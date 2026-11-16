output "cloud_run_url" {
  description = "Default *.run.app URL for the app service."
  value       = google_cloud_run_v2_service.app.uri
}

output "custom_domain" {
  description = "Custom domain mapped to the service."
  value       = var.domain
}

output "dns_records_to_add" {
  description = "DNS records to create at your domain's DNS provider to finish the domain mapping. `name` is already relative to your root zone (e.g. \"stream\" under slottedgolf.us) — enter it as-is in most DNS UIs; use the full domain only if your provider requires an FQDN."
  value = [
    for r in google_cloud_run_domain_mapping.app.status[0].resource_records : {
      type = r.type
      name = r.name == "" ? "@ (root)" : r.name
      data = r.rrdata
    }
  ]
}

output "artifact_registry_repo" {
  description = "Artifact Registry repo for app + homelab proxy images."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.stream.repository_id}"
}

output "cache_bucket_name" {
  description = "GCS bucket used for the catalog/XMLTV cache."
  value       = google_storage_bucket.cache.name
}

output "runtime_service_account" {
  description = "Cloud Run runtime service account email."
  value       = google_service_account.run_runtime.email
}
