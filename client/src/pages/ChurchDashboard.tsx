import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { JJBrandLockup } from "@/lib/logo";
import { useChurchAuth } from "@/lib/churchAuth";
import { churchApiRequest } from "@/lib/churchAuth";
import type { WaveAggregateSummary } from "@shared/aggregate";
import { WaveReportView } from "@/components/WaveReportView";
import { PanelYourSurveys, type WaveWithMeta } from "@/components/dashboard/PanelYourSurveys";
import { PanelPrepare } from "@/components/dashboard/PanelPrepare";
import { PanelCollect } from "@/components/dashboard/PanelCollect";
import { PanelInterpret } from "@/components/dashboard/PanelInterpret";
import { PanelAct } from "@/components/dashboard/PanelAct";
import { PanelResources } from "@/components/dashboard/PanelResources";
import type { SizeTier } from "@shared/schema";
import { PARTICIPANT_DEMO_CODE } from "@shared/participantDemo";

const CURRENCY_SYMBOLS: Record<string, string> = { cad: "CA$", usd: "US$", gbp: "£", eur: "€" };
function formatPrice(price: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency.toUpperCase() + " ";
  return `${symbol}${price}`;
}

const TABS = [
  { value: "your-surveys", label: "Your Reports", badge: "★" },
  { value: "prepare", label: "Prepare", badge: "1" },
  { value: "collect", label: "Collect", badge: "2" },
  { value: "interpret", label: "Interpret", badge: "3" },
  { value: "act", label: "Act", badge: "4" },
  { value: "resources", label: "Resources", badge: "5" },
] as const;

