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

`infra/bootstrap/` is applied by the owner, with the state `infra/bootstrap/README.md` says how to restore, and holds what CI needs before it can authenticate: the state bucket, the identity pool, the service accounts and the image registry. A pull request plans as `terraform-plan@`, which reads and changes nothing, and only a run on `main` may apply as `terraform@` or push as `deploy@`. `infra/` is applied by CI on every merge: its state in the bucket the bootstrap made, and one call into the module `companygraph/mcp-server` ships under `deploy/terraform`, with this deployment's own values read from `deployment.json`. The build is the same package's `companygraph-mcp-deploy`, and the two workflows in `.github/workflows/` only call the package's own `deployment.yml` and `registry.yml`, by the release `package.json` pins.

Publishing to the MCP Registry runs in the `registry` environment, which requires the owner's review of every run. The signing key lives there as an environment secret, `MCP_PRIVATE_KEY`, never as a repository secret, because a repository secret would be readable by any workflow on any branch and the review gate would protect nothing.

## The chat

`chat.blust.ch` is the chat over this host: a visitor's question on blust.ch goes to it, it asks `mcp.blust.ch` through the tools, and Claude Sonnet 5 on Vertex AI in this project writes the answer from what the tools said. It is `companygraph/chat-server`, deployed from this repository beside the server: `chat/` holds what is this deployment's own for it, `chat/package.json` pinning the release, `chat/chat.json` naming the domain, the site, the host it reads, the page origins it answers and the month's ceiling in input-equivalent tokens, the Dockerfile, the brand, the stylesheet and the tests; `infra/chat/` is its Terraform root, applied by CI with its own state prefix in the same bucket; `.github/workflows/chat.yml` calls the chat server's own workflow. The release is named in those three places and the chat server's pin test holds them to one. The budget in `deployment.json` covers both services.

Nothing the chat spends escapes its ceiling. The service refuses before it asks the model, an address gets twenty requests an hour, and a meter in this project's Firestore database counts every model call against a day's share and a month's ceiling, CHF 30 a month at the model's price. The chat is stopped by hand where the meter keeps it: the `(default)` database, document `chat/meter`, field `closed` set to `true`, which refuses the next message and spends nothing, and back to `false` to open it; the day and the month there are UTC.

Four steps are the owner's, because Terraform cannot do them. Claude's terms are accepted and Sonnet 5 enabled in Vertex AI's Model Garden, once for this project, and until it is done the first message fails as `internal`. The model's quota is lowered on the project's Quotas page to about sixty requests and 300,000 input tokens a minute. The first deploy fails at its live check by design, since `chat/chat.json` names no `run_host` yet; the apply's warning names the address the service was given, and a second pull request writes it in. The domain's records are set at Hostpoint from `terraform -chdir=infra/chat output dns_records`, run after `terraform -chdir=infra/chat init`. Then one message is sent by hand, because the deploy's `GET /chat` proves the route and the host and never the model:

    curl -N -H 'X-Chat: 1' -H 'content-type: application/json' https://chat.blust.ch/chat -d '{"messages":[{"role":"user","content":"What does the model say about the owner?"}],"lang":"en"}'

## License

CC BY 4.0 for the text here; the model's own license is its own.
