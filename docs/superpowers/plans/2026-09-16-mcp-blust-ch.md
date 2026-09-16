# mcp.blust.ch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The reference instance served over MCP at `https://mcp.blust.ch/mcp`, from one pinned commit of the model and one release of the server, on Cloud Run in Zurich behind Firebase Hosting, with everything below the project managed by Terraform that GitHub Actions applies.

**Architecture:** `source.json` pins the model commit and `package.json` pins `companygraph-mcp-server` at `v0.1.0`. A build fetches the model at the commit, writes `snapshot.json` with the server's own tool, and bakes it into a `node:22-slim` image. `infra/bootstrap/` holds what CI needs before it can authenticate (state bucket, identity pool, two service accounts, the image registry) and is applied once by the owner; `infra/` holds everything else and is applied by CI on merge, with the image tag as a variable, so a merge rolls the revision. A tag publishes `server.json` to the MCP Registry behind an environment that requires the owner's review.

**Tech Stack:** Node 22 ESM, `companygraph-mcp-server` v0.1.0, Docker, Terraform >= 1.9 with the `google` and `google-beta` providers, Google Cloud (Cloud Run, Artifact Registry, Firebase Hosting, Workload Identity Federation, Billing Budgets), GitHub Actions, `mcp-publisher`.

**Spec:** `docs/superpowers/specs/2026-09-16-mcp-blust-ch-design.md`

## Global Constraints

- Google Cloud project `blust-ch-mcp`, project number `38003987140`, billing account `011DEB-4A45A0-3A52BB` in CHF. Region `europe-west6`.
- Model pin: `robertblust/mental-model` at `2fd146fe669ef80f7d7b8090ad1cf533b9020ebc` (its main on 2026-09-16, core 0.25.2 vendored). Server pin: `github:companygraph/mcp-server#v0.1.0`. Moving either is an editorial act made in its own pull request.
- Image: `europe-west6-docker.pkg.dev/blust-ch-mcp/mcp/server:<core version>-<short commit>`, for example `0.25.2-2fd146f`.
- Cloud Run: service `mcp`, 256 MiB, min 0 and max 3 instances, ingress all, `allUsers` may invoke, runtime service account `mcp-run` with no role, `MCP_ALLOWED_HOSTS=mcp.blust.ch,mcp-38003987140.europe-west6.run.app`.
- Firebase Hosting: site id `mcp-blust-ch`, rewrite `/mcp` to the service, `Cache-Control: no-store` on `/mcp`, custom domain `mcp.blust.ch`.
- Budget: CHF 10 per month, thresholds 0.5, 0.9 and 1.0, notifying the billing admins.
- APIs are enabled by Terraform with `disable_on_destroy = false` and `disable_dependent_services = false`, never by hand.
- CI authenticates with Workload Identity Federation only: no key anywhere. Two identities: `terraform@blust-ch-mcp.iam.gserviceaccount.com` applies infrastructure, `deploy@blust-ch-mcp.iam.gserviceaccount.com` pushes images; neither holds the other's roles.
- Registry: name `ch.blust/mental-model`, DNS authentication on `blust.ch`, `server.json` generated, version = the git tag, publish only in the `registry` environment after the owner's review.
- No surface file in the model. Nothing here commits to `robertblust/mental-model` or `companygraph/meta-model`.
- Everything that is a build output (`snapshot.json`, `server.json`, `.terraform/`, `*.tfstate*`, `node_modules/`) is gitignored.
- Terraform is not installed on the owner's machine; validation runs in Docker: `docker run --rm -v "$PWD":/w -w /w hashicorp/terraform:1.9.8 <cmd>`. Docker 28 is installed.
- Commits and pull request bodies are prose, no headings or bullets, ending with a `Verified: …` line and then the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Read `conventions/WRITING.md` and `conventions/WORKING.md` before writing one. `sh conventions/conventions-check` passes before every commit.
- Work on branch `build`. One pull request at the end of Task 7; merging is the owner's call. Tasks 8 and 9 happen after the merge and the owner's bootstrap.

---

## File structure

| File | Responsibility |
| --- | --- |
| `source.json` | the model pin |
| `package.json` | the server pin; scripts `snapshot`, `server-json`, `test` |
| `build/snapshot.mjs` | reads `source.json`, runs the server's snapshot command, writes `snapshot.json` |
| `build/server-json.mjs` | writes `server.json` from `snapshot.json` and a version |
| `build/tag.mjs` | prints the image tag for a snapshot |
| `Dockerfile` | `node:22-slim`, the server, the snapshot |
| `infra/bootstrap/*.tf` | state bucket, pool and provider, two service accounts, image registry |
| `infra/*.tf` | APIs, runtime account, Cloud Run, Firebase, Hosting, domain, budget |
| `.github/workflows/deploy.yml` | PR: snapshot, tests, plan; main: image, apply, health check |
| `.github/workflows/publish.yml` | tag: server.json, registry publish |
| `test/tools.test.mjs` | the seven tools against the real snapshot |
| `test/server-json.test.mjs` | the generated entry and its limits |
| `docs/superpowers/reports/2026-09-16-parity.md` | the parity report, Task 9 |

---

### Task 1: Pins, snapshot build, tests

**Files:**
- Create: `source.json`, `package.json`, `build/snapshot.mjs`, `build/tag.mjs`, `test/tools.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run snapshot` writes `snapshot.json` at the repository root; `node build/tag.mjs` prints `<core>-<commit7>`; `npm test` runs `node --test 'test/*.test.mjs'`.

