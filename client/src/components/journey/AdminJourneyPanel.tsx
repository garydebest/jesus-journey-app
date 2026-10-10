import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { adminApiRequest } from "@/lib/adminAuth";

export interface AdminJourneyWave {
  id: string; status: string; paymentStatus?: string;
  orientationBookedAt?: string | null; orientationCompletedAt?: string | null; activatedAt?: string | null;
  debriefBookedAt?: string | null; debriefCompletedAt?: string | null;
}

interface EmailEvent { id: string; eventType: string; label: string; recipientEmail: string; recipientRole: string; status: string; triggeredBy: string; errorMessage: string | null; createdAt: string; sentAt: string | null }

export function journeyBadge(w: AdminJourneyWave): string | null {
  if (w.paymentStatus !== "paid") return null;
  if (w.status === "not_started") return w.orientationCompletedAt ? "Paid · ready to activate" : w.orientationBookedAt ? "Paid · orientation booked" : "Paid · awaiting orientation";
  if (w.status === "closed") return w.debriefCompletedAt ? "Debrief completed" : w.debriefBookedAt ? "Debrief booked" : "Debrief not booked";
  return null;
}

const errMessage = (err: any) => {
  const raw = String(err?.message ?? err).replace(/^\d+:\s*/, "");
  try { return JSON.parse(raw).message ?? raw; } catch { return raw; }
};

