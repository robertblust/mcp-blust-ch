# mcp.blust.ch

The reference instance of CompanyGraph, `robertblust/mental-model`, served over MCP at
`https://mcp.blust.ch/mcp`. This repository pins one commit of the model and one release of
`companygraph/mcp-server`, builds an image that carries the model's snapshot, and runs it on
Cloud Run in Zurich behind Firebase Hosting. Everything below the Google Cloud project is
Terraform, applied by GitHub Actions.

Whoever asks about Robert Blust's work — a person, a search engine, an agent — reaches the
same answer, because every surface derives from one model. This is the surface an agent
queries.

The design is in `docs/superpowers/specs/`. Nothing else is built yet.
