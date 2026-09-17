import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// The server pin moves in package.json, and the lockfile keeps the old commit unless the
// package is installed by name; the image then runs the old server while every visible pin
// says otherwise. It happened on 2026-09-17. The installed package's own version is the
// one thing the tag cannot lie about.
const root = new URL("..", import.meta.url);
const pkg = JSON.parse(fs.readFileSync(new URL("package.json", root), "utf8"));
const installed = JSON.parse(fs.readFileSync(new URL("node_modules/companygraph-mcp-server/package.json", root), "utf8"));

test("the installed server is the release package.json pins", () => {
  const tag = pkg.dependencies["companygraph-mcp-server"].split("#")[1];
  assert.equal("v" + installed.version, tag);
});
