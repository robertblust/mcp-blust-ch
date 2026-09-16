// The one way this repository reads the model it pins: the server's own snapshot command,
// against the commit source.json names, so what the image serves is what the pin says.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const { repo, commit } = JSON.parse(fs.readFileSync(new URL("source.json", root), "utf8"));
const out = fileURLToPath(new URL("snapshot.json", root));
execFileSync("npx", ["--no-install", "companygraph-mcp-snapshot", "--github", `${repo}@${commit}`,
  "--sub", "model/", "--core", "meta/core/", "--out", out], { stdio: "inherit" });
