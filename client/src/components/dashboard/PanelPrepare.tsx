import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PREPARE_CARDS } from "@/lib/dashboardContent";
import { InfoCardView } from "./InfoCardView";
import { BookingButton } from "@/lib/booking";
import { JOURNEY_RESOURCES, PREPARE_CHECKLIST } from "@/lib/journeyResources";
import { ResourceLinks, Checklist } from "@/components/journey/ResourceLinks";
import type { ChurchAccount } from "@/lib/churchAuth";
import type { WaveWithMeta } from "./PanelYourSurveys";

const longDate = (d?: string | null) => d ? new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "";

export function PanelPrepare({ church, currentWave, isDemo = false, onOpenSettings }: {
  church?: ChurchAccount | null; currentWave?: WaveWithMeta | null; isDemo?: boolean; onOpenSettings?: () => void;
} = {}) {
  const active = !!currentWave && ["live", "prep", "closing_soon"].includes(currentWave.status);
  const oriented = !!currentWave?.orientationCompletedAt || active;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Prepare</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Getting ready for the Jesus Journey Survey — the steps that make everything after this easier.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-3" aria-labelledby="orientation-heading" data-testid="prepare-orientation">
          <h2 id="orientation-heading" className="font-serif text-lg font-semibold">Required: Survey Orientation</h2>
          {!currentWave ? (
            <p className="text-sm text-muted-foreground leading-relaxed">After you purchase a survey, book your Jesus Journey Survey Orientation. In this conversation we help you confirm a practical timeline, prepare your leaders, confirm the adults age 16 and over you will invite, plan broad participation, and explain reports and the results debrief. Your participant code activates only after the orientation is complete.</p>
          ) : oriented ? (
            <p className="text-sm flex items-start gap-2" role="status"><CheckCircle2 className="h-5 w-5 text-primary shrink-0" aria-hidden="true" /> Your orientation is complete. {active ? "Your survey is active." : "Review your action plan and activate your survey when you are ready."}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">Please complete your required Jesus Journey Survey Orientation before activating your participant code. Booking does not activate the code; your facilitator marks the orientation complete after your call.</p>
              {currentWave.orientationBookedAt && <p className="text-sm font-medium" role="status">Booked for {longDate(currentWave.orientationBookedAt)}.</p>}
              <BookingButton kind="orientation" disabled={isDemo} />
            </>
          )}
          <div className="pt-1 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Before the call</p>
            <ResourceLinks items={[JOURNEY_RESOURCES.orientationWorksheet]} />
          </div>
        </section>
        <section className="rounded-lg border p-5 space-y-3" aria-labelledby="coordinator-heading" data-testid="prepare-coordinator">
          <h2 id="coordinator-heading" className="font-serif text-lg font-semibold">Your Survey Coordinator</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">The Survey Coordinator is your day-to-day survey lead. They receive preparation, launch, participation and closing emails, with the primary contact copied. Name your coordinator before your orientation is completed.</p>
          {church?.surveyCoordinatorEmail ? (
            <p className="text-sm"><strong>{church.surveyCoordinatorName || "Coordinator"}</strong> · {church.surveyCoordinatorEmail}</p>
          ) : (
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No Survey Coordinator has been named yet.</p>
          )}
          <Button variant="outline" size="sm" onClick={onOpenSettings} disabled={isDemo || !onOpenSettings} data-testid="button-edit-coordinator">
            {church?.surveyCoordinatorEmail ? "Update contacts" : "Add Survey Coordinator"}
          </Button>
          <div className="pt-1"><ResourceLinks items={[JOURNEY_RESOURCES.coordinatorGuide, JOURNEY_RESOURCES.leadershipBriefing]} /></div>
        </section>
      </div>
      <section className="rounded-lg border p-5 space-y-3" aria-labelledby="prepare-checklist-heading" data-testid="prepare-checklist">
        <h2 id="prepare-checklist-heading" className="font-serif text-lg font-semibold">Ready to launch? Prepare checklist</h2>
        <p className="text-sm text-muted-foreground">Before you activate your survey, confirm:</p>
        <Checklist id="prepare-check" items={PREPARE_CHECKLIST} label="Prepare checklist" />
        <ResourceLinks items={[JOURNEY_RESOURCES.readinessChecklist]} />
      </section>
      <section
        className="rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-3"
        aria-labelledby="coordinator-privacy-heading"
        data-testid="coordinator-privacy-note"
      >
        <h2 id="coordinator-privacy-heading" className="font-serif text-lg font-semibold">
          Demographics and privacy
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Before inviting participants, explain how demographic answers are handled:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
          <li>
            Each church survey demographic question requires a selection. Participants may choose
            “Prefer not to say” for gender, relationship status, and ethnic or cultural background.
          </li>
          <li>
            Demographic answers are used only in aggregate church reporting. Categories with fewer
            than 10 respondents are not shown in demographic reports or written insights. Additional
            results may be withheld to protect small groups; missing answers and “Prefer not to say”
            are not comparison groups.
          </li>
          <li>
            Respect each person’s choices. When helping with paper responses, never guess a missing
            answer or choose “Prefer not to say” on someone’s behalf. Do not try to identify people
            in withheld groups.
          </li>
        </ul>
        <a
          href="#/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          data-testid="link-coordinator-privacy"
        >
          Read the survey privacy notice (opens in a new tab)
        </a>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {PREPARE_CARDS.map((card) => (
          <InfoCardView key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}