- [ ] **Step 1: Branch, pins and package**

```bash
git checkout -b build
```

`source.json`:

```json
{ "repo": "robertblust/mental-model", "commit": "2fd146fe669ef80f7d7b8090ad1cf533b9020ebc" }
```

`package.json`:

```json
{
  "name": "mcp-blust-ch",
  "version": "0.1.0",
  "private": true,
  "description": "mcp.blust.ch: the reference instance served over MCP",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "snapshot": "node build/snapshot.mjs",
    "server-json": "node build/server-json.mjs",
    "test": "node --test 'test/*.test.mjs'"
  },
  "dependencies": {
    "companygraph-mcp-server": "github:companygraph/mcp-server#v0.1.0"
  },
  "devDependencies": {
    "@modelcontextprotocol/client": "^2.0.0"
  }
}
```

Append to `.gitignore` so it reads:

```
node_modules/
snapshot.json
server.json
.terraform/
*.tfstate
*.tfstate.backup
.terraform.lock.hcl
```

Run `npm install` and keep `package-lock.json`.

- [ ] **Step 2: Write the failing test**

`test/tools.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "companygraph-mcp-server";
import { listTypes, getEntity, findEvidence, search, fetchEntity, ModelError } from "companygraph-mcp-server/model";

const root = new URL("..", import.meta.url);
const source = JSON.parse(fs.readFileSync(new URL("source.json", root), "utf8"));
const s = JSON.parse(fs.readFileSync(new URL("snapshot.json", root), "utf8"));

test("the snapshot is the pinned commit of the pinned repository", () => {
  assert.equal(s.commit, source.commit);
  assert.equal(s.repo, source.repo);
  assert.equal(s.core.version, "0.25.2");
  assert.equal(s.root, "Robert Blust");
  assert.equal(listTypes(s).types.length, 15);
});

test("every type describes and lists, and one entity of each resolves", () => {
  for (const t of listTypes(s).types) {
    if (t.count === 0) continue;
    const { entity } = getEntity(s, t.type, s.entities.find((e) => e.type === t.type).name);
    assert.equal(entity.type, t.type);
    assert.ok(Array.isArray(entity.references) && Array.isArray(entity.referencedBy));
  }
});

test("the company of one refuses a bare name and resolves a typed one", () => {
  assert.throws(() => fetchEntity(s, "Robert Blust"), (e) => e instanceof ModelError && /R2/.test(e.message));
  assert.equal(getEntity(s, "identity", "Robert Blust").entity.id, "identity");
  assert.equal(getEntity(s, "profile", "Robert Blust").entity.id, "profiles/robert-blust");
});

test("evidence is verbatim and search round-trips through fetch", () => {
  const claim = findEvidence(s, "Agentic AI development").evidence.profile.find((x) => x.id === "profiles/robert-blust");
  assert.equal(claim.attrs.Level.name, "Expert");
  assert.ok(claim.attrs.Evidence.startsWith("Built LIKE MAGIC's internal AI marketplace on Claude"));
  const hit = search(s, "LIKE MAGIC").results.find((r) => r.id === "profiles/robert-blust/experiences/2022-likemagic");
  assert.equal(fetchEntity(s, hit.id).title, "Co-Founder & Head of Technology");
});

test("the server lists seven tools and every answer carries the commit", async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(s).connect(a);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(b);
  assert.equal(client.getServerVersion().title, "Robert Blust");
  const { tools } = await client.listTools();
  assert.equal(tools.length, 7);
  for (const name of tools.map((t) => t.name)) {
    const args = { list_types: {}, describe_schema: { type: "skill" }, list_entities: { type: "value" },
      get_entity: { type: "identity", name: "Robert Blust" }, find_evidence: { skill: "Agentic AI development" },
      search: { query: "model" }, fetch: { id: "identity" } }[name];
    const r = await client.callTool({ name, arguments: args });
    assert.equal(r.isError, undefined, name);
    assert.equal(r.structuredContent.model.commit, source.commit, name);
  }
  await client.close();
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npm test`
Expected: FAIL, `ENOENT` on `snapshot.json`.

- [ ] **Step 4: Write the build**

`build/snapshot.mjs`:

```js
// The one way this repository reads the model it pins: the server's own snapshot command,
// against the commit source.json names, so what the image serves is what the pin says.
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const root = new URL("..", import.meta.url);
const { repo, commit } = JSON.parse(fs.readFileSync(new URL("source.json", root), "utf8"));
const out = new URL("snapshot.json", root).pathname;
execFileSync("npx", ["--no-install", "companygraph-mcp-snapshot", "--github", `${repo}@${commit}`,
  "--sub", "model/", "--core", "meta/core/", "--out", out], { stdio: "inherit" });
```

`build/tag.mjs`:

```js
// The image tag: the instance's core version and the model's short commit, so a tag names the
// one snapshot inside the image.
import fs from "node:fs";
const s = JSON.parse(fs.readFileSync(new URL("../snapshot.json", import.meta.url), "utf8"));
process.stdout.write(`${s.core.version}-${s.commit.slice(0, 7)}\n`);
```

- [ ] **Step 5: Build and test**

Run: `npm run snapshot && node build/tag.mjs && npm test`
Expected: the snapshot command reports `143 entities, 608 edges, core 0.25.2, commit 2fd146fe…`; the tag is `0.25.2-2fd146f`; 5 tests pass. With `GITHUB_TOKEN` unset the fetch is about 160 unauthenticated requests, within GitHub's limit for one run.

