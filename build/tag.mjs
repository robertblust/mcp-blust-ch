// The image tag: the instance's core version and the model's short commit, so a tag names the
// one snapshot inside the image.
import fs from "node:fs";
const s = JSON.parse(fs.readFileSync(new URL("../snapshot.json", import.meta.url), "utf8"));
process.stdout.write(`${s.core.version}-${s.commit.slice(0, 7)}\n`);
