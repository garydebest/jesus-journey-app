import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INTERPRET_CARDS, INTERPRET_CALLOUT } from "@/lib/dashboardContent";
import { InfoCardView } from "./InfoCardView";
import { BookingButton } from "@/lib/booking";
import { JOURNEY_RESOURCES, DEBRIEF_PREP_STEPS } from "@/lib/journeyResources";
import { ResourceLinks } from "@/components/journey/ResourceLinks";
import type { WaveWithMeta } from "./PanelYourSurveys";

export function PanelInterpret({ latestReport = null, isDemo = false }: { latestReport?: WaveWithMeta | null; isDemo?: boolean } = {}) {
  const needsBooking = !!latestReport && !latestReport.debriefBookedAt && !latestReport.debriefCompletedAt;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Interpret</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Understand your two reports — the Church Report's numbers, and the Comments Report's words.
        </p>
      </div>
      <section id="debrief-preparation" tabIndex={-1} className="rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-3 scroll-mt-24 focus:outline-none" aria-labelledby="debrief-prep-heading" data-testid="interpret-debrief">
        <h2 id="debrief-prep-heading" className="font-serif text-lg font-semibold">Your facilitated results debrief</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">After your survey closes and your reports are ready, we meet with your leadership team to understand the major themes, celebrate important strengths, explore growth opportunities with care, and identify appropriate next steps. It is not a performance review of individuals, ministries, or demographic groups.</p>
        <p className="text-sm font-medium">Before the meeting, ask participants to:</p>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">{DEBRIEF_PREP_STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
        <div className="flex flex-wrap items-start gap-2">
          {needsBooking && <BookingButton kind="debrief" disabled={isDemo} />}
          {latestReport?.debriefBookedAt && !latestReport.debriefCompletedAt && <p className="text-sm font-medium" role="status">Your debrief is booked for {new Date(latestReport.debriefBookedAt + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.</p>}
          {!latestReport && <p className="text-sm text-muted-foreground">Booking opens when your reports are ready.</p>}
        </div>
        <ResourceLinks items={[JOURNEY_RESOURCES.debriefPrep]} />
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {INTERPRET_CARDS.map((card) => (
          <InfoCardView key={card.title} card={card} />
        ))}
      </div>
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-serif">{INTERPRET_CALLOUT.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{INTERPRET_CALLOUT.body}</p>
        </CardContent>
      </Card>
    </div>
  );
}