- [ ] **Step 6: Commit**

```bash
sh conventions/conventions-check
git add source.json package.json package-lock.json .gitignore build/snapshot.mjs build/tag.mjs test/tools.test.mjs
git commit -F - <<'EOF'
The pins and the snapshot they produce

source.json names the model commit and package.json the server release, the way blust.ch pins its model and its parser. npm run snapshot writes the document the image will serve with the server's own command, read from GitHub at the pinned commit, and build/tag.mjs names the image after the core version and the short commit inside it. The tests run the seven tools against that snapshot in-process: the commit is the pin's, every type lists and resolves, the identity and the profile that share a name refuse a bare lookup, an Evidence cell is verbatim, and every answer carries the commit.

Verified: `npm run snapshot` reports 143 entities and 608 edges at core 0.25.2; `npm test` 5 pass; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: The image

**Files:**
- Create: `Dockerfile`, `.dockerignore`

**Interfaces:**
- Produces: an image that serves `snapshot.json` on `$PORT` with `companygraph-mcp-http`, honouring `MCP_ALLOWED_HOSTS`.

- [ ] **Step 1: Write the Dockerfile**

`Dockerfile`:

```dockerfile
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY snapshot.json ./snapshot.json
EXPOSE 8080
CMD ["npx", "--no-install", "companygraph-mcp-http", "--snapshot", "snapshot.json"]
```

`.dockerignore`:

```
node_modules
.git
.github
.superpowers
docs
infra
test
server.json
```

- [ ] **Step 2: Build and run it locally**

Run:

```bash
npm run snapshot
docker build -t mcp-blust-ch:local .
docker run --rm -d --name mcp-local -p 8080:8080 -e MCP_ALLOWED_HOSTS=localhost mcp-blust-ch:local
sleep 2
curl -s localhost:8080/healthz
curl -s -X POST localhost:8080/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 300
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: evil.example' localhost:8080/healthz
docker stop mcp-local
```

Expected: `/healthz` returns `{"ok":true,"model":{"commit":"2fd146fe…","repo":"robertblust/mental-model","core":"0.25.2","parser":"v0.25.2"}}`; the tools list names seven tools; `/healthz` with a foreign Host is still 200 (the Host check guards `/mcp` only), and the same POST with `-H 'Host: evil.example'` to `/mcp` is 403. Record the image size from `docker images mcp-blust-ch:local`.

- [ ] **Step 3: Commit**

```bash
sh conventions/conventions-check
git add Dockerfile .dockerignore
git commit -F - <<'EOF'
The image

node:22-slim with the server installed from its pinned release and the snapshot copied in, serving on the port Cloud Run sets and answering only to the hostnames MCP_ALLOWED_HOSTS names. Nothing else is in it: the build files, the tests and the infrastructure stay outside.

Verified: `docker build` succeeds, the container answers /healthz with the pinned commit and lists seven tools on /mcp, and a foreign Host on /mcp is 403.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: The registry entry

**Files:**
- Create: `build/server-json.mjs`, `test/server-json.test.mjs`

**Interfaces:**
- Produces: `node build/server-json.mjs <version>` writes `server.json`; the module exports `serverJson(snapshot, version)` for the test.

- [ ] **Step 1: Write the failing test**

`test/server-json.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { serverJson } from "../build/server-json.mjs";

const s = JSON.parse(fs.readFileSync(new URL("../snapshot.json", import.meta.url), "utf8"));

test("the entry is generated from the model and fits the registry", () => {
  const j = serverJson(s, "1.2.3");
  assert.equal(j.$schema, "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json");
  assert.equal(j.name, "ch.blust/mental-model");
  assert.equal(j.title, "Robert Blust");
  assert.equal(j.description, "Robert Blust: One model, true everywhere");
  assert.ok(j.description.length <= 100);
  assert.equal(j.version, "1.2.3");
  assert.deepEqual(j.remotes, [{ type: "streamable-http", url: "https://mcp.blust.ch/mcp" }]);
});

test("a description over the limit is refused rather than truncated", () => {
  const long = { ...s, root: "x".repeat(90) };
  assert.throws(() => serverJson(long, "1.0.0"), /100/);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test test/server-json.test.mjs`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

`build/server-json.mjs`:

```js
// The registry entry, written from the model rather than by hand: the title is the identity's
// H1, the description is the identity's H1 and the vision's H1, and the version is the tag the
// workflow passes. The registry caps a description at 100 characters and the build fails
// rather than truncates, because a truncated sentence is a claim nobody made.
import fs from "node:fs";

export const NAME = "ch.blust/mental-model";
export const URL_ = "https://mcp.blust.ch/mcp";

export function serverJson(snapshot, version) {
  const vision = snapshot.entities.find((e) => e.type === "vision");
  const description = `${snapshot.root}: ${vision.name}`;
  if (description.length > 100) throw new Error(`description is ${description.length} characters; the registry allows 100`);
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: NAME,
    title: snapshot.root,
    description,
    version,
    remotes: [{ type: "streamable-http", url: URL_ }],
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const version = process.argv[2];
  if (!version) { console.error("usage: node build/server-json.mjs <version>"); process.exit(2); }
  const root = new URL("..", import.meta.url);
  const snapshot = JSON.parse(fs.readFileSync(new URL("snapshot.json", root), "utf8"));
  fs.writeFileSync(new URL("server.json", root), JSON.stringify(serverJson(snapshot, version), null, 2) + "\n");
  console.log(`wrote server.json for ${NAME} ${version}`);
}
```

