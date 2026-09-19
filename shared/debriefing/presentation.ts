import type { DebriefingReport, Insight, PathwayAnalysis } from "./types";

// One presentation model for React and Python. Never changes persisted scores.
export const DEBRIEFING_LAYOUT_VERSION = "paired-v1";
export interface Finding {
  headline: string;
  detail: string;
  directionalOnly: boolean;
}
export interface PairedTopic {
  topic: string;
  strengths: Finding[];
  opportunities: Finding[];
}
export interface EvidenceTable { title: string; headers: string[]; rows: string[][] }
export interface PairedSection {
  id: string;
  title: string;
  intro?: string;
  topics: PairedTopic[];
  tables: EvidenceTable[];
  notes: string[];
}
export interface DebriefingPresentation {
  version: string;
  sections: PairedSection[];
  notes: string[];
}
const n = (value: number | null | undefined, digits = 2) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "Not available";
const pct = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}%` : "Not available";

/** Remove only routine benchmark phrasing, not substantive belief/practice or stage gaps. */
export function presentationText(text: string): string {
  return text
    .replace("Both the pathway-level and dimension-level analysis independently surface this same area as the church's lowest-scoring, which raises confidence this is a real pattern rather than noise.",
      "Both pathway and dimension summaries identify this as a lower-scoring area. They may share underlying items, so this is converging descriptive evidence rather than independent statistical confirmation.")
    .replace(/ is a bright spot — running [\d.]+ points above the church average in spiritual maturity\./g, " is a strength to celebrate.")
    .replace(/ is a strength to celebrate — running [\d.]+ points above the church average in spiritual maturity\./g, " is a strength to celebrate.")
    .replace(/ is (?:an opportunity to explore — )?running [\d.]+ points below the church average in spiritual maturity\./g, " is an opportunity to explore.")
    .replace(/ — right in line with the church-wide average in spiritual maturity\./g, ".")
    .replace(/, vs\. the church-wide average\./g, ".")
    .replace(/, (?:above|below) the church-wide average\./g, ".")
    .replace(/ — vs\. [\d.]+% growing church-wide\./g, ".")
    .replace(/ — /g, ": ");
}
function finding(headline: string, detail: string, directionalOnly = false): Finding {
  return { headline: presentationText(headline), detail: presentationText(detail), directionalOnly };
}
function topic(name: string): PairedTopic { return { topic: name, strengths: [], opportunities: [] }; }
function fromInsights(insights: Insight[] = [], key: (i: Insight) => string): PairedTopic[] {
  const topics = new Map<string, PairedTopic>();
  for (const i of insights) {
    const label = key(i);
    const row = topics.get(label) ?? topic(label);
    const items = i.kind === "strength" ? row.strengths : row.opportunities;
    if (!items.some(x => x.headline === presentationText(i.headline) && x.detail === presentationText(i.detail))) {
      items.push(finding(i.headline, i.detail, i.directionalOnly));
    }
    topics.set(label, row);
  }
  return Array.from(topics.values());
}
function section(id: string, title: string, topics: PairedTopic[] = [], intro?: string): PairedSection {
  return { id, title, topics, intro, tables: [], notes: [] };
}
function insightTopic(i: Insight, report: DebriefingReport): string {
  const text = `${i.headline} ${i.detail}`;
  const pathway = report.pathwaysByGoal?.flatMap(g => g.pathways).find(p => text.includes(p.name));
  if (pathway) return pathway.name;
  if (/stated belief|seven core dimensions|strongest of the seven/i.test(text)) return "Beliefs and everyday practice";
  if (/most mature stage|most mature group/i.test(text)) return "Maturity and continued growth";
  return i.section.replace(/^Demographics [—:] /, "");
}
function pathwayTopic(path: PathwayAnalysis, report: DebriefingReport): PairedTopic {
  const row = topic(path.name);
  const gap = report.dimensions?.beliefPracticeGaps?.find(g => g.pathwayNum === path.num);
  const reciprocal = report.bottleneckMap?.reciprocityChecks?.find(r => r.pathwayName === path.name);
  const stages = (path.trajectory ?? []).filter(t => t.stage !== "Distant" && t.n > 0);
  const directional = report.respondentCount < 15 || stages.some(t => t.n < 15);
  if (gap && gap.beliefAvg != null && gap.practiceAvg != null && Math.abs(gap.beliefAvg - gap.practiceAvg) >= .2) {
    const beliefLeads = gap.beliefAvg > gap.practiceAvg;
    row.strengths.push(finding(
      beliefLeads ? "A foundation of belief to build on." : "Practice is an existing strength to build on.",
      `${beliefLeads ? "Belief" : "Practice"} items average ${n(beliefLeads ? gap.beliefAvg : gap.practiceAvg)} on the 0–5 scale.`,
      report.respondentCount < 15));
    row.opportunities.push(finding(
      beliefLeads ? "Help belief become more consistent practice." : "Deepen the belief underlying the practice.",
      `${beliefLeads ? "Practice" : "Belief"} items average ${n(beliefLeads ? gap.practiceAvg : gap.beliefAvg)}. The difference describes responses; it does not establish its cause.`,
      report.respondentCount < 15));
  }
  if (reciprocal && reciprocal.givingScore - reciprocal.receivingScore >= .2) {
    row.strengths.push(finding("Giving support is a resource to build on.",
      `Giving support scores ${n(reciprocal.givingScore)} (n=${reciprocal.n}).`, reciprocal.directionalOnly));
    row.opportunities.push(finding("Strengthen receiving as well as giving.",
      `Receiving support scores ${n(reciprocal.receivingScore)}. The survey does not establish who relates to whom or why support may feel one-directional.`,
      reciprocal.directionalOnly));
  }
  for (const reversal of path.reversals ?? []) {
    const from = path.trajectory.find(t => t.stage === reversal.fromStage);
    const to = path.trajectory.find(t => t.stage === reversal.toStage);
    row.opportunities.push(finding("A stage pattern worth noticing.",
      `${reversal.toStage} respondents score ${n(to?.score)}, compared with ${n(from?.score)} among ${reversal.fromStage} respondents. These are different groups, not evidence that individuals declined.`,
      directional || !from || !to));
  }
  if (row.strengths.length === 0 && stages.length >= 2 &&
      stages.every((s, index) => index === 0 || s.score > stages[index - 1].score)) {
    row.strengths.push(finding("Scores are higher in more mature groups.",
      `${stages[0].stage}: ${n(stages[0].score)}; ${stages[stages.length - 1].stage}: ${n(stages[stages.length - 1].score)}. This is a cross-sectional pattern, not tracked personal growth.`, directional));
  }
  if (path.band === "low" && row.opportunities.length === 0) {
    row.opportunities.push(finding("A practical area for growth.",
      `The pathway averages ${n(path.churchAverage)} on the 0–5 scale and is in the saved analysis's lower-scoring band. The aggregate alone does not identify a specific cause or intervention.`,
      report.respondentCount < 15));
  }
  return row;
}

