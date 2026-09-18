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

mcp.blust.ch: the reference instance served over MCP. Three pins, each moved only in a pull
request: `source.json` names the commit of `robertblust/mental-model` the image serves,
`package.json` names the release of `companygraph/mcp-server` that serves it and the release of
`@robertblust/design` whose blocks the landing page is styled from. The required
checks on `main` are `conventions / conventions` and `build`, the job that writes the snapshot,
runs the tests and builds the image. `infra/bootstrap/` is the owner's, applied once by hand;
`infra/` is CI's, applied on every merge. Nothing here commits to the model or the server.

`snapshot.json` and `page.css` are built, never committed: the snapshot from the model commit,
the stylesheet from the design package's own blocks with the fonts inlined, because a page
rendered by a server has no static directory to serve them from. Both are written by CI before
the image is built, and the server is told to use them.

`favicon.svg` is committed rather than built: it is the mark blust.ch carries, copied here
because a surface inlines its own copy in this family — the design package styles `.rbmark` and
ships no SVG for it. Two copies that can drift, and the cost is accepted for 971 bytes that
change about never; a palette change moves both.

The host rewrites every path to the service rather than only `/mcp`, so the server owns `/`,
`/health` and its own 404. A path the server grows later needs no apply.

