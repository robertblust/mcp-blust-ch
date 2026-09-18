<!-- conventions · v1.17.0 -->
Shared conventions of the robertblust, guestgraph and companygraph organizations live in
`conventions/`, vendored from robertblust/conventions at the release `conventions.json`
names. Read them before writing or committing anything here.

- `conventions/WRITING.md` — how we write: one voice, three registers, English and German.
- `conventions/WORKING.md` — how we work with git and GitHub.
- `conventions/REPOSITORIES.md` — the family: what each repository is and what pins what.
- `conventions/WRITER.md`, `conventions/TRANSLATOR.md`, `conventions/GLOSSARY.md` — the two roles that
  make a text, and the terms they keep.

Everything below this block is this repository's own. `sh conventions/conventions-sync check`
says whether the copy matches the release, `sync` brings it to the release the pin names, and
`sh conventions/conventions-check` holds this repository's own Markdown to `WRITING.md`. Edit
a shared file in robertblust/conventions, never here.
<!-- end conventions -->

## This repository

mcp.blust.ch: the reference instance served over MCP. Two pins, each moved only in a pull
request: `source.json` names the commit of `robertblust/mental-model` the image serves, and
`package.json` names the release of `companygraph/mcp-server` that serves it. The required
checks on `main` are `conventions / conventions` and `build`, the job that writes the snapshot,
runs the tests and builds the image. `infra/bootstrap/` is the owner's, applied once by hand;
`infra/` is CI's, applied on every merge. Nothing here commits to the model or the server.