export function ChurchDashboard() {
  const [, setLocation] = useLocation();
  const { token, church, logout } = useChurchAuth();
  const [waves, setWaves] = useState<WaveWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reportWave, setReportWave] = useState<WaveWithMeta | null>(null);
  const [reportSummary, setReportSummary] = useState<WaveAggregateSummary | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    // Email deep links use #/dashboard?tab=collect. The tab survives the
    // sign-in redirect through sessionStorage when available.
    const fromHash = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("tab");
    let stored: string | null = null;
    try { stored = sessionStorage.getItem("jj-dashboard-tab"); sessionStorage.removeItem("jj-dashboard-tab"); } catch {}
    const tab = fromHash ?? stored;
    return TABS.some((t) => t.value === tab) ? tab! : "your-surveys";
  });

  const navigateTo = useCallback((tab: string, anchorId?: string) => {
    setActiveTab(tab);
    window.setTimeout(() => {
      const el = anchorId ? document.getElementById(anchorId) : null;
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); (el as HTMLElement).focus?.({ preventScroll: true }); }
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }, 60);
  }, []);

  const [label, setLabel] = useState("");
  const [minSample, setMinSample] = useState("16");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [pricingTiers, setPricingTiers] = useState<Array<{ tier: SizeTier; label: string; min: number; max: number | null; price: number; currency: string }>>([]);
  const [checkoutBanner, setCheckoutBanner] = useState<{ kind: "success" | "cancelled" | "pending"; message: string } | null>(null);

  const loadWaves = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await churchApiRequest(token, "GET", "/api/waves");
      const json = await res.json();
      setWaves(json.waves);
    } catch (err: any) {
      setLoadError("We couldn't load your saved surveys. This does not mean your reports are missing. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      const tab = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("tab");
      if (tab) { try { sessionStorage.setItem("jj-dashboard-tab", tab); } catch {} }
      setLocation("/church");
      return;
    }
    loadWaves();
  }, [token, loadWaves, setLocation]);

  useEffect(() => {
    churchApiRequest(token, "GET", "/api/pricing")
      .then((res) => res.json())
      .then((json) => setPricingTiers(json.tiers ?? []))
      .catch(() => {});
  }, [token]);

  // Detect the return from Stripe Checkout (?checkout=success|cancelled&wave=ID)
  // and confirm payment status directly rather than waiting on the webhook.
  useEffect(() => {
    if (!token || church?.isDemo) return;
    const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    const checkout = params.get("checkout");
    const waveId = params.get("wave");
    if (!checkout) {
      if (params.get("tab")) window.history.replaceState(null, "", window.location.pathname + window.location.hash.split("?")[0]);
      return;
    }

    // Clear the query params from the URL so a refresh doesn't re-trigger this.
    window.history.replaceState(null, "", window.location.pathname + window.location.hash.split("?")[0]);

    if (checkout === "cancelled") {
      setCheckoutBanner({ kind: "cancelled", message: "Checkout was cancelled — no payment was made. You can try again anytime." });
      return;
    }
    if (checkout === "success" && waveId) {
      setCheckoutBanner({ kind: "pending", message: "Confirming your payment…" });
      churchApiRequest(token, "GET", `/api/waves/${waveId}/payment-status`)
        .then((res) => res.json())
        .then((json) => {
          if (json.wave?.paymentStatus === "paid") {
            setCheckoutBanner({ kind: "success", message: "Payment received. Your next step is to book your required Survey Orientation. Your participant code activates after the orientation is complete." });
          } else {
            setCheckoutBanner({ kind: "pending", message: "We're still confirming your payment with Stripe. Refresh shortly if the survey does not show as paid and awaiting confirmation." });
          }
          loadWaves();
        })
        .catch(() => {
          setCheckoutBanner({ kind: "pending", message: "We couldn't confirm payment status right now. Refresh in a moment." });
        });
    }
  }, [token, loadWaves, church?.isDemo]);

  async function handleCreateWave(e: React.FormEvent) {
    e.preventDefault();
    if (!minSample || Number(minSample) < 16) {
      setError("Please enter your total number of adults, 16 or more, before continuing.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await churchApiRequest(token, "POST", "/api/waves", {
        label,
        minSampleSize: Number(minSample) || 16,
        opensAt: opensAt || undefined,
        closesAt: closesAt || undefined,
      });
      const json = await res.json();
      setLabel("");
      setMinSample("16");
      setOpensAt("");
      setClosesAt("");
      setCreateOpen(false);
      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }
      await loadWaves();
    } catch (err: any) {
      setError(String(err?.message ?? err).replace(/^\d+:\s*/, ""));
    } finally {
      setCreating(false);
    }
  }

  async function handleAbandonPending(waveId: string) {
    try {
      await churchApiRequest(token, "DELETE", `/api/waves/${waveId}/pending`);
      await loadWaves();
    } catch (err: any) {
      setError(String(err?.message ?? err).replace(/^\d+:\s*/, ""));
    }
  }

  async function handleCloseWave(waveId: string) {
    setClosingId(waveId);
    setCloseError(null);
    try {
      await churchApiRequest(token, "POST", `/api/waves/${waveId}/close`);
      await loadWaves();
    } catch (err: any) {
      const msg = String(err?.message ?? err).replace(/^\d+:\s*/, "");
      try {
        setCloseError(JSON.parse(msg).message ?? msg);
      } catch {
        setCloseError(msg);
      }
    } finally {
      setClosingId(null);
    }
  }

  async function handleViewReport(wave: WaveWithMeta) {
    setReportWave(wave);
    setReportSummary(null);
    setReportError(null);
    try {
      const res = await churchApiRequest(token, "GET", `/api/waves/${wave.id}/report`);
      const json = await res.json();
      setReportSummary(json.snapshot.summary);
    } catch (err) {
      setReportError("We could not load this report. Close this window and try again.");
    }
  }

  async function handleDownloadFullReport(wave: WaveWithMeta) {
    await openWavePdf(wave, "report", "This survey doesn't have a full PDF report (it may predate this feature).");
  }

  async function handleDownloadCommentsReport(wave: WaveWithMeta) {
    await openWavePdf(wave, "comments", "This survey doesn't have a comments report (it may predate this feature, or had no written comments).");
  }

  async function handleDownloadCommentsWordcloud(wave: WaveWithMeta) {
    await openWavePdf(wave, "wordcloud", "This survey doesn't have a comments wordcloud because it has no Comments Report.");
  }

  // Opens the PDF in its own tab so the dashboard (and the demo) stays open
  // behind it. The tab is opened synchronously on the click so Safari doesn't
  // treat it as a pop-up, then pointed at a short-lived view link.
  async function openWavePdf(wave: WaveWithMeta, kind: "report" | "comments" | "wordcloud", notFoundMessage: string) {
    setDownloadError(null);
    setDownloadingId(wave.id);
    const tab = window.open("", "_blank");
    if (tab) {
      try {
        tab.document.title = kind === "report" ? "Church Report" : kind === "wordcloud" ? "Comments Wordcloud" : "Comments Report";
        tab.document.body.innerHTML = '<p style="font-family:system-ui,sans-serif;padding:2rem;color:#444">Opening your report…</p>';
      } catch { /* ignore */ }
    }
    try {
      const res = await churchApiRequest(token, "GET", `/api/waves/${wave.id}/pdf-link?kind=${kind}`);
      const { url } = await res.json();
      const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
      const full = new URL(`${API_BASE}${url}`, window.location.href).toString();
      if (tab && !tab.closed) tab.location.href = full;
      else window.location.href = full;
    } catch (err: any) {
      if (tab && !tab.closed) tab.close();
      const msg = String(err?.message ?? err);
      if (msg.includes("404") || /not available/i.test(msg)) {
        setDownloadError(notFoundMessage);
      } else {
        setDownloadError(`Couldn't open the report: ${msg.replace(/^\d+:\s*/, "")}`);
      }
    } finally {
      setDownloadingId(null);
    }
  }

  if (!church) return null;
  const currentWave = waves.find((w) => w.paymentStatus === "paid" && w.status !== "closed") ?? null;
  const latestClosed = waves.filter((w) => w.status === "closed" && w.snapshot)
    .sort((a, b) => (Date.parse(b.closedAt ?? "") || 0) - (Date.parse(a.closedAt ?? "") || 0))[0] ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <JJBrandLockup logoClassName="h-8 w-12" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold" data-testid="text-church-name">{church.name}</div>
              <div className="text-xs text-muted-foreground">{church.primaryContactEmail}</div>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Purchase a new survey</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateWave} className="space-y-4">
                  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                  <div className="space-y-1.5">
                    <Label htmlFor="wave-label">Label</Label>
                    <Input id="wave-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Fall 2026 Survey" required data-testid="input-wave-label" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="min-sample">What is your total number of adults (16+)?</Label>
                    <Input id="min-sample" type="number" min={16} value={minSample} onChange={(e) => setMinSample(e.target.value)} data-testid="input-min-sample" />
                    <p className="text-xs text-muted-foreground">
                      Enter the total number of adults (16+) in your church community. A good estimate is your average
                      attendance aged 16+, plus 50%. This sets your price, and you'll need responses from at least half
                      this number before you can close the survey and generate reports.
                    </p>
                  </div>
                  <div className="space-y-1.5" data-testid="standard-plan-price">
                    <Label>Standard Plan price</Label>
                    {(() => {
                      const n = Number(minSample);
                      const t = n >= 16 ? pricingTiers.find((x) => n >= x.min && (x.max === null || n <= x.max)) : undefined;
                      return t
                        ? <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                            <div className="text-sm font-medium" data-testid="text-price-range">{t.label}</div>
                            <div className="text-sm font-semibold" data-testid="text-price-amount">{formatPrice(t.price, t.currency)} <span className="font-normal text-muted-foreground">+ applicable tax</span></div>
                          </div>
                        : <p className="text-sm text-muted-foreground">Enter your total number of adults above to see your price.</p>;
                    })()}
                    <p className="text-xs text-muted-foreground">
                      Your price is set by your total number of adults (16+). One-time payment for this survey, including
                      the orientation and results debrief. You'll be taken to a secure Stripe checkout page next.
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid="text-tax-note">
                      Prices exclude applicable taxes. Taxes are calculated at checkout. GST/HST is calculated using your
                      church's billing address, so please enter the church's address at checkout, not a personal address.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="opens-at">Provisional start</Label>
                      <Input id="opens-at" type="date" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} data-testid="input-opens-at" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="closes-at">Provisional close</Label>
                      <Input id="closes-at" type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} data-testid="input-closes-at" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={creating} data-testid="button-confirm-new-wave">
                      {creating ? "Starting checkout..." : "Continue to payment"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" disabled={church.isDemo} onClick={() => setLocation("/settings")} data-testid="button-settings">
              Settings
            </Button>
            {church.isDemo ? (
              <Button variant="outline" size="sm" asChild>
                <a href="https://www.jesusjourney.life/#for-churches" data-testid="button-exit-demo">Exit demo</a>
              </Button>
            ) : <Button variant="outline" size="sm" onClick={() => { logout(); setLocation("/church"); }} data-testid="button-logout">
              Sign out
            </Button>}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full space-y-6">
        {church.isDemo && (
          <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-1" aria-label="Demo access notice" data-testid="dashboard-demo-notice">
            <h1 className="text-lg font-semibold">Explore the Grace Fellowship church dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Demo only. Explore sample reports and practise planning with simulated data.
              Changes are not saved. Running your own church survey requires your own account and a paid plan.
            </p>
          </section>
        )}
        {church.isDemo && (
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="participant-demo-heading" data-testid="dashboard-participant-demo">
            <div className="space-y-1">
              <h2 id="participant-demo-heading" className="text-base font-semibold">See the participant experience</h2>
              <p className="text-sm text-muted-foreground">
                Walk through the church survey. Practice answers are not saved and will not change Grace's sample results.
              </p>
            </div>
            <div className="shrink-0 space-y-1 text-center">
              <Button asChild className="w-full sm:w-auto">
                <a href={`#/join/${PARTICIPANT_DEMO_CODE}`} target="_blank" rel="noopener noreferrer" data-testid="button-try-participant-survey">
                  Try the participant survey
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">Opens in a new tab</p>
            </div>
          </section>
        )}
        {checkoutBanner && (
          <Alert
            variant={checkoutBanner.kind === "cancelled" ? "destructive" : "default"}
            data-testid="alert-checkout-status"
          >
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{checkoutBanner.message}</span>
              <Button variant="ghost" size="sm" onClick={() => setCheckoutBanner(null)} data-testid="button-dismiss-checkout-banner">
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0 border-b rounded-none">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                data-testid={`tab-${t.value}`}
                className="rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none gap-2"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] font-semibold ${
                    activeTab === t.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {t.badge}
                </span>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="your-surveys" className="pt-6">
            <PanelYourSurveys
              token={token}
              isDemo={church.isDemo}
              waves={waves}
              loading={loading}
              loadError={loadError}
              onRetryLoad={loadWaves}
              error={error}
              closeError={closeError}
              downloadError={downloadError}
              closingId={closingId}
              downloadingId={downloadingId}
              onStartNew={(plan) => {
                if (church.isDemo) return;
                if (plan) {
                  setMinSample(String(plan.minSampleSize));
                  setOpensAt(plan.opensAt);
                  setClosesAt(plan.closesAt);
                }
                setError(null);
                setCreateOpen(true);
              }}
              onGoToPrepare={() => setActiveTab("prepare")}
              onClose={handleCloseWave}
              onDownloadReport={handleDownloadFullReport}
              onDownloadCommentsReport={handleDownloadCommentsReport}
              onDownloadCommentsWordcloud={handleDownloadCommentsWordcloud}
              onViewReport={handleViewReport}
              onAbandonPending={handleAbandonPending}
              onDatesChanged={loadWaves}
              onNavigate={navigateTo}
            />
          </TabsContent>
          <TabsContent value="prepare" className="pt-6"><PanelPrepare church={church} currentWave={currentWave} isDemo={!!church.isDemo} onOpenSettings={() => setLocation("/settings")} /></TabsContent>
          <TabsContent value="collect" className="pt-6"><PanelCollect /></TabsContent>
          <TabsContent value="interpret" className="pt-6"><PanelInterpret latestReport={latestClosed} isDemo={!!church.isDemo} /></TabsContent>
          <TabsContent value="act" className="pt-6"><PanelAct latestReport={latestClosed} isDemo={!!church.isDemo} token={token} /></TabsContent>
          <TabsContent value="resources" className="pt-6"><PanelResources /></TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-2 text-center">
          <JJBrandLockup variant="plain" logoClassName="h-6 w-9" />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Jesus Journey Group. All rights reserved.</p>
        </div>
      </footer>

      <Dialog open={!!reportWave} onOpenChange={(open) => !open && setReportWave(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{reportWave?.label} — Survey Report</DialogTitle>
          </DialogHeader>
          {reportSummary ? (
            <WaveReportView summary={reportSummary} churchName={church.name} />
          ) : (
            <p role={reportError ? "alert" : "status"} className="text-sm text-muted-foreground py-6">{reportError ?? "Loading report..."}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
