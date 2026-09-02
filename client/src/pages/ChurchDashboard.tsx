import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

const CURRENCY_SYMBOLS: Record<string, string> = { cad: "CA$", usd: "US$", gbp: "£", eur: "€" };
function formatPrice(price: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency.toUpperCase() + " ";
  return `${symbol}${price}`;
}

const TABS = [
  { value: "your-surveys", label: "Your Surveys", badge: "★" },
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
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reportWave, setReportWave] = useState<WaveWithMeta | null>(null);
  const [reportSummary, setReportSummary] = useState<WaveAggregateSummary | null>(null);
  const [activeTab, setActiveTab] = useState<string>("your-surveys");

  const [label, setLabel] = useState("");
  const [minSample, setMinSample] = useState("10");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [sizeTier, setSizeTier] = useState<SizeTier | "">("");
  const [creating, setCreating] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [pricingTiers, setPricingTiers] = useState<Array<{ tier: SizeTier; label: string; description: string; price: number; currency: string }>>([]);
  const [checkoutBanner, setCheckoutBanner] = useState<{ kind: "success" | "cancelled" | "pending"; message: string } | null>(null);

  const loadWaves = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await churchApiRequest(token, "GET", "/api/waves");
      const json = await res.json();
      setWaves(json.waves);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
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
    if (!token) return;
    const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    const checkout = params.get("checkout");
    const waveId = params.get("wave");
    if (!checkout) return;

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
            setCheckoutBanner({ kind: "success", message: "Payment received — your survey is live! Share the join code with your congregation." });
          } else {
            setCheckoutBanner({ kind: "pending", message: "We're still confirming your payment with Stripe. This can take a moment — refresh shortly if the survey doesn't show as live." });
          }
          loadWaves();
        })
        .catch(() => {
          setCheckoutBanner({ kind: "pending", message: "We couldn't confirm payment status right now. Refresh in a moment." });
        });
    }
  }, [token, loadWaves]);

  async function handleCreateWave(e: React.FormEvent) {
    e.preventDefault();
    if (!sizeTier) {
      setError("Please select a church size to continue.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await churchApiRequest(token, "POST", "/api/waves", {
        label,
        minSampleSize: Number(minSample) || 10,
        opensAt: opensAt || undefined,
        closesAt: closesAt || undefined,
        sizeTier,
      });
      const json = await res.json();
      setLabel("");
      setMinSample("10");
      setOpensAt("");
      setClosesAt("");
      setSizeTier("");
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
    try {
      const res = await churchApiRequest(token, "GET", `/api/waves/${wave.id}/report`);
      const json = await res.json();
      setReportSummary(json.snapshot.summary);
    } catch (err) {
      // leave summary null; dialog will show a message
    }
  }

  async function handleDownloadFullReport(wave: WaveWithMeta) {
    await downloadWavePdf(wave, `/api/waves/${wave.id}/report.pdf`, "Our-Journey-with-Jesus-Report.pdf", "This survey doesn't have a full PDF report (it may predate this feature).");
  }

  async function handleDownloadCommentsReport(wave: WaveWithMeta) {
    await downloadWavePdf(wave, `/api/waves/${wave.id}/comments-report.pdf`, "Comments-Report.pdf", "This survey doesn't have a comments report (it may predate this feature, or had no written comments).");
  }

  async function downloadWavePdf(wave: WaveWithMeta, path: string, filename: string, notFoundMessage: string) {
    setDownloadError(null);
    setDownloadingId(wave.id);
    try {
      const res = await churchApiRequest(token, "GET", path);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes("404")) {
        setDownloadError(notFoundMessage);
      } else {
        setDownloadError(`Couldn't download the report: ${msg.replace(/^\d+:\s*/, "")}`);
      }
    } finally {
      setDownloadingId(null);
    }
  }

  if (!church) return null;

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
                  <DialogTitle>Start a new survey</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateWave} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="wave-label">Label</Label>
                    <Input id="wave-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Fall 2026 Survey" required data-testid="input-wave-label" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="min-sample">Minimum responses before closing</Label>
                    <Input id="min-sample" type="number" min={1} value={minSample} onChange={(e) => setMinSample(e.target.value)} data-testid="input-min-sample" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Church size</Label>
                    <RadioGroup value={sizeTier} onValueChange={(v) => setSizeTier(v as SizeTier)} data-testid="radio-size-tier">
                      {pricingTiers.map((t) => (
                        <label
                          key={t.tier}
                          htmlFor={`tier-${t.tier}`}
                          className="flex items-center justify-between gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/40"
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value={t.tier} id={`tier-${t.tier}`} data-testid={`radio-tier-${t.tier}`} />
                            <div>
                              <div className="text-sm font-medium">{t.label}</div>
                              <div className="text-xs text-muted-foreground">{t.description}</div>
                            </div>
                          </div>
                          <div className="text-sm font-semibold">{formatPrice(t.price, t.currency)}</div>
                        </label>
                      ))}
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">
                      One-time payment for this survey. You'll be taken to a secure Stripe checkout page next.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="opens-at">Opens (optional)</Label>
                      <Input id="opens-at" type="date" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} data-testid="input-opens-at" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="closes-at">Closes (optional)</Label>
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
            <Button variant="ghost" size="sm" onClick={() => setLocation("/settings")} data-testid="button-settings">
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={() => { logout(); setLocation("/church"); }} data-testid="button-logout">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full space-y-6">
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
        <div className="rounded-md border bg-muted/20 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your community join code</div>
            <div className="text-lg font-mono tracking-widest" data-testid="text-community-code">{church.communityCode}</div>
          </div>
          <p className="text-xs text-muted-foreground max-w-sm">
            Share this code, or a specific survey's code, with your congregation.
          </p>
        </div>

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
              waves={waves}
              loading={loading}
              error={error}
              closeError={closeError}
              downloadError={downloadError}
              closingId={closingId}
              downloadingId={downloadingId}
              onStartNew={() => setCreateOpen(true)}
              onGoToPrepare={() => setActiveTab("prepare")}
              onClose={handleCloseWave}
              onDownloadReport={handleDownloadFullReport}
              onDownloadCommentsReport={handleDownloadCommentsReport}
              onViewReport={handleViewReport}
              onAbandonPending={handleAbandonPending}
            />
          </TabsContent>
          <TabsContent value="prepare" className="pt-6"><PanelPrepare /></TabsContent>
          <TabsContent value="collect" className="pt-6"><PanelCollect /></TabsContent>
          <TabsContent value="interpret" className="pt-6"><PanelInterpret /></TabsContent>
          <TabsContent value="act" className="pt-6"><PanelAct /></TabsContent>
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
            <p className="text-sm text-muted-foreground py-6">Loading report...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
