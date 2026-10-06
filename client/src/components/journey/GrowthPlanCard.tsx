import { useState } from "react";
import { Button } from "@/components/ui/button";
import { churchApiRequest, useChurchAuth } from "@/lib/churchAuth";

/** The Growth Plan is a separate paid program. Phase 1 records interest only. */
export function GrowthPlanCard({ isDemo, token, hasReports }: { isDemo: boolean; token: string | null; hasReports: boolean }) {
  const { church, setChurch } = useChurchAuth();
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registered = !!church?.growthPlanInterestAt;

  async function submit() {
    if (!token) return;
    setBusy(true); setError(null);
    try {
      const res = await churchApiRequest(token, "POST", "/api/churches/growth-plan-interest", { optIn });
      const json = await res.json();
      setChurch(json.church);
    } catch {
      setError("We could not record your interest. Please try again or email admin@jesusjourney.life.");
    } finally { setBusy(false); }
  }

  return (
    <section className="rounded-lg border p-5 space-y-3" aria-labelledby="growth-plan-heading" data-testid="growth-plan-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Optional · separate paid program</p>
      <h2 id="growth-plan-heading" className="font-serif text-lg font-semibold">Jesus Journey Growth Plan</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">A one-year guided growth process to help your church turn survey insight into a focused plan, practical next steps, and regular review. The Growth Plan is not included in your survey purchase. Program details coming soon.</p>
      {registered ? (
        <p className="text-sm font-medium" role="status">Thank you. We have your interest on file and will be in touch when program details are available.</p>
      ) : (
        <>
          <label htmlFor="growth-optin" className="flex items-start gap-3 text-sm cursor-pointer">
            <input id="growth-optin" type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} disabled={isDemo} />
            <span>Email me when Growth Plan details are available.</span>
          </label>
          <Button variant="outline" onClick={submit} disabled={isDemo || busy || !token} data-testid="button-growth-interest">
            {busy ? "Sending..." : "I’m interested in the Growth Plan"}
          </Button>
          {isDemo && <p className="text-xs text-muted-foreground">Not available in the demo.</p>}
          {!hasReports && !isDemo && <p className="text-xs text-muted-foreground">Most churches consider the Growth Plan after their results debrief.</p>}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