- [ ] **Step 4: Run**

Run: `node --test test/server-json.test.mjs && node build/server-json.mjs 0.0.0-test && cat server.json && rm server.json`
Expected: 2 pass; the file shows the six fields.

- [ ] **Step 5: Commit**

```bash
sh conventions/conventions-check
git add build/server-json.mjs test/server-json.test.mjs
git commit -F - <<'EOF'
The registry entry, written from the model

server.json is generated: the name ch.blust/mental-model, the title from the identity's H1, the description from the identity's H1 and the vision's H1, the version from the tag the workflow passes, and one streamable-http remote at mcp.blust.ch. A description over the registry's hundred characters fails the build rather than being cut.

Verified: `node --test test/server-json.test.mjs` 2 pass; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 4: Terraform bootstrap

**Files:**
- Create: `infra/bootstrap/main.tf`, `infra/bootstrap/README.md`

**Interfaces:**
- Produces, once applied by the owner: bucket `blust-ch-mcp-tfstate`; pool `github` with provider `github`; service accounts `terraform` and `deploy`; Artifact Registry repository `mcp` in `europe-west6`; outputs `workload_identity_provider`, `terraform_service_account`, `deploy_service_account`, `registry`.

- [ ] **Step 1: Write the configuration**

`infra/bootstrap/main.tf`:

```hcl
# What has to exist before GitHub Actions can authenticate and push: applied once by the owner
# under their own login, with local state, and changed only when a repository joins. Everything
# below the project that CI can create lives in ../ and is applied by CI.
terraform {
  required_version = ">= 1.9"
  required_providers {
    google = { source = "hashicorp/google", version = ">= 6.0, < 8.0" }
  }
}

variable "project" { default = "blust-ch-mcp" }
variable "region" { default = "europe-west6" }
variable "repository" { default = "robertblust/mcp-blust-ch" }

provider "google" {
  project = var.project
  region  = var.region
}

data "google_project" "this" {}

# Enabling an API already on is a no-op; disabling one on destroy never happens.
resource "google_project_service" "bootstrap" {
  for_each = toset([
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com",
    "artifactregistry.googleapis.com",
  ])
  service                    = each.value
  disable_on_destroy         = false
  disable_dependent_services = false
}

resource "google_storage_bucket" "state" {
  name                        = "${var.project}-tfstate"
  location                    = var.region
  uniform_bucket_level_access = true
  versioning { enabled = true }
  depends_on = [google_project_service.bootstrap]
}

resource "google_artifact_registry_repository" "mcp" {
  location      = var.region
  repository_id = "mcp"
  format        = "DOCKER"
  depends_on    = [google_project_service.bootstrap]
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  depends_on                = [google_project_service.bootstrap]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
  attribute_condition = "assertion.repository == \"${var.repository}\""
  oidc { issuer_uri = "https://token.actions.githubusercontent.com" }
}

locals {
  principal = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.repository}"
}

# Applies ../: Cloud Run, Firebase, Hosting, the budget, the APIs it needs.
resource "google_service_account" "terraform" {
  account_id   = "terraform"
  display_name = "Terraform, run by GitHub Actions"
}

resource "google_project_iam_member" "terraform" {
  for_each = toset([
    "roles/run.admin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.serviceAccountUser",
    "roles/serviceusage.serviceUsageAdmin",
    "roles/firebase.admin",
    "roles/firebasehosting.admin",
    "roles/artifactregistry.reader",
  ])
  project = var.project
  role    = each.value
  member  = "serviceAccount:${google_service_account.terraform.email}"
}

resource "google_storage_bucket_iam_member" "terraform_state" {
  bucket = google_storage_bucket.state.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.terraform.email}"
}

resource "google_service_account_iam_member" "terraform_wif" {
  service_account_id = google_service_account.terraform.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.principal
}

# Pushes images and nothing else.
resource "google_service_account" "deploy" {
  account_id   = "deploy"
  display_name = "Image push, run by GitHub Actions"
}

resource "google_artifact_registry_repository_iam_member" "deploy" {
  location   = google_artifact_registry_repository.mcp.location
  repository = google_artifact_registry_repository.mcp.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_service_account_iam_member" "deploy_wif" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.principal
}

output "workload_identity_provider" { value = google_iam_workload_identity_pool_provider.github.name }
output "terraform_service_account" { value = google_service_account.terraform.email }
output "deploy_service_account" { value = google_service_account.deploy.email }
output "registry" { value = "${var.region}-docker.pkg.dev/${var.project}/${google_artifact_registry_repository.mcp.repository_id}" }
output "state_bucket" { value = google_storage_bucket.state.name }
```

`infra/bootstrap/README.md`:

```markdown
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
```

- [ ] **Step 2: Validate in Docker**

Run:

```bash
cd infra/bootstrap
docker run --rm -v "$PWD":/w -w /w hashicorp/terraform:1.9.8 init -backend=false
docker run --rm -v "$PWD":/w -w /w hashicorp/terraform:1.9.8 validate
docker run --rm -v "$PWD":/w -w /w hashicorp/terraform:1.9.8 fmt -check
cd ../..
```

Expected: `Success! The configuration is valid.` and no fmt diff. If `validate` names an argument the provider does not know, read the provider's documentation for that resource and correct the argument; report what changed.

- [ ] **Step 3: Commit**

```bash
sh conventions/conventions-check
git add infra/bootstrap/main.tf infra/bootstrap/README.md
git commit -F - <<'EOF'
The bootstrap

