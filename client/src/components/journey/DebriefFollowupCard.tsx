import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { adminApiRequest } from "@/lib/adminAuth";

interface Followup {
  id: string; source: "fathom" | "pasted"; fathomUrl: string | null; subject: string; body: string;
  reviewNotes: string | null; edited: boolean; status: "draft" | "sent"; updatedAt: string; sentAt: string | null; sentBy: string | null; sentTo: string | null;
}

const errMessage = (err: any) => {
  const raw = String(err?.message ?? err).replace(/^\d+:\s*/, "");
  try { return JSON.parse(raw).message ?? raw; } catch { return raw; }
};

/** Review, edit and send the debrief follow-up email. Nothing is sent without a click here. */
export function DebriefFollowupCard({ token, waveId, isDemo, onSent }: { token: string; waveId: string; isDemo: boolean; onSent?: () => void }) {
  const [followup, setFollowup] = useState<Followup | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [fathomConfigured, setFathomConfigured] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [busy, setBusy] = useState<"" | "draft" | "save" | "send">("");
  const [message, setMessage] = useState<string | null>(null);

  const apply = (f: Followup | null) => { setFollowup(f); setSubject(f?.subject ?? ""); setBody(f?.body ?? ""); };

  const load = useCallback(async () => {
    try {
      const res = await adminApiRequest(token, "GET", `/api/admin/waves/${waveId}/followup`);
      const json = await res.json();
      apply(json.followup); setRecipients(json.recipients ?? []);
      setAiConfigured(!!json.aiConfigured); setFathomConfigured(!!json.fathomConfigured);
    } catch { /* informational */ }
  }, [token, waveId]);
  useEffect(() => { load(); }, [load]);

  const dirty = !!followup && (subject !== followup.subject || body !== followup.body);
  const sent = followup?.status === "sent";

  async function generate() {
    if (followup?.edited || dirty) {
      if (!window.confirm("Replace the current draft, including your edits, with a new draft from this transcript?")) return;
    }
    setBusy("draft"); setMessage(null);
    try {
      const res = await adminApiRequest(token, "POST", `/api/admin/waves/${waveId}/followup/draft`, { text: pasted });
      apply((await res.json()).followup); setPasted(""); setShowPaste(false);
      setMessage("Draft ready. Review and edit it before sending.");
    } catch (err) { setMessage(errMessage(err)); }
    finally { setBusy(""); }
  }

  async function save() {
    setBusy("save"); setMessage(null);
    try {
      const res = await adminApiRequest(token, "PUT", `/api/admin/waves/${waveId}/followup`, { subject, body });
      apply((await res.json()).followup); setMessage("Draft saved.");
    } catch (err) { setMessage(errMessage(err)); }
    finally { setBusy(""); }
  }

  async function send() {
    setBusy("send"); setMessage(null);
    try {
      if (dirty) {
        const r = await adminApiRequest(token, "PUT", `/api/admin/waves/${waveId}/followup`, { subject, body });
        apply((await r.json()).followup);
      }
      const res = await adminApiRequest(token, "POST", `/api/admin/waves/${waveId}/followup/send`);
      const json = await res.json();
      apply(json.followup); setMessage(`Sent to ${json.followup.sentTo}.`); onSent?.();
    } catch (err) { setMessage(errMessage(err)); }
    finally { setBusy(""); setConfirmSend(false); }
  }

  const unresolved = /\[(owner|date) to confirm\]|\[add two or three|\[step – owner – date\]/.test(body);

  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="debrief-followup-card">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Debrief follow-up</h4>
        {followup && <Badge variant={sent ? "default" : "outline"}>{sent ? `Sent ${new Date(followup.sentAt!).toLocaleDateString()}` : followup.edited ? "Draft (edited)" : "Draft"}</Badge>}
      </div>

      {!followup && (
        <p className="text-xs text-muted-foreground">
          {fathomConfigured
            ? "When the debrief is recorded in Fathom, a draft follow-up email appears here automatically, usually within a few minutes of the call ending. You can also paste a transcript or notes."
            : "Paste the Fathom transcript or your notes from the debrief to draft the follow-up email."}
        </p>
      )}

      {followup && (
        <>
          <p className="text-xs text-muted-foreground">
            {followup.source === "fathom" ? "Drafted from the Fathom recording" : "Drafted from a pasted transcript"}
            {followup.fathomUrl && <> · <a className="underline" href={followup.fathomUrl} target="_blank" rel="noreferrer">Open recording</a></>}
            {sent && followup.sentBy ? ` · sent by ${followup.sentBy}` : ""}
          </p>
          {followup.reviewNotes && !sent && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs" data-testid="followup-review-notes">
              <span className="font-semibold">Check before sending: </span>{followup.reviewNotes}
            </div>
          )}
          <div className="space-y-1"><Label htmlFor="followup-subject" className="text-xs">Subject</Label>
            <Input id="followup-subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isDemo || sent || !!busy} /></div>
          <div className="space-y-1"><Label htmlFor="followup-body" className="text-xs">Message</Label>
            <Textarea id="followup-body" value={body} onChange={(e) => setBody(e.target.value)} disabled={isDemo || sent || !!busy} rows={16} className="font-mono text-xs" /></div>
          {!sent && (
            <>
              <p className="text-xs text-muted-foreground">Will be sent to: {recipients.length ? recipients.join(", ") : "no contact email on file"}</p>
              {unresolved && <p className="text-xs text-amber-700 dark:text-amber-400">Some placeholders in square brackets still need filling in.</p>}
              {!confirmSend ? (
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" disabled={isDemo || !!busy || !dirty} onClick={save}>{busy === "save" ? "Saving…" : "Save draft"}</Button>
                  <Button size="sm" disabled={isDemo || !!busy || !recipients.length} onClick={() => setConfirmSend(true)} data-testid="button-followup-send">Send…</Button>
                </div>
              ) : (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2" role="alertdialog" aria-label="Confirm send follow-up">
                  <p className="text-sm">Send this follow-up to {recipients.join(" and ")}? It goes from the Jesus Journey address and is recorded in the email history.</p>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setConfirmSend(false)}>Cancel</Button>
                    <Button size="sm" disabled={!!busy} onClick={send} data-testid="button-followup-confirm-send">{busy === "send" ? "Sending…" : "Send now"}</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {!sent && (
        <div className="space-y-2 pt-1">
          {!showPaste ? (
            <Button size="sm" variant="ghost" disabled={isDemo || !!busy} onClick={() => setShowPaste(true)} data-testid="button-followup-paste">
              {followup ? "Redraft from a pasted transcript" : "Paste a transcript or notes"}
            </Button>
          ) : (
            <>
              <Label htmlFor="followup-paste" className="text-xs">Transcript or notes from the debrief</Label>
              <Textarea id="followup-paste" value={pasted} onChange={(e) => setPasted(e.target.value)} rows={6} placeholder="In Fathom, open the recording, choose Transcript and copy it here." disabled={!!busy} />
              <p className="text-xs text-muted-foreground">Used only to write the draft. The transcript itself isn't saved.</p>
              {!aiConfigured && <p className="text-xs text-destructive">Drafting isn't set up on the server yet (the AI key is missing).</p>}
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { setShowPaste(false); setPasted(""); }}>Cancel</Button>
                <Button size="sm" disabled={isDemo || !!busy || pasted.trim().length < 200 || !aiConfigured} onClick={generate} data-testid="button-followup-generate">
                  {busy === "draft" ? "Drafting… (up to a minute)" : "Draft follow-up"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {message && <p className="text-sm" role="status">{message}</p>}
    </div>
  );
}
