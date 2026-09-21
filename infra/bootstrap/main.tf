# What has to exist before GitHub Actions can authenticate and push: applied by the owner under
# their own login, with local state, and changed only when the module or the repository changes.
# Everything below the project that CI can create lives in ../ and is applied by CI. The
# resources are the shared module's, and this deployment's own values come from deployment.json.
terraform {
  required_version = ">= 1.9"
  required_providers {
    google = { source = "hashicorp/google", version = ">= 6.0, < 8.0" }
  }
}

locals { d = jsondecode(file("${path.module}/../../deployment.json")) }

# The Organization Policy API bills its calls to a quota project, and a user's local
# credentials name none, so the provider names this project rather than gcloud's default. A
# module cannot configure its own provider and still serve more than one deployment, which is
# why this block lives here and not in the module.
provider "google" {
  project               = local.d.project
  region                = local.d.region
  user_project_override = true
  billing_project       = local.d.project
}

module "bootstrap" {
  source          = "git::https://github.com/companygraph/mcp-server.git//deploy/bootstrap?ref=v0.18.0"
  project         = local.d.project
  region          = local.d.region
  project_number  = local.d.project_number
  organization    = local.d.organization
  billing_account = local.d.billing_account
  repository      = local.d.repository
  repository_id   = local.d.repository_id
}

# These resources were declared in this root until the module held them. A move renames an
# address in the state and leaves the resource where it is.
moved {
  from = google_project_service.bootstrap
  to   = module.bootstrap.google_project_service.bootstrap
}
moved {
  from = google_storage_bucket.state
  to   = module.bootstrap.google_storage_bucket.state
}
moved {
  from = google_artifact_registry_repository.mcp
  to   = module.bootstrap.google_artifact_registry_repository.mcp
}
moved {
  from = google_iam_workload_identity_pool.github
  to   = module.bootstrap.google_iam_workload_identity_pool.github
}
moved {
  from = google_iam_workload_identity_pool_provider.github
  to   = module.bootstrap.google_iam_workload_identity_pool_provider.github
}
moved {
  from = google_org_policy_policy.allow_public_members
  to   = module.bootstrap.google_org_policy_policy.allow_public_members
}
moved {
  from = google_service_account.terraform
  to   = module.bootstrap.google_service_account.terraform
}
moved {
  from = google_project_iam_member.terraform
  to   = module.bootstrap.google_project_iam_member.terraform
}
moved {
  from = google_billing_account_iam_member.terraform_budgets
  to   = module.bootstrap.google_billing_account_iam_member.terraform_budgets
}
moved {
  from = google_storage_bucket_iam_member.terraform_state
  to   = module.bootstrap.google_storage_bucket_iam_member.terraform_state
}
moved {
  from = google_service_account_iam_member.terraform_wif
  to   = module.bootstrap.google_service_account_iam_member.terraform_wif
}
moved {
  from = google_service_account.deploy
  to   = module.bootstrap.google_service_account.deploy
}
moved {
  from = google_artifact_registry_repository_iam_member.deploy
  to   = module.bootstrap.google_artifact_registry_repository_iam_member.deploy
}
moved {
  from = google_service_account_iam_member.deploy_wif
  to   = module.bootstrap.google_service_account_iam_member.deploy_wif
}

output "workload_identity_provider" { value = module.bootstrap.workload_identity_provider }
output "terraform_service_account" { value = module.bootstrap.terraform_service_account }
output "plan_service_account" { value = module.bootstrap.plan_service_account }
output "deploy_service_account" { value = module.bootstrap.deploy_service_account }
output "registry" { value = module.bootstrap.registry }
output "state_bucket" { value = module.bootstrap.state_bucket }
