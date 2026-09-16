# Everything below the project that CI may create, applied on merge to main with the image
# the same run pushed. State lives in the bucket the bootstrap made.
terraform {
  required_version = ">= 1.9"
  required_providers {
    google      = { source = "hashicorp/google", version = ">= 6.0, < 8.0" }
    google-beta = { source = "hashicorp/google-beta", version = ">= 6.0, < 8.0" }
  }
  backend "gcs" {
    bucket = "blust-ch-mcp-tfstate"
    prefix = "infra"
  }
}

variable "project" { default = "blust-ch-mcp" }
variable "project_number" { default = "38003987140" }
variable "region" { default = "europe-west6" }
variable "domain" { default = "mcp.blust.ch" }
variable "billing_account" { default = "011DEB-4A45A0-3A52BB" }
variable "image" {
  description = "The image to run, pushed by the same workflow run: <registry>/server:<core>-<commit7>"
  type        = string
}

provider "google" {
  project = var.project
  region  = var.region
}

provider "google-beta" {
  project = var.project
  region  = var.region
}

resource "google_project_service" "main" {
  for_each = toset([
    "run.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
    "billingbudgets.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
  ])
  service                    = each.value
  disable_on_destroy         = false
  disable_dependent_services = false
}
