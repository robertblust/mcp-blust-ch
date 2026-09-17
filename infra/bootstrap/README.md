# Bootstrap

What GitHub Actions needs before it can authenticate: the state bucket, the identity pool and
its GitHub provider, the two service accounts and the image registry. The owner applies it once,
locally, with local state that stays on their machine, and again only when a repository joins.

    gcloud auth application-default login
    gcloud config set project blust-ch-mcp
    docker run --rm -it -v "$PWD":/w -w /w -v "$HOME/.config/gcloud":/root/.config/gcloud hashicorp/terraform:1.9.8 init
    docker run --rm -it -v "$PWD":/w -w /w -v "$HOME/.config/gcloud":/root/.config/gcloud hashicorp/terraform:1.9.8 apply

The budget in `../` is a resource of the billing account, not of the project, and only a
billing administrator can grant the role that creates it. The owner is one, so this
configuration grants `terraform@blust-ch-mcp.iam.gserviceaccount.com` the Billing Account
Costs Manager role on the billing account; CI's own account never could.

The project belongs to the flatland.ch organization, whose domain-restricted sharing refuses a
binding to `allUsers`, and a public server is nothing but such a binding. This configuration
overrides that policy on the project alone. Setting an organization policy needs the
Organization Policy Administrator role, which an Organization Administrator can grant to
themselves once:

    gcloud organizations add-iam-policy-binding 14986580178 \
      --member=user:robert.blust@flatland.ch --role=roles/orgpolicy.policyAdmin
