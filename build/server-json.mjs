// The registry entry, written from the model rather than by hand: the title is the identity's
// H1, the description is the identity's H1 and the vision's H1, and the version is the tag the
// workflow passes. The registry caps a description at 100 characters and the build fails
// rather than truncates, because a truncated sentence is a claim nobody made.
import fs from "node:fs";

export const NAME = "ch.blust/mental-model";
export const URL_ = "https://mcp.blust.ch/mcp";

export function serverJson(snapshot, version) {
  const vision = snapshot.entities.find((e) => e.type === "vision");
  const description = `${snapshot.root}: ${vision.name}`;
  if (description.length > 100) throw new Error(`description is ${description.length} characters; the registry allows 100`);
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: NAME,
    title: snapshot.root,
    description,
    version,
    remotes: [{ type: "streamable-http", url: URL_ }],
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const version = process.argv[2];
  if (!version) { console.error("usage: node build/server-json.mjs <version>"); process.exit(2); }
  const root = new URL("..", import.meta.url);
  const snapshot = JSON.parse(fs.readFileSync(new URL("snapshot.json", root), "utf8"));
  fs.writeFileSync(new URL("server.json", root), JSON.stringify(serverJson(snapshot, version), null, 2) + "\n");
  console.log(`wrote server.json for ${NAME} ${version}`);
}
