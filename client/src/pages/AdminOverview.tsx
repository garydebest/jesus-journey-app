import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JJLogo } from "@/lib/logo";
import { WaveReportView } from "@/components/WaveReportView";
import { useAdminAuth, adminApiRequest, adminApiRequestBlob } from "@/lib/adminAuth";
import type { WaveAggregateSummary } from "@shared/aggregate";

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
}

interface AdminChurchGroup {
  church: AdminChurch;
  waves: AdminWaveEntry[];
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
          groups.map(({ church, waves }) => (
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
    </div>
  );
}
