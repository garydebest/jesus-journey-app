import { Badge } from "@/components/ui/badge";
import type { DebriefingReport } from "@shared/debriefing/types";
import { buildDebriefingPresentation, type Finding, type PairedTopic } from "@shared/debriefing/presentation";

function Findings({ items, kind }: { items: Finding[]; kind: "strength" | "opportunity" }) {
  return <div className="min-w-0 p-4 space-y-3">
    <h5 className={`text-xs font-semibold uppercase tracking-wide ${kind === "strength" ? "text-primary" : "text-amber-800 dark:text-amber-300"}`}>
      {kind === "strength" ? "Strengths to celebrate" : "Opportunities to explore"}
    </h5>
    {items.map((item, i) => <div key={i} className="space-y-1">
      <p className="text-sm font-medium leading-relaxed">{item.headline}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{item.detail}</p>
      {item.directionalOnly && <Badge variant="secondary" className="text-xs">Directional only · small group</Badge>}
    </div>)}
  </div>;
}
function Topic({ row }: { row: PairedTopic }) {
  const both = row.strengths.length > 0 && row.opportunities.length > 0;
  if (!row.strengths.length && !row.opportunities.length) return null;
  return <div className="rounded-lg border border-border overflow-hidden" data-paired-topic={row.topic}>
    <h4 className="bg-muted/50 px-4 py-2 text-sm font-semibold">{row.topic}</h4>
    <div className={both ? "grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border" : ""}>
      {row.strengths.length > 0 && <Findings items={row.strengths} kind="strength" />}
      {row.opportunities.length > 0 && <Findings items={row.opportunities} kind="opportunity" />}
    </div>
  </div>;
}

/** Admin-only; shared presentation also drives the downloadable PDF. */
export function DebriefingReportView({ report }: { report: DebriefingReport }) {
  const model = buildDebriefingPresentation(report);
  return <div className="min-w-0 w-full space-y-8 text-sm break-words" data-debriefing-layout={model.version}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="font-semibold text-lg">{report.churchName}</h2>
        <p className="text-muted-foreground mt-1">{report.waveLabel}</p>
        <p className="text-xs text-muted-foreground mt-1">{report.respondentCount} respondents · generated {new Date(report.generatedAt).toLocaleDateString()}</p>
      </div>
      <Badge variant="outline">Admin only · internal use</Badge>
    </div>
    {model.sections.map(s => <section key={s.id} className="space-y-4" aria-labelledby={`debrief-${s.id}`}>
      <div className="border-b border-border pb-2">
        <h3 id={`debrief-${s.id}`} className="text-base font-semibold">{s.title}</h3>
        {s.intro && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.intro}</p>}
      </div>
      {s.topics.map((row, i) => <Topic key={i} row={row} />)}
      {s.tables.filter(t => t.rows.length).map((table, i) => <div key={i} className="space-y-2">
        <h4 className="text-sm font-medium">{table.title}</h4>
        <div className="overflow-x-auto rounded-md border border-border" role="region" aria-label={table.title} tabIndex={0}>
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/60"><tr>{table.headers.map((h, j) => <th key={j} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((row, j) => <tr key={j} className="border-t border-border even:bg-muted/20">
              {row.map((value, k) => <td key={k} className="px-3 py-2 align-top tabular-nums">{value}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </div>)}
      {s.notes.map((note, i) => <p key={i} className="text-xs leading-relaxed text-muted-foreground">{note}</p>)}
    </section>)}
    <section className="border-t border-border pt-4 space-y-2">
      <h3 className="font-semibold">Data notes and caveats</h3>
      {model.notes.map((note, i) => <p key={i} className="text-xs leading-relaxed text-muted-foreground">{note}</p>)}
    </section>
  </div>;
}
