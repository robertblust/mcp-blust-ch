# mcp.blust.ch

The reference instance of CompanyGraph, `robertblust/mental-model`, served over MCP at `https://mcp.blust.ch/mcp`. This repository pins one commit of the model and one release of `companygraph/mcp-server`, builds an image that carries the model's snapshot, and runs it on Cloud Run in Zurich behind Firebase Hosting. Everything below the Google Cloud project is Terraform, applied by GitHub Actions.

Whoever asks about Robert Blust's work — a person, a search engine, an agent — reaches the same answer, because every surface derives from one model. This is the surface an agent queries.

## Using it

Add `https://mcp.blust.ch/mcp` as a custom connector in Claude, or as a remote MCP server in ChatGPT's developer mode or the Gemini CLI. No authentication. The page at `https://mcp.blust.ch` lists the tools with what each returns, from the server's own list: the types and their schemas, what the types declare about each other, the rules, and the entities with their references and their evidence. Every answer names the model commit it was read from.

## What pins what

`source.json` names the model commit and `package.json` the server release. Moving either is a pull request; the merge builds the image, applies the infrastructure with it and checks that the service reports the new commit.

## Building it

    npm ci
    npm run snapshot      # writes dist/snapshot.json from the pinned commit
    npm run page-css      # writes dist/page.css from the design package's blocks and own.css
    npm run jsonld        # writes dist/jsonld.json from the snapshot
    npm test              # the server's shared deployment tests and this instance's own
    docker build -t mcp-blust-ch:local .

## Infrastructure

`infra/bootstrap/` is applied by the owner, with the state `infra/bootstrap/README.md` says how to restore, and holds what CI needs before it can authenticate: the state bucket, the identity pool, the service accounts and the image registry. A pull request plans as `terraform-plan@`, which reads and changes nothing, and only a run on `main` may apply as `terraform@` or push as `deploy@`. `infra/` is applied by CI on every merge: its state in the bucket the bootstrap made, and one call into the module `companygraph/mcp-server` ships under `deploy/terraform`, with this deployment's own values read from `deployment.json`. The build is the same package's `companygraph-mcp-deploy`, and `deploy.yml` only calls the package's own `deployment.yml`, by the release `package.json` pins. `publish.yml` runs the steps of the package's `registry.yml` itself, because a workflow in another organization receives no secret, and the Registry's signing key has to reach the job; its comment says to keep the steps in step with the release.

Publishing to the MCP Registry runs in the `registry` environment, which requires the owner's review of every run. The signing key lives there as an environment secret, `MCP_PRIVATE_KEY`, never as a repository secret, because a repository secret would be readable by any workflow on any branch and the review gate would protect nothing.

## The chat

`chat.blust.ch` is the chat over this host: a visitor's question on blust.ch goes to it, it asks `mcp.blust.ch` through the tools, and Claude Sonnet 5 on Vertex AI in this project writes the answer from what the tools said. It is `companygraph/chat-server`, deployed from this repository beside the server: `chat/` holds what is this deployment's own for it, `chat/package.json` pinning the release, `chat/chat.json` naming the domain, the site, the host it reads, the page origins it answers and the month's ceiling in input-equivalent tokens, the Dockerfile, the brand, the stylesheet and the tests; `infra/chat/` is its Terraform root, applied by CI with its own state prefix in the same bucket; `.github/workflows/chat.yml` calls the chat server's own workflow, and `.github/workflows/report.yml` calls its report workflow, on Monday at six UTC and by hand. The release is named in those four places and the chat server's pin test holds them to one. The budget in `deployment.json` covers both services.

Nothing the chat spends escapes its ceiling. The service refuses before it asks the model, an address gets twenty requests an hour, and a meter in this project's Firestore database counts every model call against a day's share and a month's ceiling, CHF 30 a month at the model's price. The chat is stopped by hand where the meter keeps it: the `(default)` database, document `chat/meter`, field `closed` set to `true`, which refuses the next message and spends nothing, and back to `false` to open it; the day and the month there are UTC.

Once a message the shape accepted has its answer or its refusal, the chat keeps one line of it, the question, the language and what the loop saw, no address and no word of the answer, in this project's log bucket `chat-questions` for ninety days, behind the view `questions` that one account, `chat-analyst`, may read and nothing else; the project's console finds those lines as `labels.logger="chat.question"`. On Monday morning the report workflow, running as that account, writes the week that ended to the private bucket `chat-reports-blust-ch-mcp` as `reports/<week>.md`: how many questions, how many answered, by language, the entities most cited and the unanswered questions in full. A report is deleted at eighty-three days, so no question it quotes outlives the ninety, which is the one number blust.ch's privacy page gives.

Five steps are the owner's, because Terraform cannot do them. Claude's terms are accepted and Sonnet 5 enabled in Vertex AI's Model Garden, once for this project, and until it is done the first message fails as `internal`. The model's quota is lowered on the project's Quotas page to about sixty requests and 300,000 input tokens a minute. The chat's state is opened by the owner once, before the first plan can post: `terraform -chdir=infra/chat init`, run locally on the pull request's branch under the owner's login, creates the empty state at the `chat` prefix of the bucket, which a pull request's read-only plan identity may read but never create. The first deploy fails at its live check by design, since `chat/chat.json` names no `run_host` yet; the apply's warning names the address the service was given, and a second pull request writes it in. The domain's records are set at Hostpoint from `terraform -chdir=infra/chat output dns_records`, run after `terraform -chdir=infra/chat init`. The owner's own reading of the questions and the reports is granted once, `gcloud iam service-accounts add-iam-policy-binding chat-analyst@blust-ch-mcp.iam.gserviceaccount.com --member user:<login> --role roles/iam.serviceAccountTokenCreator --project blust-ch-mcp`, and a read then impersonates the analyst, with the commands the chat server's README gives. Then one message is sent by hand, because the deploy's `GET /chat` proves the route and the host and never the model:

    curl -N -H 'X-Chat: 1' -H 'content-type: application/json' https://chat.blust.ch/chat -d '{"messages":[{"role":"user","content":"What does the model say about the owner?"}],"lang":"en"}'

## License

CC BY 4.0 for the text here; the model's own license is its own.
