<!-- conventions · v1.31.0 -->
Shared conventions of the robertblust, guestgraph and companygraph organizations live in `conventions/`, vendored from robertblust/conventions at the release `conventions.json` names. Read them before writing or committing anything here.

- `conventions/WRITING.md` — how we write: one voice, three registers, English and German.
- `conventions/WORKING.md` — how we work with git and GitHub.
- `conventions/REPOSITORIES.md` — the family: what each repository is and what pins what.
- `conventions/WRITER.md`, `conventions/TRANSLATOR.md`, `conventions/EDITOR.md`,
  `conventions/BACKREADER.md`, `conventions/GLOSSARY.md`, `conventions/GERMAN.md` — the four roles
  that make a text, the terms they keep and the German they write.

Everything below this block is this repository's own. `sh conventions/conventions-sync check` says whether the copy matches the release, `sync` brings it to the release the pin names, and `sh conventions/conventions-check` holds this repository's own Markdown to `WRITING.md`, and `sh conventions/conventions-format` to its one form, which `fix` writes. Edit a shared file in robertblust/conventions, never here.
<!-- end conventions -->

## This repository

mcp.blust.ch: the reference instance served over MCP. Three pins, each moved only in a pull request: `source.json` names the commit of `robertblust/mental-model` the image serves, `package.json` names the release of `companygraph/mcp-server` that serves it and the release of `@robertblust/design` whose blocks the landing page is styled from. The required checks on `main` are `conventions / conventions` and `deploy / build`, the job that writes the snapshot, runs the tests and builds the image. The build, the tests that are not this instance's own, the Terraform module and the two workflows are `companygraph/mcp-server`'s, under its `deploy/`, and the release `package.json` pins is named again in both workflows and in the module's `?ref=`; a shared test holds the three to one. What is this deployment's own is `deployment.json`, `brand.html`, `own.css`, `favicon.svg`, `robots.txt`, the Terraform root in `infra/main.tf` and `test/instance.test.mjs`. `infra/bootstrap/` is the owner's, applied once by hand; `infra/` is CI's, applied on every merge. Nothing here commits to the model or the server.

`chat/`, `infra/chat/` and `.github/workflows/chat.yml` are the chat beside the server, `companygraph/chat-server` deployed from here, with its own three-place pin held by that package's test and its own required checks on `main`, `chat / build` and `chat / terraform`. The README's `## The chat` says what is the owner's.

`dist/jsonld.json` is built and never committed either, from the same snapshot: the person and the endpoint the surface's file says a crawler is told about, with the addresses read from the profile's `## Also at`. It carries no check of its own against going stale, because it cannot — blust.ch needs one since it commits its rendered pages, and nothing rendered is committed here. What holds it instead is two tests. The shared page test holds the JSON-LD the page serves to what the build wrote, and `test/instance.test.mjs` holds what the build wrote to the snapshot it came from, field by field, which the design package's own shared-node check calls the stronger form; the one half of that check worth keeping is there too, that no two nodes share an `@id` and no pointer resolves outside the document. `robots.txt` is written by hand and committed, because a rule about what may be crawled is a decision rather than a derivation.

`dist/snapshot.json` and `dist/page.css` are built, never committed: the snapshot from the model commit, the stylesheet from the design package's own blocks with the fonts inlined, because a page rendered by a server has no static directory to serve them from. Both are written by CI before the image is built, and the server is told to use them.

`favicon.svg` is committed rather than built: it is the mark blust.ch carries, copied here because a surface inlines its own copy in this family — the design package styles `.rbmark` and ships no SVG for it. Two copies that can drift, and the cost is accepted for 971 bytes that change about never; a palette change moves both.

The host rewrites every path to the service rather than only `/mcp`, so the server owns `/`, `/health` and its own 404. A path the server grows later needs no apply.

## What checks the page

The page tests the server ships under `deploy/test/` open a browser and measure the rendered page: the shell's measure and gutter, where the mark sits, that the wordmark is two colors and one line, and that nothing scrolls sideways at 360px. They are the only thing here that needs a browser, and the workflows install chromium for it.

They exist because the three sites are covered by the design package's own page checks and this page is not — those crawl a directory of files and this page is rendered by a server. The design system's position is that a contract is an outcome rather than a declaration: `header.css` leaves the brand lockup and the bar's gap to each site on purpose, and `verify/pages.mjs` measures the result instead. Those tests are that treatment, narrowed to what this page has.

Two of their checks read what they expect out of the design package rather than naming a number: the shell's measure comes from `blocks/reset.css`, and the headline is asserted as the title contract's shape. A release that moves either fails here instead of diverging quietly. The container itself is not styled in `own.css` at all — the page names it `main.shell` and the vendored reset owns it, because a number restated beside the package declaring it is a number that drifts.

`own.css` is a file and not a string in the page-css build for one reason: a backtick in it, in a comment naming a class, ended the template literal that used to hold it and broke the build three times. A rule that has to be remembered is a rule that gets forgotten.

Every assertion in them is a mistake that was made and that nothing else caught — a doubled brace that swallowed the shell's gutter, body padding that pushed the mark below its siblings, a link rule that painted the whole wordmark one color, and a commit hash with nothing to break on that took the page past the viewport. None of them failed anything: the sheet parsed and the page rendered every time.
