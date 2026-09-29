// Private preview packaging only. Never run this for a production deployment.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
const app = process.cwd();
const target = resolve(process.argv[2]);
const frontSource = resolve(process.argv[3]);
if (target.startsWith(app + "/")) throw Error("Preview must be outside source");
mkdirSync(target, { recursive: true });
cpSync(join(app, "dist/public"), target, { recursive: true });
const html = readFileSync(join(target, "index.html"), "utf8")
  .replace("<head>", '<head><script>if (!location.hash) location.hash="/demo";</script>')
  .replaceAll('"/assets/', '"./assets/');
writeFileSync(join(target, "index.html"), html);
const front = join(target, "front");
mkdirSync(front, { recursive: true });
for (const file of ["index.html", "privacy.html", "terms.html", "base.css", "style.css", "explainer-config.js", "assets"]) {
  cpSync(join(frontSource, file), join(front, file), { recursive: true });
}
writeFileSync(join(front, "index.html"), readFileSync(join(front, "index.html"), "utf8")
  .replace("<head>", '<head><script>window.JJ_PREVIEW_APP_URL = new URL("../index.html", location.href).href;</script>')
  .replace('href="https://myjesusjourney.life/#/demo"', 'href="../index.html#/demo"'));
console.log("Demo and front-page preview:", target);
