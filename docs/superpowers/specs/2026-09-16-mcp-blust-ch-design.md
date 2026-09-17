# mcp.blust.ch — design

The reference instance, `robertblust/mental-model`, served over MCP at
`https://mcp.blust.ch/mcp`. This repository pins one commit of the model and one release of
`companygraph/mcp-server`, builds an image that bakes the model's snapshot, and runs it on
Cloud Run in Zurich behind Firebase Hosting. Everything below the Google Cloud project is
Terraform, applied by GitHub Actions.

Brief: `brief-mcp-server.md` of 2026-09-16. The server's own design is in
`companygraph/mcp-server`.

## 1. Decisions

- **Pins.** `source.json` names `{ "repo": "robertblust/mental-model", "commit": "<sha>" }`,
  as blust.ch's does. `package.json` pins `companygraph-mcp-server` by git tag. Moving either
  is an editorial act made in a pull request.
- **Build-time snapshot.** The build fetches the model at the pinned commit, writes the
  snapshot with the server's own tool, and bakes it into the image. The image tag is
  `<core version>-<short commit>`, followed by this repository's own short commit, so a merge
  that changes only the server still rolls a new revision, and the server reports the core
  version, the model commit and the parser tag in every answer.
- **Hosting.** Google Cloud project `blust-ch-mcp`. Cloud Run in `europe-west6`, 256 MiB,
  min 0 and max 3 instances, unauthenticated invocation, a runtime service account holding no
  role. Firebase Hosting rewrites `/mcp` to the service and carries the custom domain
  `mcp.blust.ch`. `Cache-Control: no-store` on `/mcp`.
- **Terraform, two roots.** `infra/bootstrap/` holds what must exist before CI can
  authenticate and is applied once by the owner. `infra/` holds everything else and is applied
  by CI. APIs are enabled by Terraform, one `google_project_service` each, with
  `disable_on_destroy = false` and `disable_dependent_services = false`, so an API already on
  is adopted and never switched off.
- **CI.** GitHub Actions authenticates with Workload Identity Federation. No key anywhere.
  Two identities: `terraform` applies infrastructure and `deploy` pushes images, and neither
  holds the other's roles.
- **Registry.** Server name `ch.blust/mental-model`, DNS authentication on `blust.ch`,
  `server.json` generated from the snapshot and the release tag, published only on a tag and
  only after the owner approves the run.
- **No surface file** in the model for this surface: the build is the projection.

## 2. Shape of the repository

```
mcp-blust-ch
├── source.json              the model commit
├── package.json             the server by tag; scripts: snapshot, test
├── build/
│   └── snapshot.mjs         reads source.json, calls the server's snapshot tool, writes snapshot.json
├── build/server-json.mjs    writes server.json from snapshot.json and a version
├── Dockerfile
├── infra/
│   ├── bootstrap/           state bucket, identity pool and provider, two service accounts
│   └── *.tf                 the project's resources
├── .github/workflows/
│   ├── deploy.yml           PR: snapshot, tests, plan; main: image, apply
│   ├── publish.yml          tag: server.json, registry publish behind approval
│   └── conventions.yml
├── test/                    the seven tools against the real snapshot
├── docs/superpowers/
└── README.md                title "mcp.blust.ch"
```

`snapshot.json` and `server.json` are build outputs and gitignored.

## 3. The build

`npm run snapshot` reads `source.json` and runs
`companygraph-mcp-snapshot --github robertblust/mental-model@<sha> --sub model/ --core meta/core/`.
The result carries the commit, the repository, the core version from the instance's vendored
manifest and the parser tag.

The Dockerfile is `node:22-slim`: copy `package.json` and the lockfile, `npm ci --omit=dev`,
copy `snapshot.json`, run `companygraph-mcp-http --snapshot snapshot.json`. `PORT` comes from
Cloud Run; `MCP_ALLOWED_HOSTS` is set by Terraform on the service to `mcp.blust.ch` and the
service's own `run.app` hostname. Which Host header Firebase forwards is verified in the
plan before the value is fixed, and the list is widened if Hosting rewrites the header. The
site's own `web.app` and `firebaseapp.com` names are not in the list and are refused on
purpose: the surface has one address.

## 4. Infrastructure

**Bootstrap** (`infra/bootstrap/`, local state, applied once by the owner under their login):

- the state bucket `blust-ch-mcp-tfstate` in `europe-west6`, versioned;
- the APIs the bootstrap itself needs: IAM, IAM Credentials, Security Token Service, Cloud
  Resource Manager, Service Usage, Storage, Artifact Registry;
- one Workload Identity pool `github` with a GitHub OIDC provider whose attribute condition
  admits `robertblust/mcp-blust-ch` only;
- the service account `terraform` with `roles/run.admin`, `roles/iam.serviceAccountAdmin`,
  `roles/iam.serviceAccountUser`, `roles/serviceusage.serviceUsageAdmin`,
  `roles/firebase.admin`, `roles/firebasehosting.admin`, `roles/artifactregistry.reader`,
  object admin on the state bucket — no project-level IAM role, since `infra/` makes no
  project-level binding, and no monitoring role, since the budget notifies the billing
  admins by default — and `roles/iam.workloadIdentityUser` for the pool's principal set
  of the whole repository, since the workflows that need it run on pull requests and on `main`
  alike and a fork gets no token;
