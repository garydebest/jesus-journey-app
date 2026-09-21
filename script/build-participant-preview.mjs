// A separate, data-free participant-demo preview. Never deploy this wrapper
// to Render; production is built exclusively by npm run build.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(process.argv[2] || "/home/user/workspace/participant-demo-preview");
if (target === app || target.startsWith(app + "/")) throw Error("Preview must be outside source.");
mkdirSync(target, { recursive: true });
cpSync(join(app, "dist/public"), target, { recursive: true });
const html = readFileSync(join(target, "index.html"), "utf8")
  .replace("<head>", '<head><script>if (!location.hash) location.hash = "/join/GRACEDEMO";</script>')
  .replaceAll('"/assets/', '"./assets/')
  .replace("<title>Jesus Journey Survey</title>", "<title>Grace Participant Demo</title>");
writeFileSync(join(target, "index.html"), html);
console.log("Participant-only preview assembled:", target);
