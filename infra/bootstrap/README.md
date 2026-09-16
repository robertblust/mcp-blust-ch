# Bootstrap

What GitHub Actions needs before it can authenticate: the state bucket, the identity pool and
its GitHub provider, the two service accounts and the image registry. The owner applies it once,
locally, with local state that stays on their machine, and again only when a repository joins.

    gcloud auth application-default login
    gcloud config set project blust-ch-mcp
    docker run --rm -it -v "$PWD":/w -w /w -v "$HOME/.config/gcloud":/root/.config/gcloud hashicorp/terraform:1.9.8 init
    docker run --rm -it -v "$PWD":/w -w /w -v "$HOME/.config/gcloud":/root/.config/gcloud hashicorp/terraform:1.9.8 apply

The budget in `../` needs one role this configuration cannot grant, because it sits on the
billing account and not in the project: give `terraform@blust-ch-mcp.iam.gserviceaccount.com`
the Billing Account Costs Manager role on the billing account in the console, once.
