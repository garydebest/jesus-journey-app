import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JJLogo } from "@/lib/logo";
import { WaveReportView } from "@/components/WaveReportView";
import { DebriefingReportView } from "@/components/DebriefingReportView";
import { useAdminAuth, adminApiRequest, adminApiRequestBlob } from "@/lib/adminAuth";
import type { WaveAggregateSummary } from "@shared/aggregate";
import type { DebriefingReport } from "@shared/debriefing/types";

interface AdminChurch {
  id: string;
  name: string;
  communityCode: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string | null;
  region: string | null;
  createdAt: string;
}

interface AdminWaveEntry {
  wave: {
    id: string;
    label: string;
    joinCode: string;
    status: string;
    paymentStatus?: string;
    sizeTier?: string | null;
    priceCents?: number | null;
    currency?: string | null;
    minSampleSize: number;
  };
  responseCount: number;
  hasReport: boolean;
  hasReportPdf: boolean;
  hasCommentsReportPdf: boolean;
  hasDebriefingReport: boolean;
  hasDebriefingReportPdf: boolean;
}

interface LegacyPathwayFigure {
  num: number;
  name: string;
  goal: string;
  pct: number | null;
}

interface LegacyGoalFigure {
  goal: string;
  pct: number | null;
}

interface LegacySnapshotSummary {
  sourceLabel: string;
  reportDate: string | null;
  surveyWindow: string | null;
  maturityDistribution: { label: string; pct: number }[];
  spiritualChangeDistribution: { label: string; pct: number }[];
  goalAverages: LegacyGoalFigure[];
  pathwayAverages: LegacyPathwayFigure[];
  demographics: Record<string, Record<string, number>>;
  notes: string | null;
}

interface AdminLegacySnapshot {
  id: string;
  respondentCount: number;
  summary: LegacySnapshotSummary;
  sourceFileNote: string | null;
  createdAt: string;
}

interface AdminChurchGroup {
  church: AdminChurch;
  waves: AdminWaveEntry[];
  legacySnapshots: AdminLegacySnapshot[];
}

