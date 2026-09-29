// Mechanical import of verbatim blockquotes approved in source-thread steps
// 5A and 5B. No LLM rewrite and no changes to full-form pathway definitions.
import { readFileSync, writeFileSync } from "node:fs";
const turns = readFileSync(process.argv[2], "utf8").trim().split("\n").map(JSON.parse);
const copy = {};
for (const [turn, kind] of [[10, "strength"], [12, "opportunity"]]) {
  const text = turns.find(t => t.turn === turn).answer;
  const sections = text.split(/### Pathway /).slice(1);
  for (const section of sections) {
    const num = Number(section.match(/^\d+/)[0]);
    if (num === 3) continue;
    const paragraphs = section.split("\n").filter(line => line.startsWith("> ")).map(line => line.slice(2));
    if (!paragraphs.length) throw Error(`Missing ${kind} narrative ${num}`);
    copy[num] ??= {};
    copy[num][kind] = paragraphs.join("\n\n");
  }
}
if (Object.keys(copy).length !== 15 || Object.values(copy).some(p => !p.strength || !p.opportunity)) throw Error("Incomplete approved copy");
writeFileSync(new URL("../shared/shortFormNarratives.json", import.meta.url), JSON.stringify(copy, null, 2) + "\n");
