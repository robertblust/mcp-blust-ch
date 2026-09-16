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
