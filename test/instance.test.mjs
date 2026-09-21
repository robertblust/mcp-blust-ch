// What only this instance can assert: facts of Robert Blust's model and of this deployment's
// registry entry, which the shared tests cannot hold because every instance's differ.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getEntity, findEvidence, search, fetchEntity, ModelError } from "companygraph-mcp-server/model";
import { serverJson } from "companygraph-mcp-server/deploy";

const s = JSON.parse(fs.readFileSync(path.join(process.cwd(), "dist/snapshot.json"), "utf8"));
const entry = { name: "ch.blust/mental-model", url: "https://mcp.blust.ch/mcp" };

test("the root is Robert Blust", () => {
  assert.equal(s.root, "Robert Blust");
});

test("the company of one refuses a bare name and resolves a typed one", () => {
  assert.throws(() => fetchEntity(s, "Robert Blust"), (e) => e instanceof ModelError && /R2/.test(e.message));
  assert.equal(getEntity(s, "identity", "Robert Blust").entity.id, "identity");
  assert.equal(getEntity(s, "profile", "Robert Blust").entity.id, "profiles/robert-blust");
});

test("evidence is verbatim and search round-trips through fetch", () => {
  // The claim and each fact under it are separate edges from the profile, told apart by via.
  const ev = findEvidence(s, "Agentic AI development").evidence.profile;
  const claim = ev.find((x) => x.id === "profiles/robert-blust" && x.via === "Skills.Skill");
  assert.equal(claim.attrs.Level.name, "Expert");
  const row = ev.find((x) => x.via === "Evidence.Skill" && x.attrs["What it shows"].startsWith("Built LIKE MAGIC's internal AI marketplace on Claude"));
  assert.equal(row.attrs.Experience.name, "Co-Founder & Head of Technology");
  const hit = search(s, "LIKE MAGIC").results.find((r) => r.id === "profiles/robert-blust/experiences/2022-likemagic");
  assert.equal(fetchEntity(s, hit.id).title, "Co-Founder & Head of Technology");
});

test("the registry entry is generated from the model and fits the registry", () => {
  const j = serverJson(s, entry, "1.2.3");
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
  assert.throws(() => serverJson(long, entry, "1.0.0"), /100/);
});

test("the registry entry names the name and address deployment.json holds", () => {
  const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), "deployment.json"), "utf8"));
  assert.deepEqual({ name: d.registry_name, url: `https://${d.domain}/mcp` }, entry);
});