export function AdminOverview() {
  const [, setLocation] = useLocation();
  const { token, logout } = useAdminAuth();
  const [groups, setGroups] = useState<AdminChurchGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportChurch, setReportChurch] = useState<AdminChurch | null>(null);
  const [reportWaveEntry, setReportWaveEntry] = useState<AdminWaveEntry | null>(null);
  const [reportSummary, setReportSummary] = useState<WaveAggregateSummary | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingCommentsId, setDownloadingCommentsId] = useState<string | null>(null);
  const [downloadingDebriefingId, setDownloadingDebriefingId] = useState<string | null>(null);
  const [debriefingWaveEntry, setDebriefingWaveEntry] = useState<AdminWaveEntry | null>(null);
  const [debriefingReport, setDebriefingReport] = useState<DebriefingReport | null>(null);
  const [legacyViewChurch, setLegacyViewChurch] = useState<AdminChurch | null>(null);
  const [legacyViewSnapshot, setLegacyViewSnapshot] = useState<AdminLegacySnapshot | null>(null);

  useEffect(() => {
    if (!token) {
      setLocation("/admin/login");
    }
  }, [token, setLocation]);

  const loadChurches = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiRequest(token, "GET", "/api/admin/churches");
      const json = await res.json();
      setGroups(json.churches);
    } catch (err: any) {
      setError(String(err?.message ?? "Unable to load churches."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) loadChurches();
  }, [token, loadChurches]);

  async function handleForceClose(waveId: string) {
    try {
      await adminApiRequest(token, "POST", `/api/admin/waves/${waveId}/close`);
      await loadChurches();
    } catch (err: any) {
      setError(String(err?.message ?? err));
    }
  }

  async function handleViewReport(church: AdminChurch, entry: AdminWaveEntry) {
    setReportChurch(church);
    setReportWaveEntry(entry);
    setReportSummary(null);
    try {
      const res = await adminApiRequest(token, "GET", `/api/admin/waves/${entry.wave.id}/report`);
      const json = await res.json();
      setReportSummary(json.snapshot.summary);
    } catch {
      // dialog shows fallback text
    }
  }

  async function handleDownloadFullReport(entry: AdminWaveEntry) {
    setDownloadingId(entry.wave.id);
    try {
      const blob = await adminApiRequestBlob(token, `/api/admin/waves/${entry.wave.id}/report.pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Our-Journey-with-Jesus-Report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(String(err?.message ?? "Full PDF report is not available."));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleViewDebriefing(entry: AdminWaveEntry) {
    setDebriefingWaveEntry(entry);
    setDebriefingReport(null);
    try {
      const res = await adminApiRequest(token, "GET", `/api/admin/waves/${entry.wave.id}/debriefing`);
      const json = await res.json();
      setDebriefingReport(json.debriefing.report);
    } catch {
      // dialog shows fallback text
    }
  }

  async function handleDownloadDebriefingPdf(entry: AdminWaveEntry) {
    setDownloadingDebriefingId(entry.wave.id);
    try {
      const blob = await adminApiRequestBlob(token, `/api/admin/waves/${entry.wave.id}/debriefing.pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Debriefing-Report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(String(err?.message ?? "Debriefing report PDF is not available."));
    } finally {
      setDownloadingDebriefingId(null);
    }
  }

  async function handleDownloadCommentsReport(entry: AdminWaveEntry) {
    setDownloadingCommentsId(entry.wave.id);
    try {
      const blob = await adminApiRequestBlob(token, `/api/admin/waves/${entry.wave.id}/comments-report.pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Comments-Report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(String(err?.message ?? "Comments report is not available."));
    } finally {
      setDownloadingCommentsId(null);
    }
  }

  function handleSignOut() {
    logout();
    setLocation("/admin/login");
  }

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <JJLogo className="h-8 w-12" />
            <div>
              <div className="text-sm font-semibold">Administrator overview</div>
              <div className="text-xs text-muted-foreground">All churches, contacts, and surveys</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut} data-testid="button-admin-signout">
            Sign out
          </Button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <Alert variant="destructive" data-testid="alert-admin-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading churches...</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No churches have signed up yet.</p>
        ) : (
          groups.map(({ church, waves, legacySnapshots }) => (
            <Card key={church.id} data-testid={`card-admin-church-${church.id}`}>
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{church.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {church.primaryContactName} · {church.primaryContactEmail}
                      {church.primaryContactPhone ? ` · ${church.primaryContactPhone}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Join code {church.communityCode}
                      {church.region ? ` · ${church.region}` : ""}
                    </div>
                  </div>
                  <Badge variant="secondary">{waves.length} survey{waves.length === 1 ? "" : "s"}</Badge>
                </div>

                {legacySnapshots.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="text-xs font-medium text-muted-foreground">Historical records (pre-app, from PDF reports)</div>
                    {legacySnapshots.map((snap) => (
                      <div
                        key={snap.id}
                        className="flex items-center justify-between gap-4 flex-wrap"
                        data-testid={`row-admin-legacy-${snap.id}`}
                      >
                        <div>
                          <div className="text-sm">{snap.summary.sourceLabel}</div>
                          <div className="text-xs text-muted-foreground">
                            {snap.summary.reportDate ? `Report date ${snap.summary.reportDate}` : "Report date unknown"} · {snap.respondentCount} respondents
                            {snap.summary.surveyWindow ? ` · window ${snap.summary.surveyWindow}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">legacy</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setLegacyViewChurch(church);
                              setLegacyViewSnapshot(snap);
                            }}
                            data-testid={`button-admin-view-legacy-${snap.id}`}
                          >
                            View summary
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {waves.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No surveys started yet.</p>
                ) : (
                  <div className="space-y-2 border-t border-border pt-3">
                    {waves.map((entry) => (
                      <div
                        key={entry.wave.id}
                        className="flex items-center justify-between gap-4 flex-wrap"
                        data-testid={`row-admin-wave-${entry.wave.id}`}
                      >
                        <div>
                          <div className="text-sm">{entry.wave.label}</div>
                          <div className="text-xs text-muted-foreground">
                            code {entry.wave.joinCode} · {entry.responseCount} responses · needs {Math.ceil(entry.wave.minSampleSize * 0.5)} to close (50% of {entry.wave.minSampleSize} total adults)
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={entry.wave.status === "closed" ? "secondary" : "default"}>{entry.wave.status}</Badge>
                          {entry.wave.paymentStatus && (
                            <Badge variant={entry.wave.paymentStatus === "paid" ? "outline" : "destructive"} data-testid={`badge-payment-${entry.wave.id}`}>
                              {entry.wave.paymentStatus}
                              {typeof entry.wave.priceCents === "number"
                                ? ` · ${(entry.wave.currency ?? "usd").toUpperCase()} ${(entry.wave.priceCents / 100).toFixed(0)}`
                                : ""}
                            </Badge>
                          )}
                          {entry.hasReport ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewReport(church, entry)}
                                data-testid={`button-admin-view-${entry.wave.id}`}
                              >
                                View summary
                              </Button>
                              {entry.hasReportPdf && (
                                <Button
                                  size="sm"
                                  onClick={() => handleDownloadFullReport(entry)}
                                  disabled={downloadingId === entry.wave.id}
                                  data-testid={`button-admin-download-${entry.wave.id}`}
                                >
                                  {downloadingId === entry.wave.id ? "Preparing..." : "Download PDF"}
                                </Button>
                              )}
                              {entry.hasCommentsReportPdf && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadCommentsReport(entry)}
                                  disabled={downloadingCommentsId === entry.wave.id}
                                  data-testid={`button-admin-download-comments-${entry.wave.id}`}
                                >
                                  {downloadingCommentsId === entry.wave.id ? "Preparing..." : "Comments PDF"}
                                </Button>
                              )}
                              {entry.hasDebriefingReport && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewDebriefing(entry)}
                                  data-testid={`button-admin-debriefing-${entry.wave.id}`}
                                >
                                  Debriefing report
                                </Button>
                              )}
                              {entry.hasDebriefingReportPdf && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadDebriefingPdf(entry)}
                                  disabled={downloadingDebriefingId === entry.wave.id}
                                  data-testid={`button-admin-download-debriefing-${entry.wave.id}`}
                                >
                                  {downloadingDebriefingId === entry.wave.id ? "Preparing..." : "Debriefing PDF"}
                                </Button>
                              )}
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={entry.wave.status === "closed" || entry.responseCount === 0}
                              onClick={() => handleForceClose(entry.wave.id)}
                              data-testid={`button-admin-close-${entry.wave.id}`}
                            >
                              Force close
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>

      <Dialog open={!!reportWaveEntry} onOpenChange={(open) => !open && setReportWaveEntry(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{reportChurch?.name} — {reportWaveEntry?.wave.label}</DialogTitle>
          </DialogHeader>
          {reportSummary && reportChurch ? (
            <WaveReportView summary={reportSummary} churchName={reportChurch.name} />
          ) : (
            <p className="text-sm text-muted-foreground py-6">Loading report...</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!debriefingWaveEntry} onOpenChange={(open) => !open && setDebriefingWaveEntry(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Debriefing report — {debriefingWaveEntry?.wave.label}</DialogTitle>
          </DialogHeader>
          {debriefingReport ? (
            <DebriefingReportView report={debriefingReport} />
          ) : (
            <p className="text-sm text-muted-foreground py-6">Loading debriefing report...</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!legacyViewSnapshot} onOpenChange={(open) => !open && setLegacyViewSnapshot(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{legacyViewChurch?.name} — {legacyViewSnapshot?.summary.sourceLabel}</DialogTitle>
          </DialogHeader>
          {legacyViewSnapshot ? <LegacySnapshotView snapshot={legacyViewSnapshot} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LegacySnapshotView({ snapshot }: { snapshot: AdminLegacySnapshot }) {
  const { summary, respondentCount } = snapshot;
  return (
    <div className="space-y-5 text-sm">
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div>Respondents: {respondentCount}</div>
        {summary.reportDate && <div>Report date: {summary.reportDate}</div>}
        {summary.surveyWindow && <div>Survey window: {summary.surveyWindow}</div>}
        {snapshot.sourceFileNote && <div>Source: {snapshot.sourceFileNote}</div>}
      </div>

      {summary.notes && (
        <Alert data-testid="alert-legacy-notes">
          <AlertDescription>{summary.notes}</AlertDescription>
        </Alert>
      )}

      <div>
        <div className="font-medium mb-2">Spiritual maturity profile</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {summary.maturityDistribution.map((m) => (
            <div key={m.label} className="rounded border border-border px-3 py-2">
              <div className="text-xs text-muted-foreground">{m.label}</div>
              <div className="text-base font-semibold">{m.pct}%</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="font-medium mb-2">Spiritual change since last year</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {summary.spiritualChangeDistribution.map((c) => (
            <div key={c.label} className="rounded border border-border px-3 py-2">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="text-base font-semibold">{c.pct}%</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="font-medium mb-2">Goal averages</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {summary.goalAverages.map((g) => (
            <div key={g.goal} className="rounded border border-border px-3 py-2">
              <div className="text-xs text-muted-foreground">{g.goal}</div>
              <div className="text-base font-semibold">{g.pct === null ? "—" : `${g.pct}%`}</div>
              {g.pct === null && <div className="text-[11px] text-muted-foreground">not available in source report</div>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="font-medium mb-2">Pathway averages</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {summary.pathwayAverages.map((p) => (
            <div key={p.num} className="rounded border border-border px-3 py-2">
              <div className="text-xs text-muted-foreground">{p.num}. {p.name}</div>
              <div className="text-base font-semibold">{p.pct === null ? "—" : `${p.pct}%`}</div>
              {p.pct === null && <div className="text-[11px] text-muted-foreground">not available in source report</div>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="font-medium mb-2">Demographics</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(summary.demographics).map(([category, values]) => (
            <div key={category} className="rounded border border-border px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">{category}</div>
              <div className="space-y-0.5">
                {Object.entries(values).map(([label, pct]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span>{label}</span>
                    <span>{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