infra/bootstrap holds what has to exist before CI can authenticate and push: the state bucket, the identity pool with its GitHub provider admitting this repository only, the terraform service account with the roles the main configuration needs and the deploy service account that may only write images, and the Artifact Registry repository the first image goes to, since CI cannot push to a registry the main configuration has not created yet. The owner applies it once with local state; the README says how, and names the one billing role no project configuration can grant.

Verified: `terraform init -backend=false`, `validate` and `fmt -check` pass in the hashicorp/terraform:1.9.8 image; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 5: Terraform main

**Files:**
- Create: `infra/main.tf`, `infra/run.tf`, `infra/hosting.tf`, `infra/budget.tf`, `infra/outputs.tf`

**Interfaces:**
- Consumes: the bootstrap's bucket, registry and runtime accounts by name.
- Produces: the Cloud Run service, Firebase Hosting with the rewrite and the domain, the budget; variable `image`; outputs `service_url`, `dns_records`, `hosting_url`.

- [ ] **Step 1: Write the configuration**

`infra/main.tf`:

```hcl
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
```

`infra/run.tf`:

```hcl
# The service: one container, the snapshot inside it, no role, answering only to its two names.
resource "google_service_account" "run" {
  account_id   = "mcp-run"
  display_name = "Runtime of the MCP service, holding no role"
}

locals {
  run_host = "mcp-${var.project_number}.${var.region}.run.app"
}

resource "google_cloud_run_v2_service" "mcp" {
  name     = "mcp"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

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
```

`infra/hosting.tf`:

```hcl
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
  site_id    = var.project
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
```

`infra/budget.tf`:

```hcl
# Ten francs a month, three warnings, to whoever administers the billing account.
resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account
  display_name    = "mcp.blust.ch monthly"
  budget_filter {
    projects = ["projects/${var.project_number}"]
  }
  amount {
    specified_amount {
      currency_code = "CHF"
      units         = "10"
    }
  }
  threshold_rules { threshold_percent = 0.5 }
  threshold_rules { threshold_percent = 0.9 }
  threshold_rules { threshold_percent = 1.0 }
  depends_on = [google_project_service.main]
}
```

`infra/outputs.tf`:

```hcl
output "service_url" { value = google_cloud_run_v2_service.mcp.uri }
output "run_host" { value = local.run_host }
output "hosting_url" { value = "https://${google_firebase_hosting_site.this.default_url}" }
output "dns_records" {
  description = "What the domain needs; create these at the DNS provider of blust.ch"
  value       = google_firebase_hosting_custom_domain.this.required_dns_updates
}
```

- [ ] **Step 2: Validate in Docker**

Run:

```bash
cd infra
docker run --rm -v "$PWD":/w -w /w hashicorp/terraform:1.9.8 init -backend=false
docker run --rm -v "$PWD":/w -w /w hashicorp/terraform:1.9.8 validate
docker run --rm -v "$PWD":/w -w /w hashicorp/terraform:1.9.8 fmt -check
cd ..
```

Expected: valid, no fmt diff. If `validate` rejects an argument (the Hosting resources are the likeliest: `default_url`, the `headers` map, `required_dns_updates`), read the google-beta provider's documentation for that resource, correct it, and report what changed.

- [ ] **Step 3: Commit**

```bash
sh conventions/conventions-check
git add infra/main.tf infra/run.tf infra/hosting.tf infra/budget.tf infra/outputs.tf
git commit -F - <<'EOF'
The project's infrastructure

infra/ is what CI applies on every merge: the APIs the service needs, a runtime account holding no role, the Cloud Run service in Zurich at 256 MiB with instances 0 to 3 and public invocation, answering to mcp.blust.ch and its own run.app name, the Firebase attachment, the Hosting site with one rewrite from /mcp to the service and no-store on it, the release, the custom domain, and a ten-franc budget with three thresholds. The image is a variable, so the run that built it rolls the revision, and the outputs carry the service URL and the DNS records the domain needs.

Verified: `terraform init -backend=false`, `validate` and `fmt -check` pass in the hashicorp/terraform:1.9.8 image; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 6: The workflows and the registry environment

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/workflows/publish.yml`

**Interfaces:**
- Consumes: the bootstrap outputs, as literals here: provider `projects/38003987140/locations/global/workloadIdentityPools/github/providers/github`, accounts `terraform@blust-ch-mcp.iam.gserviceaccount.com` and `deploy@blust-ch-mcp.iam.gserviceaccount.com`, registry `europe-west6-docker.pkg.dev/blust-ch-mcp/mcp`.

- [ ] **Step 1: Write the deploy workflow**

`.github/workflows/deploy.yml`:

