import { useEffect, useState } from "react";
import { CalendarDays, LockKeyhole, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { churchApiRequest } from "@/lib/churchAuth";
import { computeTimelineDates, defaultClosesAt } from "@shared/timeline";
import { calendarDate, emptySurveyPlan, surveyPlanSchema, type SurveyPlan } from "@shared/surveyAccess";
import type { WaveWithMeta } from "./PanelYourSurveys";

export function readableError(error: unknown) {
  const text = String((error as Error)?.message ?? error).replace(/^\d+:\s*/, "");
  try { return JSON.parse(text).message ?? text; } catch { return text; }
}

export function SurveyPlanner({ token, wave, isDemo = false, demoPlan, onChanged, onPurchase, onDemoConfirmed }: {
  token: string | null;
  wave: WaveWithMeta | null;
  isDemo?: boolean;
  demoPlan?: SurveyPlan;
  onChanged: () => void;
  onPurchase: (plan: SurveyPlan) => void;
  onDemoConfirmed?: (plan: SurveyPlan) => void;
}) {
  const [plan, setPlan] = useState<SurveyPlan>(emptySurveyPlan);
  const [baseline, setBaseline] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const paid = wave?.paymentStatus === "paid";
  const active = paid && ["live", "prep", "closing_soon"].includes(wave?.status ?? "");
  const dirty = JSON.stringify(plan) !== baseline;
  const valid = surveyPlanSchema.safeParse(plan).success && !!plan.opensAt && !!plan.closesAt;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null); setNotice(null);
      try {
        let next = emptySurveyPlan();
        if (isDemo) {
          next = { ...next, ...demoPlan, minSampleSize: 50, opensAt: wave?.opensAt ?? demoPlan?.opensAt ?? "", closesAt: wave?.closesAt ?? demoPlan?.closesAt ?? "" };
        } else if (active && wave) {
          const data = await (await churchApiRequest(token, "GET", `/api/waves/${wave.id}/timeline`)).json();
          next = {
            opensAt: wave.opensAt ?? "", closesAt: wave.closesAt ?? "", minSampleSize: wave.minSampleSize,
            overrides: Object.fromEntries(data.phases.filter((p: any) => p.isAdjusted && !["full_launch", "survey_closes"].includes(p.key)).map((p: any) => [p.key, p.date])),
          };
        } else {
          const data = await (await churchApiRequest(token, "GET", "/api/churches/plan")).json();
          next = data.plan;
          if (wave) next = { ...next, minSampleSize: wave.minSampleSize, opensAt: next.opensAt || wave.opensAt || "", closesAt: next.closesAt || wave.closesAt || "" };
        }
        if (!cancelled) { setPlan(next); setBaseline(JSON.stringify(next)); }
      } catch (err) { if (!cancelled) setError(readableError(err)); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [token, wave?.id, wave?.status, wave?.opensAt, wave?.closesAt, isDemo]);

  function update(patch: Partial<SurveyPlan>) {
    setPlan((old) => ({ ...old, ...patch })); setNotice(null); setError(null);
  }

  async function saveDraft(andPurchase = false) {
    const parsed = surveyPlanSchema.safeParse(plan);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true); setError(null);
    try {
      if (!isDemo) await churchApiRequest(token, "PUT", "/api/churches/plan", parsed.data);
      setBaseline(JSON.stringify(parsed.data));
      setNotice(isDemo ? "Practice plan saved for this visit only." : "Provisional plan saved. No survey has been activated.");
      if (andPurchase) onPurchase(parsed.data);
    } catch (err) { setError(readableError(err)); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!wave || !paid || !valid) return;
    setBusy(true); setError(null);
    try {
      if (isDemo) onDemoConfirmed?.(plan);
      else await churchApiRequest(token, "POST", `/api/waves/${wave.id}/confirm-plan`, plan);
      setBaseline(JSON.stringify(plan)); setConfirmOpen(false);
      setNotice(isDemo ? "Practice confirmation complete. No real survey was activated." : "Plan confirmed. Your survey code accepts responses immediately.");
      if (!isDemo) onChanged();
    } catch (err) { setError(readableError(err)); setConfirmOpen(false); }
    finally { setBusy(false); }
  }

  async function download() {
    setError(null);
    try {
      let blob: Blob;
      if (isDemo) {
        const events = phases.filter((p) => p.date).map((p) => {
          const end = new Date(p.date! + "T12:00:00Z"); end.setUTCDate(end.getUTCDate() + 1);
          return `BEGIN:VEVENT\r\nUID:grace-demo-${p.key}@jesusjourney.life\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z\r\nDTSTART;VALUE=DATE:${p.date!.replace(/-/g, "")}\r\nDTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, "")}\r\nSUMMARY:DEMO - ${p.title.replace(/[,;]/g, " ")}\r\nEND:VEVENT`;
        });
        blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Jesus Journey//Demo Plan//EN\r\n${events.join("\r\n")}\r\nEND:VCALENDAR\r\n`], { type: "text/calendar" });
      } else {
        blob = await (await churchApiRequest(token, "GET", `/api/waves/${wave!.id}/timeline.ics`)).blob();
      }
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = isDemo ? "Grace-DEMO-action-plan.ics" : "Survey-action-plan.ics";
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(readableError(err)); }
  }

  const phases = computeTimelineDates(calendarDate.safeParse(plan.opensAt).success ? plan.opensAt : null, calendarDate.safeParse(plan.closesAt).success ? plan.closesAt : null)
    .map((phase) => ({ ...phase, date: plan.overrides[phase.key] ?? phase.date }));

  if (loading) return <p className="text-sm text-muted-foreground" role="status">Loading your action plan…</p>;
  return (
    <section className="space-y-4" aria-label="Survey planning">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="plan-start">Provisional start date</Label>
          <Input id="plan-start" type="date" value={plan.opensAt} onChange={(e) => update({
            opensAt: e.target.value, closesAt: calendarDate.safeParse(e.target.value).success ? defaultClosesAt(e.target.value) : "",
          })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-close">Planned closing date</Label>
          <Input id="plan-close" type="date" value={plan.closesAt} min={plan.opensAt || undefined} onChange={(e) => update({ closesAt: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-adults">Total attendees aged 16+</Label>
          <Input id="plan-adults" type="number" min={16} max={1000000} value={plan.minSampleSize || ""}
            disabled={isDemo || (!!wave && (wave.responseCount ?? 0) > 0)}
            onChange={(e) => update({ minSampleSize: Number(e.target.value) })} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Changing the start date proposes a new two-week collection period. Individual adjustments stay as you set them.
        The adult total is locked after the first response; the closing action unlocks at 50%.
        {isDemo && " This demonstration uses 50 attendees."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} data-testid="button-action-plan">
          <CalendarDays className="mr-2 h-4 w-4" /> {expanded ? "Hide Survey Action Plan" : "Survey Action Plan"}
        </Button>
        {!active && <Button variant="outline" disabled={busy} onClick={() => saveDraft()} data-testid="button-save-draft">Save provisional plan</Button>}
        <Button disabled={!paid || !valid || busy || (!!active && !dirty)} onClick={() => setConfirmOpen(true)} data-testid="button-confirm-plan">
          {paid ? <Check className="mr-2 h-4 w-4" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
          {active ? "Confirm date changes" : "Confirm start date & activate"}
        </Button>
        <Button variant="outline" disabled={!active || dirty || !valid || busy} onClick={download} data-testid="button-download-ics">
          <Download className="mr-2 h-4 w-4" /> Add dates to calendar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">The calendar button downloads an .ics file for Apple Calendar, Google Calendar or Outlook. Import the file into your calendar; later changes are not synced automatically.</p>
      {!paid && (
        <div className="rounded-lg bg-muted/40 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm max-w-xl">Planning is free. A new purchase unlocks confirmation and a new survey code; your existing reports and login stay unchanged.</p>
          <Button disabled={busy || isDemo} onClick={() => saveDraft(true)} data-testid="button-start-new-survey">
            {isDemo ? "Purchase disabled in demo" : "Purchase a new survey"}
          </Button>
        </div>
      )}
      {dirty && active && <p className="text-sm text-amber-800" role="status">These proposed changes are not active yet. Confirm them before exporting an updated calendar.</p>}
      {notice && <p className="text-sm text-primary" role="status">{notice}</p>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {expanded && (
        <div className="space-y-3" data-testid="plan-phases">
          <p className="text-sm text-muted-foreground">Explore all 14 steps. Adjust any step below; launch and closing follow the two dates above. A past date does not mean a task is complete.</p>
          {phases.map((phase) => (
            <div key={phase.key} className="rounded-lg border p-4 flex flex-col sm:flex-row gap-3 sm:items-start">
              <span className="rounded-full bg-primary/10 text-primary w-7 h-7 shrink-0 flex items-center justify-center text-xs font-semibold">{phase.order}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">{phase.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{phase.summary}</p>
              </div>
              <div className="space-y-1 sm:w-44 shrink-0">
                <Label className="sr-only" htmlFor={`phase-${phase.key}`}>{phase.title} date</Label>
                <Input id={`phase-${phase.key}`} type="date" value={phase.date ?? ""}
                  disabled={["full_launch", "survey_closes"].includes(phase.key)}
                  onChange={(e) => {
                    const overrides = { ...plan.overrides };
                    if (e.target.value) overrides[phase.key] = e.target.value; else delete overrides[phase.key];
                    update({ overrides });
                  }} />
                {plan.overrides[phase.key] && <button type="button" className="text-xs underline text-primary" onClick={() => {
                  const overrides = { ...plan.overrides }; delete overrides[phase.key]; update({ overrides });
                }}>Reset to suggested date</button>}
                {!phase.date && <p className="text-xs text-muted-foreground">{Math.abs(phase.offsetDays)} days {phase.offsetDays < 0 ? "before" : "after"} {phase.anchor === "opens" ? "start" : "closing"}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{active ? "Confirm your updated plan?" : "Confirm and activate this survey?"}</DialogTitle>
            <DialogDescription>{isDemo ? "This is a simulation. Nothing will change for other demo visitors." : "The code will accept responses immediately, even if your planned public start date is later. Dates do not close the survey automatically."}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">Start: {plan.opensAt} · Planned close: {plan.closesAt}<br />50% target: {Math.ceil(plan.minSampleSize / 2)} of {plan.minSampleSize} attendees aged 16+.</p>
          <DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Keep planning</Button><Button disabled={busy} onClick={confirm} data-testid="button-activate-final">{busy ? "Confirming…" : isDemo ? "Confirm demo plan" : "Confirm plan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