- the service account `deploy` with `roles/artifactregistry.writer` and the same pool binding;
- the Artifact Registry repository `mcp` itself, because the first image is pushed before the
  main configuration has ever been applied, and a push needs a repository to land in.

The budget needs a role on the billing account, which no project-level Terraform can grant;
the owner grants `terraform` the Billing Account Costs Manager role there by hand, once.

**Main** (`infra/`, state in the bucket, applied by CI):

- the remaining APIs: Cloud Run, Artifact Registry, Firebase, Firebase Hosting, Billing
  Budgets, Logging, Monitoring;
- the runtime service account `mcp-run` with no role;
- Cloud Run v2 service `mcp` in `europe-west6`: image from the `image` variable, 256 MiB,
  `min_instance_count = 0`, `max_instance_count = 3`, ingress all, `MCP_ALLOWED_HOSTS`,
  and an IAM binding giving `allUsers` `roles/run.invoker`;
- `google_firebase_project` attaching Firebase, `google_firebase_hosting_site` with its own id
  `mcp-blust-ch`, since the default site's id is the project id and Firebase may create that
  one itself, a `google_firebase_hosting_version` whose config rewrites `/mcp` to the
  service in its region and sets `Cache-Control: no-store` on `/mcp`, and its release;
- `google_firebase_hosting_custom_domain` for `mcp.blust.ch` with
  `wait_dns_verification = false`;
- a `google_billing_budget` of 10 in the billing account's currency, thresholds 0.5, 0.9 and
  1.0, notifying billing admins. The currency is read from the billing account before the
  value is fixed;
- outputs: the service URL and the custom domain's `required_dns_updates`.

## 5. Workflow

`deploy.yml`:

- **On a pull request:** `npm ci`, `npm run snapshot`, `npm test`, then `terraform init` and
  `terraform plan` as `terraform`, the plan posted as a comment on the pull request. The image
  variable is the tag this pull request would build, so the plan shows the revision change;
  the image itself is not pushed.
- **On push to `main`:** the same build and tests, then `docker build` and push to Artifact
  Registry as `deploy`, then `terraform apply -var image=<tag>` as `terraform`, which rolls
  the revision. A final step calls `/healthz` on the service URL and fails unless the reported
  commit is the one in `source.json`.

`publish.yml`, on a tag `v*`, in a GitHub environment `registry` that requires the owner's
review: build the snapshot, write `server.json` with `version` set to the tag, install
`mcp-publisher`, `login dns --domain blust.ch --private-key` from the `MCP_PRIVATE_KEY` secret,
`publish`.

`server.json` is generated:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "ch.blust/mental-model",
  "title": "<identity H1>",
  "description": "<identity H1>: <vision H1>",
  "version": "<tag>",
  "remotes": [{ "type": "streamable-http", "url": "https://mcp.blust.ch/mcp" }]
}
```

The description is under the registry's 100-character limit by construction; the build fails
if it is not.

## 6. Tests and verification

`npm test` runs the server's seven tools in-process against the real snapshot: every type the
instance declares lists and describes; `get_entity` on the identity and on one entity per
type; `find_evidence` on one skill the profile claims, with the Evidence cell verbatim;
`search` and `fetch` round-trip; `fetch` of the identity's name refuses if a profile shares it,
and resolves otherwise. Every answer carries the commit in `source.json`.

The plan ends with a written parity report, not a test: three questions — which skills are
Expert and on what evidence, what was built at LIKE MAGIC, what does he hold to — asked of the
deployed server and of the skill bundle `companygraph-export` produces from the same commit.
Any difference is reported as a model or projection defect and not fixed here.

Acceptance, from the brief: the MCP Inspector connects to the local stdio server and to the
deployed URL and lists seven tools; `https://mcp.blust.ch/mcp` answers from `europe-west6`
with no auth; the custom connector works in Claude, with the same manual check in ChatGPT
Developer Mode; a moved model pin rebuilds and reports the new commit.

## 7. The owner's steps

1. The project `blust-ch-mcp` exists with billing linked. Done.
2. Apply `infra/bootstrap/` once, locally, and grant `terraform` the Billing Account Costs
   Manager role on the billing account.
3. Create the DNS records Terraform outputs for `mcp.blust.ch`.
4. Generate the registry Ed25519 key with OpenSSL 3, publish the TXT record at the apex of
   `blust.ch`, store the private key as the `MCP_PRIVATE_KEY` secret.
5. Review the `registry` environment run when the first publish is ready.
6. Add `build` to the `protect-main` ruleset beside `conventions / conventions`, once the job
   has reported on `main`. (The controller does the ruleset edit itself; the spec records it.)

## 8. Family membership

The conventions recipe from the first commit, README title "mcp.blust.ch", a row in
`REPOSITORIES.md` after the connector, commits and pull request bodies in prose ending
`Verified: …`, and a pull request is opened and left for the owner to merge.

## 9. Out of scope

Any commit to `companygraph/meta-model` or `robertblust/mental-model`; WebMCP on blust.ch;
write tools, authentication, rate limiting beyond max instances; publishing before approval;
anything about identity, the email address or naming.