```yaml
name: deploy
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
  id-token: write
  pull-requests: write
env:
  REGISTRY: europe-west6-docker.pkg.dev/blust-ch-mcp/mcp
  WIF_PROVIDER: projects/38003987140/locations/global/workloadIdentityPools/github/providers/github
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.tag.outputs.image }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: npm ci
      - run: npm run snapshot
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: npm test
      - id: tag
        run: echo "image=$REGISTRY/server:$(node build/tag.mjs)" >> "$GITHUB_OUTPUT"
      - run: docker build -t "${{ steps.tag.outputs.image }}" .
      - if: github.event_name == 'push'
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ env.WIF_PROVIDER }}
          service_account: deploy@blust-ch-mcp.iam.gserviceaccount.com
      - if: github.event_name == 'push'
        run: gcloud auth configure-docker europe-west6-docker.pkg.dev --quiet && docker push "${{ steps.tag.outputs.image }}"
  terraform:
    needs: build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infra
    steps:
      - uses: actions/checkout@v7
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ env.WIF_PROVIDER }}
          service_account: terraform@blust-ch-mcp.iam.gserviceaccount.com
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.9.8
      - run: terraform init -input=false
      - run: terraform fmt -check
      - if: github.event_name == 'pull_request'
        id: plan
        run: terraform plan -input=false -no-color -var "image=${{ needs.build.outputs.image }}" > plan.txt; echo "exit=$?" >> "$GITHUB_OUTPUT"
        continue-on-error: true
      - if: github.event_name == 'pull_request'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          { echo 'Terraform plan for `'"${{ needs.build.outputs.image }}"'`'; echo; echo '```'; tail -c 60000 plan.txt; echo '```'; } > comment.md
          gh pr comment "${{ github.event.pull_request.number }}" --repo "${{ github.repository }}" --body-file comment.md
          test "${{ steps.plan.outputs.exit }}" = "0"
      - if: github.event_name == 'push'
        run: terraform apply -input=false -auto-approve -var "image=${{ needs.build.outputs.image }}"
      - if: github.event_name == 'push'
        run: |
          URL=$(terraform output -raw service_url)
          WANT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("../source.json","utf8")).commit)')
          GOT=$(curl -fsS "$URL/healthz" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).model.commit))')
          echo "serving $GOT, pinned $WANT"; test "$GOT" = "$WANT"
```

- [ ] **Step 2: Write the publish workflow**

`.github/workflows/publish.yml`:

```yaml
name: publish
on:
  push:
    tags: ["v*"]
permissions:
  contents: read
jobs:
  publish:
    runs-on: ubuntu-latest
    environment: registry
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: npm ci
      - run: npm run snapshot
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: node build/server-json.mjs "${GITHUB_REF_NAME#v}"
      - run: cat server.json
      - run: curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
      - run: ./mcp-publisher login dns --domain blust.ch --private-key "${{ secrets.MCP_PRIVATE_KEY }}"
      - run: ./mcp-publisher publish
```

- [ ] **Step 3: Create the `registry` environment with the owner as required reviewer**

```bash
OWNER_ID=$(gh api users/robertblust --jq .id)
gh api -X PUT repos/robertblust/mcp-blust-ch/environments/registry --input - <<EOF
{ "reviewers": [{ "type": "User", "id": $OWNER_ID }], "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
EOF
gh api -X POST repos/robertblust/mcp-blust-ch/environments/registry/deployment-branch-policies -f name='v*' -f type=tag
gh api repos/robertblust/mcp-blust-ch/environments/registry --jq '{reviewers: [.protection_rules[].reviewers[]?.reviewer.login], branch_policy: .deployment_branch_policy}'
```

Expected: the environment names `robertblust` as reviewer and allows tags matching `v*`. The `MCP_PRIVATE_KEY` secret is the owner's to add, in that environment.

- [ ] **Step 4: Lint the workflows**

Run: `for f in .github/workflows/*.yml; do node -e 'const y=require("fs").readFileSync(process.argv[1],"utf8"); if(!/^name: /.test(y)) process.exit(1)' "$f" && echo "$f ok"; done` and, if `actionlint` is available via `docker run --rm -v "$PWD":/w -w /w rhysd/actionlint:latest`, run it; report its output. A finding that is a real defect is fixed; a shellcheck style note is recorded.

- [ ] **Step 5: Commit**

```bash
sh conventions/conventions-check
git add .github/workflows/deploy.yml .github/workflows/publish.yml
git commit -F - <<'EOF'
The two workflows

deploy runs on every pull request and on main. A pull request builds the snapshot, runs the tests, builds the image without pushing it, and posts terraform plan for that image as a comment. A merge does the same and then pushes the image as the deploy account, applies as the terraform account with the image as the variable, which rolls the revision, and fails unless the service's /healthz reports the commit source.json pins. publish runs on a v tag in the registry environment, which requires the owner's review: it writes server.json from the snapshot and the tag and publishes with DNS authentication from the environment's secret. Both authenticate with Workload Identity Federation and hold no key. The registry environment was created with the owner as its reviewer and v tags as its only deployable refs.

Verified: both files parse; the registry environment reads back with the owner as reviewer; `sh conventions/conventions-check` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 7: README and the pull request

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the README** (the first line stays exactly `# mcp.blust.ch`)

```markdown
# mcp.blust.ch

The reference instance of CompanyGraph, `robertblust/mental-model`, served over MCP at
`https://mcp.blust.ch/mcp`. This repository pins one commit of the model and one release of
`companygraph/mcp-server`, builds an image that carries the model's snapshot, and runs it on
Cloud Run in Zurich behind Firebase Hosting. Everything below the Google Cloud project is
Terraform, applied by GitHub Actions.

Whoever asks about Robert Blust's work — a person, a search engine, an agent — reaches the
same answer, because every surface derives from one model. This is the surface an agent
queries.

## Using it

Add `https://mcp.blust.ch/mcp` as a custom connector in Claude, or as a remote MCP server in
ChatGPT's developer mode or the Gemini CLI. No authentication. Seven tools: `list_types`,
`describe_schema`, `list_entities`, `get_entity`, `find_evidence`, `search` and `fetch`; every
answer names the model commit it was read from.