export function buildDebriefingPresentation(report: DebriefingReport): DebriefingPresentation {
  const sections: PairedSection[] = [];
  const summary = fromInsights([
    ...(report.executiveSummary?.strengths ?? []),
    ...(report.executiveSummary?.opportunities ?? []),
  ], i => insightTopic(i, report));
  // Add a related counterpart only when the saved numbers support it.
  for (const row of summary) {
    const path = report.pathwaysByGoal?.flatMap(g => g.pathways).find(p => p.name === row.topic);
    if (path) {
      const counterpart = pathwayTopic(path, report);
      if (!row.strengths.length) row.strengths.push(...counterpart.strengths.slice(0, 1));
      if (!row.opportunities.length) row.opportunities.push(...counterpart.opportunities.slice(0, 1));
    }
    if (row.topic === "Beliefs and everyday practice" && !row.opportunities.length) {
      const item = report.dimensions?.insights?.find(i => /stated belief/i.test(i.headline));
      if (item) row.opportunities.push(finding(item.headline, item.detail, item.directionalOnly));
    }
  }
  sections.push(section("summary", "Executive summary", summary,
    "Related strengths and opportunities are shown together. A finding stands on its own when no supported counterpart is available."));

  for (const d of report.demographics ?? []) {
    const insights = [...(d.insights ?? []), ...(report.demographicAssessment ?? []).filter(i =>
      i.section.includes(d.title) || (d.id === "ageGroup" && /age group/i.test(i.section)))];
    if (!insights.length) continue;
    sections.push(section(`demographic-${d.id}`, d.title,
      fromInsights(insights, i => {
        const match = [...d.breakdown].sort((a, b) => b.group.length - a.group.length).find(r => i.headline.startsWith(r.group));
        return match?.group ?? i.headline;
      })));
  }
  // Preserve coverage-gap findings and legacy assessment sections that cannot be matched.
  const shown = new Set(sections.flatMap(s => s.topics.flatMap(t => [...t.strengths, ...t.opportunities].map(f => f.headline))));
  const remaining = (report.demographicAssessment ?? []).filter(i => !shown.has(presentationText(i.headline)));
  if (remaining.length) sections.push(section("demographic-assessment", "Demographic assessment",
    fromInsights(remaining, i => i.section.replace(/^Demographic Assessment [—:] /, ""))));
  if (report.engagement?.insights?.length) sections.push(section("engagement", "Engagement",
    fromInsights(report.engagement.insights, i => insightTopic(i, report))));

  const maturity = section("maturity", "Spiritual maturity and change",
    fromInsights([...(report.maturityAndChange?.insights ?? []), ...(report.maturityStageAssessment ?? [])],
      i => i.section.startsWith("Maturity Stage Assessment") ? i.section.replace(/^Maturity Stage Assessment [—:] /, "") : "Maturity and continued growth"));
  maturity.tables.push({
    title: "Maturity-stage profile",
    headers: ["Stage", "n", "Share", "Growing", "Same or fading"],
    rows: (report.maturityAndChange?.distribution ?? []).map(d => {
      const change = report.maturityAndChange?.changeByMaturity?.find(x => x.maturityLabel === d.label);
      return [d.label + (d.count < 15 ? "*" : ""), String(d.count), pct(d.pct), pct(change?.growingPct), pct(change?.sameOrFadingPct)];
    }),
  });
  maturity.notes.push(`Average self-reported maturity: ${n(report.maturityAndChange?.averageMaturity)} (1–5 stage scale). Staying the same and fading are distinct experiences.`);
  if (report.maturityAndChange?.funnel?.length) {
    maturity.tables.push({
      title: "Stage distribution detail (not an advancement rate)",
      headers: ["From stage", "Target stage", "From n", "At / above target n"],
      rows: report.maturityAndChange.funnel.map(f => [f.fromLabel, f.toLabel, String(f.fromCount), String(f.toOrHigherCount)]),
    });
  }
  sections.push(maturity);

  for (const goal of report.pathwaysByGoal ?? []) {
    const s = section(`goal-${goal.goal}`, goal.goal, goal.pathways.map(p => pathwayTopic(p, report)),
      `Goal average: ${n(goal.goalAverage)} on the 0–5 pathway scale.`);
    const stages = Array.from(new Set(goal.pathways.flatMap(p => p.trajectory.map(t => t.stage))));
    s.tables.push({
      title: "Supporting pathway scores",
      headers: ["Pathway", "All", ...stages],
      rows: goal.pathways.map(p => [p.name, n(p.churchAverage), ...stages.map(stage => {
        const t = p.trajectory.find(t => t.stage === stage);
        return t ? `${n(t.score)}${t.n < 15 ? "*" : ""}` : "Not available";
      })]),
    });
    s.notes.push("Stage comparisons describe different groups, not the progress of the same people over time. *Subgroups smaller than 15 are directional only.");
    sections.push(s);
  }
  const dimensions = section("dimensions", "Beliefs, practices and underlying dimensions",
    fromInsights(report.dimensions?.insights ?? [], () => "Beliefs and everyday practice"));
  dimensions.tables.push({
    title: "Seven underlying dimensions", headers: ["Dimension", "Type", "Score", "Rank"],
    rows: (report.dimensions?.rollups ?? []).map(d => [d.name.replace(/ — /g, ": "), d.type, n(d.churchAverage), String(d.rank)]),
  });
  dimensions.tables.push({
    title: "Belief and practice by pathway", headers: ["Pathway", "Belief", "Practice"],
    rows: (report.dimensions?.beliefPracticeGaps ?? []).map(g => [g.pathwayName, n(g.beliefAvg), n(g.practiceAvg)]),
  });
  sections.push(dimensions);
  sections.push(section("bottlenecks", "Discipleship growth priorities",
    fromInsights(report.bottleneckMap?.insights ?? [], i => insightTopic(i, report))));
  sections.push(section("cross-cutting", "Cross-cutting insights",
    fromInsights(report.crossCutting?.insights ?? [], i => insightTopic(i, report)),
    "Converging pathway and dimension findings may share underlying items; they are not independent statistical proof."));

  for (const d of report.demographics ?? []) {
    const s = section(`evidence-${d.id}`, `Supporting evidence: ${d.title}`);
    s.tables.push({
      title: d.title, headers: ["Group", "n", "Share", "Maturity", "Growing", "Fading"],
      rows: d.breakdown.map(r => [r.group + (r.directionalOnly ? "*" : ""), String(r.n), pct(r.pctOfChurch),
        n(r.avgMaturity), pct(r.growingPct), pct(r.fadingPct)]),
    });
    s.notes.push("Maturity uses the 1–5 self-selected stage scale. Growing and fading combine their respective response categories. *Directional only: fewer than 15 respondents.");
    sections.push(s);
  }
  return {
    version: DEBRIEFING_LAYOUT_VERSION,
    sections: sections.filter(s => s.topics.length || s.tables.some(t => t.rows.length)),
    notes: [...(report.dataNotes ?? []),
      "This report uses saved survey analysis. Descriptive differences do not establish causation or statistical significance.",
      "Where only one finding is supported, it is shown without inventing an opposite finding."],
  };
}
