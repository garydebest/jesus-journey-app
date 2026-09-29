import type { CohortReporting } from "@shared/cohortReporting";
import { PRIVACY_MESSAGE } from "@shared/shortForm";
import { projectCohortDemographics } from "@shared/demographicProjection";
import { DEMOGRAPHIC_PRIVACY_NOTE } from "@shared/demographicPolicy";

export function CohortReportView({ report }: { report: CohortReporting }) {
  report = projectCohortDemographics(report);
  return <div className="space-y-6" data-testid="cohort-report-view">
    <section className="rounded-lg border p-5 space-y-3">
      <h2 className="text-lg font-semibold">Your church survey results</h2>
      <p className="text-sm">{report.respondentCount === null ? PRIVACY_MESSAGE : `${report.respondentCount} completed responses`}</p>
      <p className="text-sm text-muted-foreground">{report.note}</p>
      {report.dataQualityNote && <p className="text-sm">{report.dataQualityNote}</p>}
    </section>
    {report.cohorts.map(cohort => <section className="rounded-lg border p-5 space-y-5" key={cohort.variant} data-testid={`cohort-${cohort.variant}`}>
      <h2 className="text-base font-semibold">{cohort.label}</h2>
      {cohort.suppressed ? <p className="text-sm text-muted-foreground">{PRIVACY_MESSAGE}</p> : <>
        <p className="text-sm text-muted-foreground">{cohort.respondentCount} respondents. Percentage answering 4 or 5.</p>
        {cohort.variant !== "full" && <p className="text-sm text-muted-foreground">Results cover 15 measured pathways. Single-item pathways reflect a narrower measure.</p>}
        {cohort.pathways.map(pathway => <div key={pathway.num} className="space-y-3 pt-4 border-t">
          <h3 className="text-sm font-semibold">Pathway {pathway.num}: {pathway.name}{pathway.measurement === "single_item" ? " (single item)" : ""}</h3>
          {pathway.items.map(item => <div key={item.code} className="grid grid-cols-[1fr_auto] gap-4 text-sm">
            <span>{item.text}</span><span className="tabular-nums font-semibold">{item.agreementPct}%</span>
          </div>)}
        </div>)}
      </>}
    </section>)}
    <section className="rounded-lg border p-5 space-y-5">
      <h2 className="text-base font-semibold">Combined journey and demographic profiles</h2>
      <p className="text-sm text-muted-foreground">{DEMOGRAPHIC_PRIVACY_NOTE}</p>
      {Object.entries(report.profiles).map(([label, distribution]) => <div key={label} className="space-y-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        {distribution.note && <p className="text-sm text-muted-foreground">{distribution.note}</p>}
        {distribution.suppressed ? <p className="text-sm text-muted-foreground">{PRIVACY_MESSAGE}</p> : distribution.values.map(row => <div key={row.label} className="flex justify-between gap-4 text-sm"><span>{row.label}</span><span>{row.count} ({row.pct}%)</span></div>)}
      </div>)}
    </section>
  </div>;
}
