import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectTopPathways, type PathwayScore } from "../shared/scoring";

const mk = (num: number, score: number): PathwayScore => ({ num, name: `P${num}`, goal: "g", score, band: "medium" } as PathwayScore);
const scores = [4.5, 2, 3.75, 2, 4.5, 2.25, 3, 3, 3, 3, 3.75, 2, 3, 3, 3, 4.6].map((s, i) => mk(i + 1, s));
const { strengths, opportunities } = selectTopPathways(scores);
assert.deepEqual(strengths.map((p) => p.num), [16, 1, 5], "highest three, ties by pathway number");
assert.deepEqual(opportunities.map((p) => p.num), [2, 4, 12], "lowest three, ties by pathway number");
const flat = selectTopPathways(Array.from({ length: 16 }, (_, i) => mk(i + 1, 3)));
assert.equal(new Set([...flat.strengths, ...flat.opportunities].map((p) => p.num)).size, 6, "never repeats a pathway");

const join = readFileSync("client/src/pages/JoinSurveyFlow.tsx", "utf8");
const solo = readFileSync("client/src/pages/SurveyFlow.tsx", "utf8");
const report = readFileSync("client/src/pages/Report.tsx", "utf8");
assert.match(join, /<Report summaryFirst /, "church participants get the summary-first report");
assert.doesNotMatch(solo, /summaryFirst/, "independent full-form report is unchanged");
assert.match(report, /View all sixteen Pathways/);
assert.match(report, /\(!summary \|\| showAll\)/, "full sixteen hidden until requested");
console.log("church report summary QA: 6 checks passed");
