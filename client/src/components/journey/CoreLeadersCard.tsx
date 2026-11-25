import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { adminApiRequest, adminApiRequestBlob } from "@/lib/adminAuth";

// Core Leaders Review. The owner turns the round on for a survey, which gives
// it a separate leader code. Once enough leaders have answered, any
// administrator can prepare a review of just their answers while the survey
// stays open. The leaders' answers stay in the survey and the final reports.
export interface CoreLeadersWave {
  id: string; status: string;
  coreLeadersEnabled?: boolean;
  leaderJoinCode?: string | null;
}
export interface CoreLeadersStatus {
  leaderResponseCount?: number;
  leaderMinimum?: number;
  leaderReview?: { respondentCount: number; generatedAt: string } | null;
}

const errMessage = (err: any) => {
  const raw = String(err?.message ?? err).replace(/^\d+:\s*/, "");
  try { return JSON.parse(raw).message ?? raw; } catch { return raw; }
};

export function CoreLeadersCard({ token, wave, status, isOwner, isDemo, onChanged }: {
  token: string; wave: CoreLeadersWave; status: CoreLeadersStatus; isOwner: boolean; isDemo: boolean;
  onChanged: (w: CoreLeadersWave | null, s: CoreLeadersStatus) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const enabled = wave.coreLeadersEnabled === true;
  const closed = wave.status === "closed";
  const count = status.leaderResponseCount ?? 0;
  const minimum = status.leaderMinimum ?? 30;
  const review = status.leaderReview ?? null;

  if (!enabled && !isOwner && !review) return null;

  async function toggle(next: boolean) {
    setBusy("toggle"); setMessage(null);
    try {
      const res = await adminApiRequest(token, "PATCH", `/api/admin/waves/${wave.id}/core-leaders`, { enabled: next });
      const json = await res.json();
      onChanged(json.wave, json);
      setMessage(next ? "Core Leaders round is on. Give the church the leader code below." : "Core Leaders round is off. The leader code no longer works.");
    } catch (err) { setMessage(errMessage(err)); }
    finally { setBusy(null); }
  }

  async function generate() {
    setBusy("generate"); setMessage("Preparing the Core Leaders Review. This takes about half a minute.");
    try {
      const res = await adminApiRequest(token, "POST", `/api/admin/waves/${wave.id}/core-leaders/generate`);
      const json = await res.json();
      onChanged(null, json);
      setMessage(`Ready. The review uses ${json.leaderReview?.respondentCount ?? count} leader responses.`);
    } catch (err) { setMessage(errMessage(err)); }
    finally { setBusy(null); }
  }

  async function download(route: "leaders-review.pdf" | "leaders-facilitator.pdf", filename: string) {
    setBusy(route); setMessage(null);
    try {
      const blob = await adminApiRequestBlob(token, `/api/admin/waves/${wave.id}/${route}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) { setMessage(errMessage(err)); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-2 border-t pt-4" data-testid="core-leaders-card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Core Leaders Review</h3>
        {isOwner && !closed && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {enabled ? "On" : "Off"}
            <Switch checked={enabled} disabled={isDemo || busy !== null} onCheckedChange={toggle} data-testid="switch-core-leaders" aria-label="Core Leaders round" />
          </label>
        )}
      </div>
      {!enabled && !review && <p className="text-xs text-muted-foreground">Turn this on if the church will survey its core leaders before inviting everyone. The survey then gets a separate leader code.</p>}
      {enabled && wave.leaderJoinCode && !closed && (
        <div className="flex items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">Leader code</span>
          <span className="font-mono font-semibold tracking-wider" data-testid="text-leader-code">{wave.leaderJoinCode}</span></div>
      )}
      {(enabled || review) && (
        <div className="flex items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">Leaders who have answered</span>
          <span data-testid="text-leader-count">{count} of {minimum} needed</span></div>
      )}
      {review && (
        <p className="text-xs text-muted-foreground">Last prepared {new Date(review.generatedAt).toLocaleString()} from {review.respondentCount} leaders.</p>
      )}
      {enabled && !closed && (
        <>
          {count < minimum && <p className="text-xs text-muted-foreground">The review can be prepared once {minimum} leaders have answered.</p>}
          <Button size="sm" variant="outline" disabled={isDemo || busy !== null || count < minimum} onClick={generate} data-testid="button-generate-leaders-review">
            {busy === "generate" ? "Preparing…" : review ? "Prepare again with the latest answers" : "Prepare Core Leaders Review"}
          </Button>
        </>
      )}
      {review && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => download("leaders-review.pdf", "Core-Leaders-Review.pdf")} data-testid="button-download-leaders-review">
            {busy === "leaders-review.pdf" ? "Downloading…" : "Core Leaders Review"}
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => download("leaders-facilitator.pdf", "Core-Leaders-Facilitators-Report.pdf")} data-testid="button-download-leaders-facilitator">
            {busy === "leaders-facilitator.pdf" ? "Downloading…" : "Facilitator's Report"}
          </Button>
        </div>
      )}
      {message && <p className="text-sm" role="status">{message}</p>}
    </div>
  );
}
