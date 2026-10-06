import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingButton } from "@/lib/booking";

export type JourneyState =
  | "plan"
  | "purchased"
  | "ready_to_activate"
  | "collecting"
  | "target_reached"
  | "results_ready"
  | "debrief_complete";

export interface JourneyWave {
  status: string;
  paymentStatus?: string;
  orientationBookedAt?: string | null;
  orientationCompletedAt?: string | null;
  debriefBookedAt?: string | null;
  debriefCompletedAt?: string | null;
}

export function deriveJourneyState(args: { current: JourneyWave | null; active: boolean; reached: boolean; latestReport: JourneyWave | null }): JourneyState {
  const { current, active, reached, latestReport } = args;
  if (current) {
    if (active) return reached ? "target_reached" : "collecting";
    return current.orientationCompletedAt ? "ready_to_activate" : "purchased";
  }
  if (latestReport) return latestReport.debriefCompletedAt ? "debrief_complete" : "results_ready";
  return "plan";
}

const COPY: Record<JourneyState, { heading: string; body: string }> = {
  plan: {
    heading: "Plan your church survey",
    body: "Choose a provisional survey window and estimate the number of adults age 16 and over in your congregation. You can save your plan before purchasing. When you are ready, purchase your survey to reserve a participant code.",
  },
  purchased: {
    heading: "Your survey has been purchased",
    body: "Your participant code has been reserved. Before opening the survey, book your Jesus Journey Survey Orientation. We will help you confirm your timeline, prepare your leaders, and plan a strong invitation to your congregation. Your participant code cannot be activated until your required orientation is complete.",
  },
  ready_to_activate: {
    heading: "You are ready to activate your survey",
    body: "Review your action plan one final time. When you confirm the plan, your participant code begins accepting responses immediately—even if your planned public launch date is later.",
  },
  collecting: {
    heading: "Your survey is collecting responses",
    body: "Invite broad participation, make the survey easy to access, and monitor progress regularly. Your goal is responses from at least 50% of your total adults age 16 and over.",
  },
  target_reached: {
    heading: "Your response target has been reached",
    body: "You have reached the minimum response level required to close. Before closing, ensure your congregation has had adequate opportunity to respond and that your leaders are ready to receive the results.",
  },
  results_ready: {
    heading: "Your church’s results are ready",
    body: "Your reports are available. The next step is a guided results debrief with your leadership team. Book your debrief after key participants have had time to review the reports.",
  },
  debrief_complete: {
    heading: "Continue the conversation",
    body: "Your results have given your church important insight. Use the resources below to share appropriate findings, continue listening, and consider your next steps.",
  },
};

const displayDate = (d?: string | null) => d ? new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "";

export function NextStepPanel({ state, current, latestReport, isDemo, onNavigate }: {
  state: JourneyState;
  current: JourneyWave | null;
  latestReport: JourneyWave | null;
  isDemo: boolean;
  onNavigate: (tab: string, anchorId?: string) => void;
}) {
  const copy = COPY[state];
  const go = (label: string, tab: string, anchor?: string, testId?: string, variant: "default" | "outline" = "default") => (
    <Button variant={variant} onClick={() => onNavigate(tab, anchor)} data-testid={testId}>
      {label}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
    </Button>
  );
  return (
    <section aria-labelledby="next-step-heading" className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-3" data-testid="next-step-panel" data-state={state}>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Your next step</p>
      <h2 id="next-step-heading" className="font-serif text-xl font-semibold">{copy.heading}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{copy.body}</p>
      {state === "purchased" && current?.orientationBookedAt && (
        <p className="text-sm font-medium" role="status">Your orientation is booked for {displayDate(current.orientationBookedAt)}. Use the Prepare section to choose a Survey Coordinator, brief key leaders, and prepare your communications.</p>
      )}
      {state === "results_ready" && latestReport?.debriefBookedAt && (
        <p className="text-sm font-medium" role="status">Your results debrief is booked for {displayDate(latestReport.debriefBookedAt)}. Ask participants to read the reports beforehand.</p>
      )}
      <div className="flex flex-wrap items-start gap-2 pt-1">
        {state === "plan" && go("Start planning", "your-surveys", "present-survey-title", "button-next-start-planning")}
        {state === "purchased" && <>
          {!current?.orientationBookedAt && <BookingButton kind="orientation" disabled={isDemo} />}
          {go("Go to Prepare", "prepare", undefined, "button-next-prepare", current?.orientationBookedAt ? "default" : "outline")}
        </>}
        {state === "ready_to_activate" && go("Confirm and activate", "your-surveys", "present-survey-title", "button-next-activate")}
        {state === "collecting" && go("Monitor participation", "your-surveys", "survey-progress", "button-next-monitor")}
        {state === "target_reached" && go("Review closing checklist", "collect", "closing-checklist", "button-next-closing-checklist")}
        {state === "results_ready" && <>
          {!latestReport?.debriefBookedAt && <BookingButton kind="debrief" disabled={isDemo} />}
          {go("Prepare for your debrief", "interpret", "debrief-preparation", "button-next-debrief-prep", "outline")}
        </>}
        {state === "debrief_complete" && go("View next-step resources", "act", undefined, "button-next-resources")}
      </div>
    </section>
  );
}
