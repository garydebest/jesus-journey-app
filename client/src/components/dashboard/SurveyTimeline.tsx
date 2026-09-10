import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarDays, Download, Pencil, Check, X, RotateCcw } from "lucide-react";
import { churchApiRequest } from "@/lib/churchAuth";

interface TimelinePhase {
  key: string;
  order: number;
  anchor: "opens" | "closes";
  offsetDays: number;
  title: string;
  summary: string;
  sourceDoc: string;
  date: string | null;
  calculatedDate: string | null;
  isAdjusted: boolean;
}

interface Props {
  token: string | null;
  waveId: string;
  opensAt: string | null;
  closesAt: string | null;
  waveStatus: string;
  onDatesChanged: () => void;
}

function fmtLong(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function offsetLabel(offsetDays: number, anchor: "opens" | "closes") {
  const anchorWord = anchor === "opens" ? "start date" : "end date";
  if (offsetDays === 0) return `On your ${anchorWord}`;
  const abs = Math.abs(offsetDays);
  const unit =
    abs % 7 === 0 && abs >= 7 ? `${abs / 7} week${abs / 7 === 1 ? "" : "s"}` : `${abs} day${abs === 1 ? "" : "s"}`;
  return offsetDays < 0 ? `${unit} before your ${anchorWord}` : `${unit} after your ${anchorWord}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function SurveyTimeline({ token, waveId, opensAt, closesAt, waveStatus, onDatesChanged }: Props) {
  const [phases, setPhases] = useState<TimelinePhase[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [startInput, setStartInput] = useState(opensAt ?? "");
  const [savingStart, setSavingStart] = useState(false);

  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extendInput, setExtendInput] = useState(closesAt ?? "");
  const [savingExtend, setSavingExtend] = useState(false);

  const [nudgingKey, setNudgingKey] = useState<string | null>(null);
  const [nudgeInput, setNudgeInput] = useState("");
  const [savingNudge, setSavingNudge] = useState(false);

  const closed = waveStatus === "closed";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await churchApiRequest(token, "GET", `/api/waves/${waveId}/timeline`);
      const json = await res.json();
      setPhases(json.phases);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waveId]);

  async function saveStartDate() {
    if (!startInput) return;
    setSavingStart(true);
    setError(null);
    try {
      await churchApiRequest(token, "PATCH", `/api/waves/${waveId}/dates`, { opensAt: startInput });
      setStartDialogOpen(false);
      onDatesChanged();
      await load();
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setSavingStart(false);
    }
  }

  async function saveExtend() {
    if (!extendInput) return;
    setSavingExtend(true);
    setError(null);
    try {
      await churchApiRequest(token, "PATCH", `/api/waves/${waveId}/extend-close`, { closesAt: extendInput });
      setExtendDialogOpen(false);
      onDatesChanged();
      await load();
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setSavingExtend(false);
    }
  }

  async function saveNudge(phaseKey: string, date: string | null) {
    setSavingNudge(true);
    setError(null);
    try {
      await churchApiRequest(token, "PATCH", `/api/waves/${waveId}/timeline/${phaseKey}`, { date });
      setNudgingKey(null);
      await load();
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setSavingNudge(false);
    }
  }

  function downloadUrl(phaseKey?: string) {
    const base = `/api/waves/${waveId}/timeline.ics`;
    return phaseKey ? `${base}?phase=${phaseKey}` : base;
  }

  async function downloadIcs(phaseKey?: string) {
    try {
      const res = await churchApiRequest(token, "GET", downloadUrl(phaseKey));
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = phaseKey ? `${phaseKey}.ics` : "action-plan.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    }
  }

  const hasStartDate = !!opensAt;

  return (
    <Card data-testid="card-survey-timeline">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-primary"><CalendarDays className="h-5 w-5" /></span>
            <CardTitle className="text-base font-serif">Survey action plan</CardTitle>
          </div>
          {!loading && phases && (
            <div className="flex flex-wrap gap-2">
              {!closed && (
                <Button size="sm" variant="outline" onClick={() => { setStartInput(opensAt ?? todayIso()); setStartDialogOpen(true); }} data-testid="button-set-start-date">
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  {hasStartDate ? "Revise start date" : "Set start date"}
                </Button>
              )}
              {!closed && hasStartDate && (
                <Button size="sm" variant="outline" onClick={() => { setExtendInput(closesAt ?? ""); setExtendDialogOpen(true); }} data-testid="button-extend-close-date">
                  Extend end date
                </Button>
              )}
              {hasStartDate && (
                <Button size="sm" variant="outline" onClick={() => downloadIcs()} data-testid="button-download-ics">
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download plan (.ics)
                </Button>
              )}
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed pt-1">
          {hasStartDate
            ? "The full 14-step plan for this survey, calculated from your start and end dates. Every date can be nudged if your church's schedule needs it."
            : "This is what your survey timeline will look like, shown as time relative to your start date. Set a start date to generate real calendar dates for every step."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading plan...</p>
        ) : phases ? (
          <div className="space-y-2">
            {phases.map((phase) => {
              const isPast = phase.date ? phase.date < todayIso() : false;
              return (
                <div
                  key={phase.key}
                  className="flex items-start gap-3 rounded-md border border-border p-3"
                  data-testid={`row-phase-${phase.key}`}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground mt-0.5">
                    {phase.order}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{phase.title}</span>
                      {isPast && !closed && <Badge variant="secondary" className="text-xs">Done</Badge>}
                      {phase.isAdjusted && (
                        <Badge variant="outline" className="text-xs" data-testid={`badge-adjusted-${phase.key}`}>
                          Adjusted
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{phase.summary}</p>

                    {nudgingKey === phase.key ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Input
                          type="date"
                          value={nudgeInput}
                          onChange={(e) => setNudgeInput(e.target.value)}
                          className="h-8 w-40"
                          data-testid={`input-nudge-${phase.key}`}
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={savingNudge} onClick={() => saveNudge(phase.key, nudgeInput)} data-testid={`button-save-nudge-${phase.key}`}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={savingNudge} onClick={() => setNudgingKey(null)} data-testid={`button-cancel-nudge-${phase.key}`}>
                          <X className="h-4 w-4" />
                        </Button>
                        {phase.isAdjusted && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            disabled={savingNudge}
                            onClick={() => saveNudge(phase.key, null)}
                            data-testid={`button-reset-nudge-${phase.key}`}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" /> Reset to calculated
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <span className="text-sm font-medium tabular-nums" data-testid={`text-date-${phase.key}`}>
                          {phase.date ? fmtLong(phase.date) : offsetLabel(phase.offsetDays, phase.anchor)}
                        </span>
                        {phase.date && !closed && (
                          <button
                            className="text-xs text-primary underline underline-offset-2"
                            onClick={() => { setNudgingKey(phase.key); setNudgeInput(phase.date ?? ""); }}
                            data-testid={`button-nudge-${phase.key}`}
                          >
                            Adjust date
                          </button>
                        )}
                        {phase.date && (
                          <button
                            className="text-xs text-primary underline underline-offset-2"
                            onClick={() => downloadIcs(phase.key)}
                            data-testid={`button-download-phase-ics-${phase.key}`}
                          >
                            Add to calendar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>

      <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{hasStartDate ? "Revise start date" : "Set start date"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {hasStartDate
                ? "Changing your start date recalculates every step in the plan, including steps that already happened. Any dates you've manually adjusted will stay as you set them."
                : "Your end date will be set automatically to two weeks after your start date — the schedule this plan assumes for preparing and collecting responses. You can extend it later if you need more time to reach 50%."}
            </p>
            <Input type="date" value={startInput} onChange={(e) => setStartInput(e.target.value)} data-testid="input-start-date-dialog" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveStartDate} disabled={savingStart || !startInput} data-testid="button-confirm-start-date">
              {savingStart ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Extend end date</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Use this if you haven't reached 50% of responses yet and need more time. Steps that already happened
              (prep and launch) stay put — only the debrief and follow-up steps after your end date will shift.
            </p>
            <Input type="date" value={extendInput} onChange={(e) => setExtendInput(e.target.value)} data-testid="input-extend-date-dialog" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveExtend} disabled={savingExtend || !extendInput} data-testid="button-confirm-extend-date">
              {savingExtend ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
