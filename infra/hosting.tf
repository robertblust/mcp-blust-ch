# Firebase Hosting in front of the service: the attachment, the site, one version whose only
# rule sends /mcp to the service and marks it uncacheable, its release, and the domain.
resource "google_firebase_project" "this" {
  provider   = google-beta
  project    = var.project
  depends_on = [google_project_service.main]
}

resource "google_firebase_hosting_site" "this" {
  provider   = google-beta
  project    = var.project
  site_id    = var.site_id
  depends_on = [google_firebase_project.this]
}

resource "google_firebase_hosting_version" "this" {
  provider = google-beta
  site_id  = google_firebase_hosting_site.this.site_id
  config {
    rewrites {
      glob = "/mcp"
      run {
        service_id = google_cloud_run_v2_service.mcp.name
        region     = google_cloud_run_v2_service.mcp.location
      }
    }
    headers {
      glob    = "/mcp"
      headers = { "Cache-Control" = "no-store" }
    }
  }
}

resource "google_firebase_hosting_release" "this" {
  provider     = google-beta
  site_id      = google_firebase_hosting_site.this.site_id
  version_name = google_firebase_hosting_version.this.name
  message      = "The /mcp rewrite to Cloud Run"
}

resource "google_firebase_hosting_custom_domain" "this" {
  provider              = google-beta
  project               = var.project
  site_id               = google_firebase_hosting_site.this.site_id
  custom_domain         = var.domain
  wait_dns_verification = false
}