## What pins what

`source.json` names the model commit and `package.json` the server release. Moving either is a
pull request; the merge builds the image, applies the infrastructure with it and checks that
`/healthz` reports the new commit.

## Building it

    npm ci
    npm run snapshot      # writes snapshot.json from the pinned commit
    npm test              # the seven tools against that snapshot
    docker build -t mcp-blust-ch:local .

## Infrastructure

`infra/bootstrap/` is applied once by the owner and holds what CI needs before it can
authenticate: the state bucket, the identity pool, the two service accounts and the image
registry. `infra/` is applied by CI on every merge. The workflows in `.github/workflows/` say
what runs when.

## License

CC BY 4.0 for the text here; the model's own license is its own.
```

- [ ] **Step 2: Check and commit**

```bash
sh conventions/conventions-check
npm test
git add README.md
git commit -F - <<'EOF'
The README

What the repository is, how to add the server to a client, what pins what and what a merge does, how to build it locally, and where the two Terraform roots sit.

Verified: `sh conventions/conventions-check` passes with the title held to the family's row; `npm test` passes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

- [ ] **Step 3: Push and open the pull request, then stop**

```bash
git push -u origin build
gh pr create --title "The deployment" --body "$(cat <<'EOF'
mcp.blust.ch as its design describes it. source.json pins robertblust/mental-model at 2fd146f and package.json pins companygraph-mcp-server at v0.1.0; npm run snapshot writes the snapshot with the server's own command and the tests run the seven tools against it in-process. The Dockerfile bakes that snapshot into node:22-slim. infra/bootstrap is the owner's one-time apply: the state bucket, the identity pool admitting this repository, the terraform and deploy accounts and the image registry. infra is what CI applies on merge: the APIs, the runtime account with no role, the Cloud Run service in europe-west6 at 256 MiB with instances 0 to 3, the Firebase attachment, the Hosting site with the /mcp rewrite and no-store, the custom domain and a ten-franc budget. deploy.yml plans on a pull request and applies on main with the image it pushed, then checks /healthz for the pinned commit; publish.yml writes server.json from the model on a v tag and publishes behind the registry environment's review.

On this pull request the plan job will fail until the bootstrap is applied, because there is no identity pool to authenticate against yet; the build and test job passes on its own. After the merge the owner applies the bootstrap, the first push to main deploys, and the DNS records in the Terraform output bring up the domain.

Verified: `npm test` 7 pass on the real snapshot; the image builds and answers /healthz with the pinned commit locally; both Terraform roots pass init, validate and fmt in the hashicorp/terraform:1.9.8 image; `sh conventions/conventions-check` passes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Merging is the owner's call; do not merge. Tasks 8 and 9 begin after the merge and the owner's bootstrap.

---

### Task 8: First deployment and go-live (after the merge; owner steps marked)

**Files:** none committed here except what the steps say.

- [ ] **Step 1 (owner): apply the bootstrap** as `infra/bootstrap/README.md` says, and grant `terraform@blust-ch-mcp.iam.gserviceaccount.com` the Billing Account Costs Manager role on the billing account. Record the four outputs.

- [ ] **Step 2: trigger the first deploy.** The merge already ran `deploy` on main and its terraform job failed before the bootstrap existed. Re-run it: `gh run list --repo robertblust/mcp-blust-ch --workflow deploy --branch main --limit 1` then `gh run rerun <id>`. Watch with `gh run watch <id>`. Expected: build pushes `server:0.25.2-2fd146f`, apply creates everything, the health step prints `serving 2fd146fe… pinned 2fd146fe…`.

If apply fails on `google_firebase_project` or the Hosting resources, read the error: a missing permission is fixed in the bootstrap's role list (a new PR to `infra/bootstrap`, the owner re-applies); a provider argument error is fixed in `infra/` (a PR, CI applies). If it fails on the budget with a permission error, Step 1's billing role is missing.

- [ ] **Step 3: verify the service directly**

```bash
URL=https://mcp-38003987140.europe-west6.run.app
curl -s $URL/healthz
curl -s -X POST $URL/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 400
```

Expected: the pinned commit; seven tools; response headers carry `cache-control: no-store`.

- [ ] **Step 4 (owner): DNS.** `cd infra && terraform output dns_records` (in the Docker image, with `init` against the bucket, the owner's ADC mounted as the bootstrap README shows) prints the records; create them at blust.ch's DNS provider. Hosting issues the certificate; `gcloud` or the Firebase console shows the domain state moving to ACTIVE, up to an hour.

- [ ] **Step 5: verify through the domain, and settle the Host question**

```bash
curl -sI https://mcp.blust.ch/mcp -X POST -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expected: 200 with `cache-control: no-store`. A 403 with `host not allowed` means Hosting forwards a Host the list does not name: read the service's request log (`gcloud run services logs read mcp --region europe-west6 --limit 20`) for the host it saw, add it to `MCP_ALLOWED_HOSTS` in `infra/run.tf` in a PR, and record in the spec's §3 which Host Hosting forwards.

- [ ] **Step 6: the Inspector and the connectors**

`npx @modelcontextprotocol/inspector --cli https://mcp.blust.ch/mcp --method tools/list` lists seven tools. Then, by the owner: add `https://mcp.blust.ch/mcp` as a custom connector in Claude and ask "which skills are Expert, and on what evidence?"; the same in ChatGPT developer mode. Record what each returned in the parity report of Task 9.

