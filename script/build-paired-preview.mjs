// Preview-only assembly; production's built assets are not modified.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const target = "/home/user/workspace/jj-paired-preview";
mkdirSync(target, {recursive:true});
cpSync(resolve("dist/public"), target, {recursive:true});
const banner = `<div style="padding:10px 16px;background:#e7eeeb;color:#294d49;font:13px/1.5 sans-serif;text-align:center">Read-only paired-report preview · Synthetic Grace Fellowship data only.<br>Admin preview password: <strong>PreviewOnly2026</strong> · Sign in → Demo → Debriefing report or Debriefing PDF. Other account features are not connected in this report preview.</div>`;
let html = readFileSync(target + "/index.html", "utf8")
  .replace("<head>", '<head><script>if (!location.hash) location.hash="/admin/login";</script>')
  .replaceAll('"/assets/', '"./assets/')
  .replace("<body>", "<body>" + banner);
writeFileSync(target + "/index.html", html);
console.log("Report preview assembled.");
