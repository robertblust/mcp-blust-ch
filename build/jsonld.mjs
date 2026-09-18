// The structured data this surface shows, derived from the model it serves.
//
// `model/surfaces/mcp-blust-ch-mcp-server.md` names the unit: the person and the endpoint that
// the page describes to a crawler, with the person's addresses from the profile's `## Also at`.
// Nothing here is typed that the snapshot does not hold, for the same reason nothing on the page
// is: a fact written beside the model is a fact that can disagree with it.
//
// The family settled how a sibling carries the person, and this follows it rather than reopening
// it. A sibling cannot merely reference `https://blust.ch/#person`: a bare `{"@id": …}` is a
// pointer that has to resolve inside the same document, and a crawler reads a graph per
// document. So each surface defines its own copy and keeps it minimal — `@id`, `@type`, `name`,
// `url` and the addresses — so that two copies cannot say different things about the same
// subject beyond what they both hold.
//
// The endpoint is a `WebAPI`, which is what this surface is and what no other surface in the
// family has. Its `@id` is this host's, not blust.ch's, because it is this host's thing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, "snapshot.json"), "utf8"));

const byId = (id) => snapshot.entities.find((e) => e.id === id);
const identity = byId(snapshot.rootId);
if (!identity) throw new Error("the snapshot names no identity");

// The surface entity says where this is published, so the addresses come from the model rather
// than from a constant here. A surface whose url the model does not hold is a surface this
// script cannot describe, and saying so beats guessing a host.
const surface = snapshot.entities.find(
  (e) => e.type === "surface" && String(e.fields?.["built-by"] ?? "").endsWith("/mcp-blust-ch")
    && e.name.includes("MCP server"));
if (!surface?.fields?.url) throw new Error("the model names no url for this surface");
const origin = surface.fields.url.replace(/\/$/, "");
// The schema says a surface's url is where it is published, and for this one that is the host.
// A url carrying a path is a pin left behind a model that has moved, and every address below
// would be built on it — so it stops here rather than shipping `/mcp/mcp` to a crawler.
if (new URL(origin).pathname !== "/")
  throw new Error(`the surface's url is ${origin}, which carries a path: this reads it as the host`);

// Every address the profile keeps for the subject, in the model's own order. The surface's own
// host is not among them: a page listing itself as somewhere else the subject can be found tells
// a crawler nothing it did not already have.
const profile = snapshot.entities.find((e) => e.type === "profile" && e.name === snapshot.root);
const alsoAt = profile?.sections?.find((s) => s.heading === "Also at")?.tables?.[0];
// Neither this host nor the subject's own url: `url` already carries the second, and a `sameAs`
// repeating it says the subject is also themselves. blust.ch's own graph reads the same way.
const home = identity.fields.url?.replace(/\/$/, "");
const sameAs = (alsoAt?.rows ?? [])
  .map((r) => r[alsoAt.columns.indexOf("URL")])
  .filter((u) => u && !u.startsWith(origin) && u.replace(/\/$/, "") !== home);
if (!sameAs.length) throw new Error("the profile's Also at holds no address");

const graph = [
  {
    "@type": "Person",
    "@id": `${origin}/#person`,
    name: identity.name,
    url: identity.fields.url,
    sameAs,
  },
  {
    "@type": "WebAPI",
    "@id": `${origin}/#api`,
    name: surface.name,
    description: surface.tagline,
    url: `${origin}/mcp`,
    documentation: `${origin}/`,
    provider: { "@id": `${origin}/#person` },
    about: { "@id": `${origin}/#person` },
  },
];

const out = path.join(ROOT, "jsonld.json");
fs.writeFileSync(out, JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2) + "\n");
console.log(`wrote ${out}: a Person with ${sameAs.length} addresses and a WebAPI at ${origin}/mcp`);
