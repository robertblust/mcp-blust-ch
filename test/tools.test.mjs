import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "companygraph-mcp-server";
import { listTypes, getEntity, findEvidence, search, fetchEntity, ModelError } from "companygraph-mcp-server/model";

const root = new URL("..", import.meta.url);
const source = JSON.parse(fs.readFileSync(new URL("source.json", root), "utf8"));
const s = JSON.parse(fs.readFileSync(new URL("snapshot.json", root), "utf8"));

test("the snapshot is the pinned commit of the pinned repository", () => {
  assert.equal(s.commit, source.commit);
  assert.equal(s.repo, source.repo);
  assert.equal(s.core.version, "0.27.0");
  assert.equal(s.root, "Robert Blust");
  assert.equal(listTypes(s).types.length, 15);
});

test("every type describes and lists, and one entity of each resolves", () => {
  for (const t of listTypes(s).types) {
    if (t.count === 0) continue;
    const { entity } = getEntity(s, t.type, s.entities.find((e) => e.type === t.type).name);
    assert.equal(entity.type, t.type);
    assert.ok(Array.isArray(entity.references) && Array.isArray(entity.referencedBy));
  }
});

test("the company of one refuses a bare name and resolves a typed one", () => {
  assert.throws(() => fetchEntity(s, "Robert Blust"), (e) => e instanceof ModelError && /R2/.test(e.message));
  assert.equal(getEntity(s, "identity", "Robert Blust").entity.id, "identity");
  assert.equal(getEntity(s, "profile", "Robert Blust").entity.id, "profiles/robert-blust");
});

test("evidence is verbatim and search round-trips through fetch", () => {
  const claim = findEvidence(s, "Agentic AI development").evidence.profile.find((x) => x.id === "profiles/robert-blust");
  assert.equal(claim.attrs.Level.name, "Expert");
  assert.ok(claim.attrs.Evidence.startsWith("Built LIKE MAGIC's internal AI marketplace on Claude"));
  const hit = search(s, "LIKE MAGIC").results.find((r) => r.id === "profiles/robert-blust/experiences/2022-likemagic");
  assert.equal(fetchEntity(s, hit.id).title, "Co-Founder & Head of Technology");
});

test("the server lists seven tools and every answer carries the commit", async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(s).connect(a);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(b);
  assert.equal(client.getServerVersion().title, "Robert Blust");
  const { tools } = await client.listTools();
  assert.equal(tools.length, 7);
  for (const name of tools.map((t) => t.name)) {
    const args = { list_types: {}, describe_schema: { type: "skill" }, list_entities: { type: "value" },
      get_entity: { type: "identity", name: "Robert Blust" }, find_evidence: { skill: "Agentic AI development" },
      search: { query: "model" }, fetch: { id: "identity" } }[name];
    const r = await client.callTool({ name, arguments: args });
    assert.equal(r.isError, undefined, name);
    assert.equal(r.structuredContent.model.commit, source.commit, name);
  }
  await client.close();
});
