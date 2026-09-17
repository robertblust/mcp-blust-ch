output "service_url" { value = google_cloud_run_v2_service.mcp.uri }
output "run_host" { value = local.run_host }
output "hosting_url" { value = google_firebase_hosting_site.this.default_url }
output "dns_records" {
  description = "What the domain needs; create these at the DNS provider of blust.ch"
  value       = google_firebase_hosting_custom_domain.this.required_dns_updates
}
