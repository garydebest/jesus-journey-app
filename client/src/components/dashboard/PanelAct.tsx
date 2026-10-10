import { ACT_STEPS } from "@/lib/dashboardContent";
import { FullDoc } from "./FullDoc";
import { FULL_DOCS } from "@/lib/reportGuidance";
import type { WaveWithMeta } from "./PanelYourSurveys";
import { BookingButton } from "@/lib/booking";
import { GrowthPlanCard } from "@/components/journey/GrowthPlanCard";

export function PanelAct({ latestReport = null, isDemo = false, token = null }: { latestReport?: WaveWithMeta | null; isDemo?: boolean; token?: string | null } = {}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Act</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fostering positive change after the survey — from a first read of the report to a strategic plan.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-3" aria-labelledby="act-debrief-heading" data-testid="act-debrief">
          <h2 id="act-debrief-heading" className="font-serif text-lg font-semibold">Begin with your results debrief</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Your survey purchase includes a facilitated results debrief with your leadership team. We help you understand the major themes, celebrate strengths, explore growth opportunities with care, and identify appropriate next steps before you plan wider action.</p>
          {latestReport?.debriefCompletedAt ? <p className="text-sm font-medium" role="status">Your results debrief is complete.</p>
            : latestReport?.debriefBookedAt ? <p className="text-sm font-medium" role="status">Your results debrief is booked.</p>
            : latestReport ? <BookingButton kind="debrief" disabled={isDemo} waveId={latestReport?.id} />
            : <p className="text-sm text-muted-foreground">Booking opens when your reports are ready.</p>}
        </section>
        <GrowthPlanCard isDemo={isDemo} token={token} hasReports={!!latestReport} />
      </div>
      <ol className="space-y-6">
        {ACT_STEPS.map((step) => (
          <li key={step.number} className="flex gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-base font-semibold text-primary-foreground">
              {step.number}
            </div>
            <div className="flex-1 space-y-2 border-b pb-6 last:border-b-0 last:pb-0">
              <h2 className="font-serif text-lg font-semibold">{step.title}</h2>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{step.meta}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              <FullDoc doc={FULL_DOCS[step.fullDocIndex]} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
