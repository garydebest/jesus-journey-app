import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { churchApiRequest } from "@/lib/churchAuth";
import { SurveyPlanner, readableError } from "./SurveyPlanner";
import { defaultClosesAt } from "@shared/timeline";
import type { ResponseBreakdown, SurveyPlan } from "@shared/surveyAccess";

export interface WaveWithMeta {
  id: string; label: string; joinCode: string | null; status: string; paymentStatus?: string;
  minSampleSize: number; opensAt: string | null; closesAt: string | null; closedAt?: string | null;
  responseCount?: number;
  snapshot?: { respondentCount: number; summaryJson: string; reportPdfPath?: string | null; commentsReportPdfPath?: string | null } | null;
}
interface Props {
  token: string | null; waves: WaveWithMeta[]; isDemo?: boolean; loading: boolean;
  loadError: string | null; onRetryLoad: () => void;
  error: string | null; closeError: string | null; downloadError: string | null;
  closingId: string | null; downloadingId: string | null;
  onStartNew: (plan?: SurveyPlan) => void; onGoToPrepare: () => void; onClose: (id: string) => void;
  onDownloadReport: (wave: WaveWithMeta) => void; onDownloadCommentsReport?: (wave: WaveWithMeta) => void;
  onViewReport: (wave: WaveWithMeta) => void; onAbandonPending?: (id: string) => void; onDatesChanged?: () => void;
}
const ageLabels = ["16-19", "20-29", "30-39", "40-49", "50-59", "60 and older"];
const today = () => new Date().toLocaleDateString("en-CA");
const displayDate = (date?: string | null) => date ? new Date(date.slice(0, 10) + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Not set";

export function PanelYourSurveys(props: Props) {
  const { token, waves, loading, isDemo = false, onDatesChanged = () => {} } = props;
  const [demoMode, setDemoMode] = useState("live");
  const [demoDates, setDemoDates] = useState<SurveyPlan>({ opensAt: today(), closesAt: defaultClosesAt(today()), minSampleSize: 50, overrides: {} });
  const [breakdown, setBreakdown] = useState<ResponseBreakdown | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const closedWaves = waves.filter((w) => w.status === "closed")
    .sort((a, b) => (Date.parse(b.closedAt ?? "") || 0) - (Date.parse(a.closedAt ?? "") || 0));
  const latestReport = closedWaves.find((w) => w.snapshot);
  const earlierSurveys = closedWaves.filter((w) => w.id !== latestReport?.id);
  const purchased = waves.find((w) => w.paymentStatus === "paid" && w.status !== "closed") ?? null;
  const pending = waves.filter((w) => w.paymentStatus !== "paid" && w.status !== "closed");
  const demoCount = demoMode === "target" ? 25 : demoMode === "live" ? 18 : 0;
  const demoWave: WaveWithMeta = { id: "grace-practice", label: "Grace Fellowship practice survey", joinCode: "DEMO ONLY",
    status: demoMode === "planning" ? "not_started" : "live", paymentStatus: "paid",
    ...demoDates, responseCount: demoCount };
  const current = isDemo ? (["unpaid", "closed"].includes(demoMode) ? null : demoWave) : purchased;
  const active = !!current && ["live", "prep", "closing_soon"].includes(current.status);
  const count = isDemo ? demoCount : (breakdown?.total ?? current?.responseCount ?? 0);
  const total = current?.minSampleSize ?? 0;
  const target = Math.ceil(total / 2);
  const reached = !!current && active && count >= target;

  async function refreshCounts() {
    if (!current || isDemo) return;
    setRefreshing(true); setLocalError(null);
    try { setBreakdown(await (await churchApiRequest(token, "GET", `/api/waves/${current.id}/participation`)).json()); }
    catch (err) { setLocalError(readableError(err)); }
    finally { setRefreshing(false); }
  }
  useEffect(() => {
    setBreakdown(null);
    if (!current || isDemo) return;
    refreshCounts();
    const timer = setInterval(refreshCounts, 30000);
    return () => clearInterval(timer);
  }, [current?.id, current?.status, isDemo]);

  const demoBreakdown: ResponseBreakdown = {
    total: demoCount,
    gender: [{ label: "Male", count: demoCount === 25 ? 12 : demoCount === 18 ? 8 : 0 }, { label: "Female", count: demoCount === 25 ? 13 : demoCount === 18 ? 10 : 0 }],
    age: ageLabels.map((label, i) => ({ label, count: demoCount === 25 ? [2, 4, 5, 5, 4, 5][i] : demoCount === 18 ? [1, 3, 4, 3, 3, 4][i] : 0 })),
  };
  const groups = isDemo ? demoBreakdown : breakdown;
  const errors = [props.error, props.closeError, props.downloadError, localError].filter(Boolean);

  function reportButtons(wave: WaveWithMeta) {
    return <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => props.onViewReport(wave)} disabled={!wave.snapshot}>View report summary</Button>
      <Button size="sm" variant="outline" onClick={() => props.onDownloadReport(wave)} disabled={!wave.snapshot?.reportPdfPath || props.downloadingId === wave.id}>Church Report (PDF)</Button>
      <Button size="sm" variant="outline" onClick={() => props.onDownloadCommentsReport?.(wave)} disabled={!wave.snapshot?.commentsReportPdfPath || props.downloadingId === wave.id}>Comments Report (PDF)</Button>
      {props.downloadingId === wave.id && <span role="status" className="text-sm">Preparing download…</span>}
    </div>;
  }

  async function resumeCheckout(wave: WaveWithMeta) {
    setRefreshing(true); setLocalError(null);
    try {
      const data = await (await churchApiRequest(token, "GET", `/api/waves/${wave.id}/payment-status`)).json();
      if (data.wave?.paymentStatus === "paid") onDatesChanged();
      else if (data.checkoutUrl) window.location.href = data.checkoutUrl;
      else setLocalError("This checkout is no longer open. Use Purchase a new survey to begin a fresh checkout. The old unpaid entry cannot activate.");
    } catch (err) { setLocalError(readableError(err)); }
    finally { setRefreshing(false); }
  }

  return <div className="space-y-6">
    <section aria-labelledby="your-reports-title" className="space-y-3">
      <div><h1 id="your-reports-title" className="font-serif text-2xl font-semibold">Your Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your church account stays with you. Review past reports any time; purchase each new survey separately.</p></div>
      {props.loadError && <Alert variant="destructive" data-testid="survey-load-error"><AlertDescription className="space-y-3">
        <p>{props.loadError}</p>
        <Button variant="outline" size="sm" onClick={props.onRetryLoad} disabled={loading} data-testid="button-retry-surveys">Try again</Button>
      </AlertDescription></Alert>}
      {loading ? <p role="status">Loading your surveys…</p> : latestReport ? <Card><CardContent className="pt-5 space-y-3">
        <div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Latest completed survey</p><h2 className="mt-1 font-semibold">{latestReport.label}</h2></div><Badge variant="secondary">{isDemo ? "Sample report" : "Available anytime"}</Badge></div>
        {reportButtons(latestReport)}
      </CardContent></Card> : !props.loadError && <p className="rounded-lg border p-4 text-sm text-muted-foreground">Your reports will appear here after your first survey is completed.</p>}
    </section>

    <Card className="bg-muted/30"><CardHeader className="pb-2"><CardTitle className="text-base font-serif">Before you begin</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground leading-relaxed">Read the guiding materials in Prepare, Collect, Interpret, and Act before launching. You can try dates and explore an action plan below without purchasing or activating a survey.</p>
        <Button variant="ghost" className="px-0 underline underline-offset-4" onClick={props.onGoToPrepare}>Read the preparation guide</Button></CardContent></Card>
    {errors.map((error, i) => <Alert key={i} variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>)}

    <section aria-labelledby="present-survey-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="present-survey-title" className="font-serif text-xl font-semibold">Present Survey</h2>
        <Badge variant={active ? "default" : "secondary"}>{isDemo ? "Grace demo" : props.loadError ? "Temporarily unavailable" : loading ? "Loading" : current ? active ? "Live" : "Paid · awaiting confirmation" : "Planning only · purchase required"}</Badge></div>
      {isDemo && <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
        <p className="text-sm"><strong>Grace Fellowship demonstration.</strong> Try the different stages below. Dates, progress and closing are simulated for your visit; no real payments, responses or emails are created.</p>
        <div className="flex flex-wrap gap-2">{[["unpaid", "Before purchase"], ["planning", "Paid · plan dates"], ["live", "Live · 18 responses"], ["target", "50% reached"]].map(([value, label]) =>
          <Button key={value} size="sm" variant={demoMode === value ? "default" : "outline"} onClick={() => setDemoMode(value)} aria-pressed={demoMode === value}>{label}</Button>)}</div>
        {demoMode === "closed" && <p role="status" className="text-sm font-medium">Demo survey closed. Your saved sample reports are unchanged.</p>}
      </div>}
      {!isDemo && props.loadError && <p className="text-sm text-muted-foreground">Use “Try again” above to load your survey before managing it.</p>}
      {!loading && (isDemo || !props.loadError) && <Card><CardHeader className="pb-3"><CardTitle className="text-base font-serif">{current?.label ?? "Plan your next survey"}</CardTitle>
        <p className="text-sm text-muted-foreground">{active ? "Your code is accepting responses. The planned closing date is a guide; closing requires a deliberate action once 50% is reached." : current ? "Your purchase is ready. Review the proposed dates, then confirm to activate the code immediately." : "No new survey is activated. Your login and previous reports remain available."}</p>
      </CardHeader><CardContent className="space-y-6">
        <SurveyPlanner key={`${current?.id ?? "future"}-${isDemo ? demoMode : ""}`} token={token} wave={current ? { ...current, responseCount: count } : null} isDemo={isDemo}
          demoPlan={demoDates} onChanged={onDatesChanged} onPurchase={props.onStartNew} onDemoConfirmed={(plan) => { setDemoDates(plan); setDemoMode("live"); }} />
        {!current && <div className="border-t pt-5 space-y-4">
          <div><h3 className="text-sm font-semibold">Sample size target: 50%</h3><p className="mt-1 text-sm text-muted-foreground">Live progress and respondent breakdowns become available for your purchased survey. No responses are being collected now.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled>Respondent breakdown</Button><Button disabled>Close survey &amp; generate reports</Button></div>
          <div className="border-t pt-4 space-y-2"><h3 className="text-sm font-semibold">Reports for your next survey</h3><div className="flex flex-wrap gap-2"><Button size="sm" disabled>Report summary</Button><Button size="sm" variant="outline" disabled>Church Report (PDF)</Button><Button size="sm" variant="outline" disabled>Comments Report (PDF)</Button></div><p className="text-xs text-muted-foreground">A purchase and confirmed start date are required for a new survey. Existing reports below remain available.</p></div>
        </div>}
        {current && <div className="border-t pt-5 space-y-5">
          <div className="rounded-lg bg-muted/30 p-4 flex flex-wrap justify-between items-center gap-3">
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{active ? "This survey's join code" : "Reserved survey code · not active yet"}</p><p className="font-mono text-xl tracking-widest mt-1">{current.joinCode}</p></div>
            <Button variant="outline" disabled={!active || isDemo} onClick={async () => {
              try { await navigator.clipboard.writeText(current.joinCode ?? ""); setCopied(true); } catch { setLocalError("Copy the code shown here manually."); }
            }}>{copied ? "Copied" : "Copy code"}</Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><p className="text-2xl font-semibold tabular-nums">{count}</p><p className="text-xs text-muted-foreground">Responses</p></div>
            <div><p className="text-2xl font-semibold tabular-nums">{target}</p><p className="text-xs text-muted-foreground">50% target of {total}</p></div>
            <div><p className="text-2xl font-semibold tabular-nums">{Math.round(count / Math.max(1, total) * 100)}%</p><p className="text-xs text-muted-foreground">Of all attendees aged 16+</p></div>
          </div>
          <Progress value={Math.min(100, count / Math.max(1, target) * 100)} aria-label="Progress toward the 50% response target" />
          <p className="text-sm text-muted-foreground">{reached ? "The 50% minimum is reached. You can close when ready, or keep collecting." : `${Math.max(0, target - count)} more responses needed to reach the 50% minimum.`} {isDemo ? "All figures here are simulated." : "Counts refresh every 30 seconds."}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowGroups(!showGroups)} aria-expanded={showGroups} data-testid="button-demographics">Respondent breakdown</Button>
            {!isDemo && <Button variant="outline" onClick={refreshCounts} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh progress"}</Button>}
            <Button disabled={!reached || !!props.closingId} onClick={() => setCloseOpen(true)} data-testid="button-close-survey">Close survey & generate reports</Button>
          </div>
          {showGroups && <div className="rounded-lg border p-4 space-y-4" data-testid="respondent-breakdown">
            <p className="text-sm text-muted-foreground">Breakdown of respondents only, not participation rates within church groups. No individual answers or identities are shown.</p>
            {!groups ? <p role="status">Loading breakdown…</p> : <div className="grid sm:grid-cols-2 gap-6">{[["Gender", ["Male", "Female"], groups.gender], ["Age", ageLabels, groups.age]].map(([heading, labels, rows]: any) =>
              <div key={heading}><h3 className="text-sm font-semibold mb-2">{heading}</h3>
                {[...labels, ...rows.map((r: any) => r.label).filter((label: string) => !labels.includes(label))].map((label: string) => {
                  const n = rows.find((r: any) => r.label === label)?.count ?? 0;
                  return <div key={label} className="flex justify-between gap-2 py-1 text-sm"><span>{label}</span><span className="tabular-nums">{n} · {Math.round(n / Math.max(1, groups.total) * 100)}%</span></div>;
                })}
              </div>)}</div>}
          </div>}
          <div className="border-t pt-4 space-y-2"><h3 className="text-sm font-semibold">Reports for this survey</h3>
            <div className="flex flex-wrap gap-2"><Button size="sm" disabled>Report summary</Button><Button size="sm" variant="outline" disabled>Church Report (PDF)</Button><Button size="sm" variant="outline" disabled>Comments Report (PDF)</Button></div>
            <p className="text-xs text-muted-foreground">Available after closing and successful report generation. The latest completed report appears in Your Reports; older surveys appear in Earlier Surveys.</p>
          </div>
        </div>}
      </CardContent></Card>}
      {!isDemo && pending.length > 0 && <details className="rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">Unfinished checkouts ({pending.length})</summary>
        <p className="mt-2 text-sm text-muted-foreground">These are not active surveys. No participant code is available until payment is confirmed.</p>
        {pending.map((w) => <div key={w.id} className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-sm">{w.label}</span><Button size="sm" variant="outline" disabled={refreshing} onClick={() => resumeCheckout(w)}>Check payment / resume checkout</Button></div>)}
      </details>}
    </section>

    {earlierSurveys.length > 0 && <section aria-labelledby="earlier-surveys-title" className="space-y-3"><h2 id="earlier-surveys-title" className="font-serif text-xl font-semibold">Earlier Surveys</h2>
      <p className="text-sm text-muted-foreground">Surveys before the report featured above, newest first. No new payment is needed to review them.</p>
      {props.loadError && <p className="text-sm text-muted-foreground">Survey history could not be refreshed. Use “Try again” above.</p>}
      {earlierSurveys.map((wave) => <Card key={wave.id} data-testid={`card-history-${wave.id}`}><CardContent className="pt-5 space-y-3">
        <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{wave.label}</h3><p className="text-xs text-muted-foreground mt-1">Closed {displayDate(wave.closedAt)} · {wave.snapshot?.respondentCount ?? 0} responses</p></div><Badge variant="secondary">Completed</Badge></div>
        {reportButtons(wave)}
      </CardContent></Card>)}
    </section>}
    <Dialog open={closeOpen} onOpenChange={setCloseOpen}><DialogContent>
      <DialogHeader><DialogTitle>Close this survey?</DialogTitle><DialogDescription>{isDemo ? "This only demonstrates closing. No shared data will change." : "This stops new responses and generates the reports. After successful processing, raw responses are deleted for privacy. This survey cannot be reopened."}</DialogDescription></DialogHeader>
      <p className="text-sm">{count} responses received; {target} required. The planned closing date is {displayDate(current?.closesAt)}.</p>
      <DialogFooter><Button variant="outline" onClick={() => setCloseOpen(false)}>Keep collecting</Button><Button disabled={!reached || !!props.closingId} onClick={() => {
        if (isDemo) setDemoMode("closed"); else if (current) props.onClose(current.id);
        setCloseOpen(false);
      }} data-testid="button-close-final">Confirm closing</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