- [ ] **Step 7: the registry, when the owner says so.** Owner: generate the Ed25519 key with OpenSSL 3, publish `blust.ch. IN TXT "v=MCPv1; k=ed25519; p=…"` at the apex, add `MCP_PRIVATE_KEY` to the `registry` environment. Then `git tag v1.0.0 && git push origin v1.0.0`; the `publish` run waits for the owner's review in the environment; approve it. Verify with `curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=ch.blust'`.

---

### Task 9: The parity report

**Files:**
- Create: `docs/superpowers/reports/2026-09-16-parity.md`

- [ ] **Step 1: ask the server the three questions**, against `https://mcp.blust.ch/mcp` (or the run.app URL if the domain is not yet active), with a small script run once and kept in the report as its method:

```js
// parity.mjs — run with: node parity.mjs https://mcp.blust.ch/mcp
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
const client = new Client({ name: "parity", version: "0" });
await client.connect(new StreamableHTTPClientTransport(new URL(process.argv[2])));
const call = async (name, args) => (await client.callTool({ name, arguments: args })).structuredContent;
const profile = await call("get_entity", { type: "profile", name: "Robert Blust" });
const expert = profile.entity.references.filter((r) => r.via === "Skills.Skill" && r.attrs.Level.name === "Expert");
console.log("Q1 Expert skills:", expert.length); for (const r of expert) console.log(" -", r.name, "|", r.attrs.Evidence);
const lm = await call("get_entity", { type: "experience", name: "Co-Founder & Head of Technology" });
console.log("Q2 LIKE MAGIC:", lm.entity.fields.organization, lm.entity.stamp, lm.entity.sections.find((s) => s.heading === "Achievements")?.text);
const values = await call("list_entities", { type: "value" });
console.log("Q3 holds to:", values.entities.map((v) => v.name));
console.log("commit", profile.model.commit);
await client.close();
```

- [ ] **Step 2: build the skill bundle at the same commit**

```bash
git clone -q https://github.com/robertblust/mental-model /tmp/mm && git -C /tmp/mm checkout -q 2fd146fe669ef80f7d7b8090ad1cf533b9020ebc
cd /tmp/mm && python3 .claude/skills/companygraph-export/build.py && python3 .claude/skills/companygraph-export/verify.py && cd -
ls /tmp/mm/dist/
```

Read the bundle's `model/profiles.md` (or wherever the export puts the profile's Skills table), the LIKE MAGIC experience and the values, and compare with Step 1's output: the same 27 Expert rows with the same Evidence text, the same organization and dates and achievements, the same five values.

- [ ] **Step 3: write the report**

`docs/superpowers/reports/2026-09-16-parity.md`: the commit compared, the method (the script and the export command), a table per question with the server's answer and the bundle's answer side by side and a "same / differs" cell, what the Claude and ChatGPT connectors returned for Q1 in Task 8 Step 6, and a closing paragraph. Any difference is reported as a model or projection defect with the file it lives in; nothing is fixed here.

- [ ] **Step 4: commit on a branch, open a pull request, stop**

```bash
git checkout -b parity main && git add docs/superpowers/reports/2026-09-16-parity.md && git commit -F - <<'EOF'
The parity report

Three questions asked of the deployed server and of the skill bundle exported from the same commit, side by side: which skills are Expert and on what evidence, what was built at LIKE MAGIC, and what he holds to. What differs, if anything, is named as a model or projection defect with the file it lives in, and nothing is corrected here.

Verified: the script ran against the live server and the bundle was built with companygraph-export at 2fd146f; the report quotes both.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git push -u origin parity && gh pr create --title "The parity report" --body "$(cat <<'EOF'
Three questions asked of the deployed server and of the skill bundle exported from the same commit, side by side: which skills are Expert and on what evidence, what was built at LIKE MAGIC, and what he holds to. What differs, if anything, is named as a model or projection defect with the file it lives in, and nothing is corrected here.

Verified: the script ran against the live server and the bundle was built with companygraph-export at 2fd146f; the report quotes both.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

- **Spec coverage.** §1 pins, snapshot, hosting, Terraform roots, CI, registry, no surface file: Tasks 1, 2, 4, 5, 6. §2 shape: every file in the table has a task; `build/tag.mjs` is an addition the workflow needs. §3 build: Tasks 1 and 2; the Host question is settled in Task 8 Step 5. §4 infrastructure: Task 4 (bootstrap, with the registry moved into it because CI cannot push before it exists, a deviation from the spec recorded here) and Task 5. §5 workflow: Task 6, both files, the health check, the environment. §6 tests and verification: Task 1's tests, Task 8's Inspector and connector checks, Task 9's parity report. §7 owner steps: Task 4's README and Task 8. §8 family: conventions check and prose commits throughout, PR left open.
- **Placeholders.** None; the two Docker-validated Terraform roots carry a documented recovery step if a provider argument is wrong, which is a verification, not a placeholder.
- **Type consistency.** The image tag from `build/tag.mjs` is what `deploy.yml` reads and what `infra/main.tf`'s `image` variable receives; the accounts and provider names in `deploy.yml` match the bootstrap's `account_id`s and pool ids; `MCP_ALLOWED_HOSTS` in `run.tf` matches the run host the health step and Task 8 use; `serverJson` in `build/server-json.mjs` is what `test/server-json.test.mjs` imports and `publish.yml` runs.
