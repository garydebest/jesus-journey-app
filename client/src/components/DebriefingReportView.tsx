import { Badge } from "@/components/ui/badge";
import type { DebriefingReport, Insight } from "@shared/debriefing/types";

function InsightRow({ insight }: { insight: Insight }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <Badge variant={insight.kind === "strength" ? "outline" : "secondary"} className="text-[10px] uppercase tracking-wide">
          {insight.kind === "strength" ? "Strength to celebrate" : "Opportunity to explore"}
        </Badge>
        {insight.directionalOnly && (
          <Badge variant="secondary" className="text-[10px]">
            Directional only
          </Badge>
        )}
      </div>
      <div className="text-sm font-medium">{insight.headline}</div>
      <div className="text-xs text-muted-foreground">{insight.detail}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold border-b border-border pb-1 mt-6">{children}</h3>;
}

/** Admin-only internal debriefing report view. Never shown to church accounts. */
export function DebriefingReportView({ report }: { report: DebriefingReport }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{report.churchName}</div>
          <div className="text-xs text-muted-foreground">
            {report.waveLabel} · {report.respondentCount} respondents · generated {new Date(report.generatedAt).toLocaleDateString()}
          </div>
        </div>
        <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
          Admin only — internal use
        </Badge>
      </div>

      <SectionHeading>Executive summary — strengths</SectionHeading>
      <div className="space-y-3">
        {report.executiveSummary.strengths.map((i, idx) => (
          <InsightRow key={idx} insight={i} />
        ))}
      </div>

      <SectionHeading>Executive summary — opportunities</SectionHeading>
      <div className="space-y-3">
        {report.executiveSummary.opportunities.map((i, idx) => (
          <InsightRow key={idx} insight={i} />
        ))}
      </div>

      <SectionHeading>Demographics</SectionHeading>
      {report.demographics.map((section) => (
        <div key={section.id} className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3">{section.title}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3">Group</th>
                  <th className="py-1 pr-3">n</th>
                  <th className="py-1 pr-3">% of church</th>
                  <th className="py-1 pr-3">Avg maturity</th>
                  <th className="py-1 pr-3">vs church</th>
                  <th className="py-1 pr-3">Growing %</th>
                </tr>
              </thead>
              <tbody>
                {section.breakdown.map((row) => (
                  <tr key={row.group} className="border-t border-border">
                    <td className="py-1 pr-3">
                      {row.group}
                      {row.directionalOnly && <span className="text-muted-foreground"> (directional)</span>}
                    </td>
                    <td className="py-1 pr-3">{row.n}</td>
                    <td className="py-1 pr-3">{row.pctOfChurch.toFixed(0)}%</td>
                    <td className="py-1 pr-3">{row.avgMaturity.toFixed(2)}</td>
                    <td className="py-1 pr-3">{row.maturityVsChurch >= 0 ? "+" : ""}{row.maturityVsChurch.toFixed(2)}</td>
                    <td className="py-1 pr-3">{row.growingPct.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2">
            {section.insights.map((i, idx) => (
              <InsightRow key={idx} insight={i} />
            ))}
          </div>
        </div>
      ))}

      <SectionHeading>Demographic assessment</SectionHeading>
      <div className="text-xs text-muted-foreground">
        Every age group, the singles/married split, and children-in-household — each with an explicit verdict, not just standout cases.
      </div>
      <div className="space-y-3">
        {report.demographicAssessment.map((i, idx) => (
          <InsightRow key={idx} insight={i} />
        ))}
      </div>

      <SectionHeading>Engagement</SectionHeading>
      <div className="space-y-3">
        {report.engagement.insights.map((i, idx) => (
          <InsightRow key={idx} insight={i} />
        ))}
      </div>

      <SectionHeading>Spiritual maturity & change</SectionHeading>
      <div className="text-xs text-muted-foreground">Church average maturity: {report.maturityAndChange.averageMaturity.toFixed(2)}</div>
      <div className="space-y-3">
        {report.maturityAndChange.insights.map((i, idx) => (
          <InsightRow key={idx} insight={i} />
        ))}
      </div>

      <SectionHeading>Maturity stage assessment</SectionHeading>
      <div className="text-xs text-muted-foreground">
        Exploring, Believing, Trusting, and God Centered — each with an explicit verdict.
      </div>
      <div className="space-y-3">
        {report.maturityStageAssessment.map((i, idx) => (
          <InsightRow key={idx} insight={i} />
        ))}
      </div>

      <SectionHeading>Pathways by goal</SectionHeading>
      {report.pathwaysByGoal.map((goal) => (
        <div key={goal.goal} className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3">
            {goal.goal} · avg {goal.goalAverage.toFixed(2)}
          </div>
          <ul className="text-xs list-disc list-inside">
            {goal.pathways.map((p) => (
              <li key={p.num}>
                {p.num}. {p.name} — {p.churchAverage.toFixed(2)} ({p.band})
              </li>
            ))}
          </ul>
        </div>
      ))}

      <SectionHeading>Dimension-level view</SectionHeading>
      <div className="space-y-3">
        {report.dimensions.insights.map((i, idx) => (
          <InsightRow key={idx} insight={i} />
        ))}
      </div>

      <SectionHeading>Discipleship bottleneck map</SectionHeading>
      <div className="space-y-3">
        {report.bottleneckMap.insights.map((i, idx) => (
          <InsightRow key={idx} insight={i} />
        ))}
      </div>

      <SectionHeading>Cross-cutting insights</SectionHeading>
      <div className="space-y-3">
        {report.crossCutting.insights.map((i, idx) => (
          <InsightRow key={idx} insight={i} />
        ))}
      </div>

      <SectionHeading>Suggested debrief questions</SectionHeading>
      <ol className="text-xs list-decimal list-inside space-y-1">
        {report.suggestedDebriefQuestions.map((q, idx) => (
          <li key={idx}>{q}</li>
        ))}
      </ol>

      {report.dataNotes.length > 0 && (
        <>
          <SectionHeading>Data notes & caveats</SectionHeading>
          <ul className="text-xs list-disc list-inside space-y-1 text-muted-foreground">
            {report.dataNotes.map((n, idx) => (
              <li key={idx}>{n}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
