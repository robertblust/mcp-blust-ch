# The service: one container, the snapshot inside it, no role, answering only to its two names.
resource "google_service_account" "run" {
  account_id   = "mcp-run"
  display_name = "Runtime of the MCP service, holding no role"
  depends_on   = [google_project_service.main]
}

locals {
  run_host = "mcp-${var.project_number}.${var.region}.run.app"
}

resource "google_cloud_run_v2_service" "mcp" {
  name                = "mcp"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.run.email
    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }
    containers {
      image = var.image
      ports { container_port = 8080 }
      resources {
        limits = { cpu = "1", memory = "256Mi" }
      }
      env {
        name  = "MCP_ALLOWED_HOSTS"
        value = "${var.domain},${local.run_host}"
      }
    }
  }
  depends_on = [google_project_service.main]
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.mcp.name
  location = google_cloud_run_v2_service.mcp.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