export function AdminJourneyPanel({ token, churchName, wave, isDemo, onChanged }: {
  token: string; churchName: string; wave: AdminJourneyWave; isDemo: boolean; onChanged: (w: AdminJourneyWave) => void;
}) {
  const [orientationDate, setOrientationDate] = useState(wave.orientationBookedAt ?? "");
  const [debriefDate, setDebriefDate] = useState(wave.debriefBookedAt ?? "");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [resendable, setResendable] = useState<{ type: string; label: string }[]>([]);
  const [resendType, setResendType] = useState("");

  const loadEvents = useCallback(async () => {
    try {
      const res = await adminApiRequest(token, "GET", `/api/admin/waves/${wave.id}/emails`);
      const json = await res.json();
      setEvents(json.events); setResendable(json.resendable);
    } catch { /* history is informational */ }
  }, [token, wave.id]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  async function patch(body: Record<string, unknown>, success: string) {
    setBusy(true); setMessage(null);
    try {
      const res = await adminApiRequest(token, "PATCH", `/api/admin/waves/${wave.id}/journey`, body);
      const json = await res.json();
      onChanged(json.wave); setMessage(success);
      window.setTimeout(loadEvents, 1500);
    } catch (err) { setMessage(errMessage(err)); }
    finally { setBusy(false); setConfirming(false); }
  }

  async function resend() {
    if (!resendType) return;
    setBusy(true); setMessage(null);
    try {
      const res = await adminApiRequest(token, "POST", `/api/admin/waves/${wave.id}/emails/resend`, { eventType: resendType });
      const json = await res.json();
      const sent = json.outcomes.filter((o: any) => o.status === "sent").length;
      setMessage(json.outcomes.length ? `Sent to ${sent} of ${json.outcomes.length} recipient(s).` : "Email is not enabled for this account.");
      loadEvents();
    } catch (err) { setMessage(errMessage(err)); }
    finally { setBusy(false); }
  }

  if (wave.paymentStatus !== "paid") return <p className="text-xs text-muted-foreground">Orientation and debrief controls appear after payment.</p>;
  const canCompleteOrientation = !wave.orientationCompletedAt && wave.status !== "closed";
  const closed = wave.status === "closed";
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleString() : "—";

  return (
    <div className="space-y-4 border-t pt-4" data-testid="admin-journey-panel">
      <h3 className="text-sm font-semibold">Client journey</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Orientation</span>
          <Badge variant={wave.orientationCompletedAt ? "default" : "outline"}>{wave.orientationCompletedAt ? `Completed ${new Date(wave.orientationCompletedAt).toLocaleDateString()}` : "Not completed"}</Badge></div>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1"><Label htmlFor="orientation-date" className="text-xs">Orientation booked for</Label>
            <Input id="orientation-date" type="date" value={orientationDate} onChange={(e) => setOrientationDate(e.target.value)} disabled={isDemo || busy || !!wave.orientationCompletedAt} /></div>
          <Button size="sm" variant="outline" disabled={isDemo || busy || !!wave.orientationCompletedAt || orientationDate === (wave.orientationBookedAt ?? "")}
            onClick={() => patch({ orientationBookedAt: orientationDate || null }, "Orientation booking date saved.")}>Save</Button>
        </div>
        {canCompleteOrientation && !confirming && <Button size="sm" disabled={isDemo || busy} onClick={() => setConfirming(true)} data-testid="button-mark-orientation-complete">Mark orientation complete</Button>}
        {confirming && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2" role="alertdialog" aria-label="Confirm orientation complete">
            <p className="text-sm">Mark orientation complete for {churchName}? This will allow the church to activate its paid survey and begin accepting participant responses.</p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
              <Button size="sm" disabled={busy} onClick={() => patch({ orientationCompleted: true }, "Orientation marked complete. The church can now activate its survey.")} data-testid="button-confirm-orientation-complete">Confirm</Button>
            </div>
          </div>
        )}
        {wave.orientationCompletedAt && wave.status === "not_started" && (
          <Button size="sm" variant="ghost" disabled={isDemo || busy} onClick={() => patch({ orientationCompleted: false }, "Orientation completion removed.")}>Undo orientation completion</Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Results debrief</span>
          <Badge variant={wave.debriefCompletedAt ? "default" : "outline"}>{wave.debriefCompletedAt ? `Completed ${new Date(wave.debriefCompletedAt).toLocaleDateString()}` : closed ? "Not completed" : "After closure"}</Badge></div>
        {closed && <>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1"><Label htmlFor="debrief-date" className="text-xs">Debrief booked for</Label>
              <Input id="debrief-date" type="date" value={debriefDate} onChange={(e) => setDebriefDate(e.target.value)} disabled={isDemo || busy} /></div>
            <Button size="sm" variant="outline" disabled={isDemo || busy || debriefDate === (wave.debriefBookedAt ?? "")}
              onClick={() => patch({ debriefBookedAt: debriefDate || null }, wave.debriefBookedAt ? "Debrief booking date saved." : "Debrief booking date saved. The church's Survey Review is being emailed.")}>Save</Button>
          </div>
          {!wave.debriefBookedAt && <p className="text-xs text-muted-foreground">Bookings made through the dashboard's Calendly link fill this in automatically and email the church its Survey Review (PDF attached). If a booking arrives another way, saving the first date here sends it. It is sent only once.</p>}
          <Button size="sm" variant={wave.debriefCompletedAt ? "ghost" : "default"} disabled={isDemo || busy}
            onClick={() => patch({ debriefCompleted: !wave.debriefCompletedAt }, wave.debriefCompletedAt ? "Debrief completion removed." : "Debrief marked complete.")}>
            {wave.debriefCompletedAt ? "Undo debrief completion" : "Mark debrief complete"}
          </Button>
        </>}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email history</h4>
        {events.length === 0 ? <p className="text-xs text-muted-foreground">No journey emails recorded yet.</p> : (
          <ul className="max-h-48 overflow-y-auto space-y-1 text-xs">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-x-2 border-b py-1 last:border-b-0">
                <span>{e.label} → {e.recipientRole === "internal" ? "internal" : e.recipientEmail}{e.triggeredBy === "admin" ? " (resend)" : ""}</span>
                <span className={e.status === "failed" ? "text-destructive" : "text-muted-foreground"} title={e.errorMessage ?? undefined}>{e.status} · {fmt(e.sentAt ?? e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2 items-center">
          <select aria-label="Email to send or resend" className="h-9 flex-1 rounded-md border bg-background px-2 text-sm" value={resendType} onChange={(e) => setResendType(e.target.value)} disabled={isDemo || busy}>
            <option value="">Send or resend an email…</option>
            {resendable.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={isDemo || busy || !resendType} onClick={resend}>Send</Button>
        </div>
      </div>
      {message && <p className="text-sm" role="status">{message}</p>}
    </div>
  );
}
