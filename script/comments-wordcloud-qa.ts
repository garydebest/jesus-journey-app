// Node -> Python bridge check for the Comments Wordcloud. No storage or network.
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { renderWordcloudFromCommentsPdf, wordcloudStorageKey } from "../server/wordcloud";

const source = process.env.SAMPLE_COMMENTS_PDF;
assert(source, "Set SAMPLE_COMMENTS_PDF to a saved Comments Report PDF");
const { pdf, dir } = await renderWordcloudFromCommentsPdf(await readFile(source));
assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
writeFileSync("/tmp/jj-wordcloud-qa.pdf", pdf);
const text = execFileSync("pdftotext", ["/tmp/jj-wordcloud-qa.pdf", "-"], { encoding: "utf8" });
for (const expected of ["What Your People Are Saying", "Theme Counts and Method", "Learning to trust God"]) assert(text.includes(expected), expected);
assert.equal(wordcloudStorageKey("abc"), "abc-wordcloud-v1.pdf");
await rm(dir, { recursive: true, force: true });
console.log(`PASS: wordcloud bridge produced ${pdf.length} bytes with expected themes.`);
