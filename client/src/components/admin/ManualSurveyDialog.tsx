import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminApiRequest } from "@/lib/adminAuth";

export interface ManualSurveyChurchOption { id: string; name: string; email: string }

// Standard Plan respondent caps by adult total (mirrors server/pricing.ts).
const TIERS: { label: string; min: number; max: number | null }[] = [
  { label: "200 members or less", min: 1, max: 200 },
  { label: "201–400 members", min: 201, max: 400 },
  { label: "401–700 members", min: 401, max: 700 },
  { label: "701–1200 members", min: 701, max: 1200 },
  { label: "1201–1500 members", min: 1201, max: 1500 },
  { label: "Over 1500 members", min: 1501, max: null },
];

type Method = "stripe" | "offline" | "complimentary";

interface Result { churchName: string; label: string; paymentLinkUrl: string | null; method: Method; emailStatus: string; createdChurch: boolean }

const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-base md:text-sm";

export function ManualSurveyDialog({ open, onOpenChange, token, churches, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  churches: ManualSurveyChurchOption[];
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [churchId, setChurchId] = useState("");
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [label, setLabel] = useState(`Church Survey ${new Date().getFullYear()}`);
  const [adults, setAdults] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("cad");
  const [method, setMethod] = useState<Method>("stripe");
  const [note, setNote] = useState("");
  const [emailChurch, setEmailChurch] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  const tier = useMemo(() => {
    const n = Number(adults);
    if (!Number.isFinite(n) || n < 16) return null;
    return TIERS.find((t) => n >= t.min && (t.max === null || n <= t.max)) ?? null;
  }, [adults]);

  function reset() {
    setMode("new"); setChurchId(""); setName(""); setContactName(""); setEmail(""); setPhone(""); setRegion("");
    setLabel(`Church Survey ${new Date().getFullYear()}`); setAdults(""); setPrice(""); setCurrency("cad");
    setMethod("stripe"); setNote(""); setEmailChurch(true); setError(null); setResult(null); setCopied(false);
  }

  function close(next: boolean) {
    if (busy) return;
    if (!next) reset();
    onOpenChange(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const priceNumber = method === "complimentary" ? 0 : Number(price);
    if (method !== "complimentary" && (!Number.isFinite(priceNumber) || priceNumber < 1)) {
      setError("Enter a price of at least 1.00, or choose Complimentary.");
      return;
    }
    if (mode === "existing" && !churchId) { setError("Choose the church account."); return; }
    setBusy(true);
    try {
      const body = {
        ...(mode === "existing" ? { churchId } : { newChurch: { name, primaryContactName: contactName, primaryContactEmail: email, primaryContactPhone: phone || undefined, region: region || undefined } }),
        label,
        minSampleSize: Number(adults),
        price: priceNumber,
        currency,
        paymentMethod: method,
        adminNote: note || undefined,
        emailChurch,
      };
      const json = await (await adminApiRequest(token, "POST", "/api/admin/manual-surveys", body)).json();
      setResult({ churchName: json.church.name, label: json.wave.label, paymentLinkUrl: json.paymentLinkUrl, method, emailStatus: json.emailStatus, createdChurch: json.createdChurch });
      onCreated();
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a church survey</DialogTitle>
          <DialogDescription>Enter a church by hand and set its price. The price is before tax; Stripe adds GST/HST at checkout.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 text-sm" data-testid="manual-survey-result">
            <p><strong>{result.label}</strong> was added for <strong>{result.churchName}</strong>{result.createdChurch ? " (new account)" : ""}.</p>
            {result.method === "stripe" ? (
              <>
                <p>It stays unpaid until the church pays by card. This payment link always opens a live Stripe checkout at the agreed price:</p>
                {result.paymentLinkUrl && <div className="flex gap-2">
                  <Input readOnly value={result.paymentLinkUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Payment link" data-testid="input-payment-link" />
                  <Button type="button" variant="outline" onClick={() => copyLink(result.paymentLinkUrl!)}>{copied ? "Copied" : "Copy"}</Button>
                </div>}
              </>
            ) : (
              <p>It is marked paid ({result.method === "offline" ? "paid outside Stripe" : "complimentary"}). Next step is the church's Survey Orientation.</p>
            )}
            <p className="text-muted-foreground">Email to the church: {result.emailStatus === "sent" ? "sent" : result.emailStatus === "not sent" ? "not sent (you chose not to email)" : `not delivered (${result.emailStatus}); please contact the church directly${result.method === "stripe" ? " and share the payment link" : ""}`}.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { reset(); }}>Add another</Button>
              <Button type="button" onClick={() => close(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Church</legend>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="radio" name="church-mode" checked={mode === "new"} onChange={() => setMode("new")} /> New church</label>
                <label className="flex items-center gap-2"><input type="radio" name="church-mode" checked={mode === "existing"} onChange={() => setMode("existing")} /> Existing account</label>
              </div>
              {mode === "existing" ? (
                <select aria-label="Church account" className={selectClass} value={churchId} onChange={(e) => setChurchId(e.target.value)} data-testid="select-manual-church">
                  <option value="">Choose a church…</option>
                  {churches.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}
                </select>
              ) : (
                <div className="grid gap-3">
                  <div className="space-y-1"><Label htmlFor="ms-name">Church name</Label><Input id="ms-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><Label htmlFor="ms-contact">Primary contact</Label><Input id="ms-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} required /></div>
                    <div className="space-y-1"><Label htmlFor="ms-email">Contact email</Label><Input id="ms-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><Label htmlFor="ms-phone">Phone (optional)</Label><Input id="ms-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                    <div className="space-y-1"><Label htmlFor="ms-region">Region (optional)</Label><Input id="ms-region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. British Columbia" /></div>
                  </div>
                </div>
              )}
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="ms-label">Survey name</Label><Input id="ms-label" value={label} onChange={(e) => setLabel(e.target.value)} required /></div>
              <div className="space-y-1"><Label htmlFor="ms-adults">Total adults (16+)</Label><Input id="ms-adults" type="number" min={16} value={adults} onChange={(e) => setAdults(e.target.value)} required /></div>
            </div>
            {tier && <p className="text-xs text-muted-foreground">Range: {tier.label}. Response limit: {tier.max === null ? "none" : tier.max}.</p>}

            <div className="space-y-2">
              <Label htmlFor="ms-method">Payment</Label>
              <select id="ms-method" className={selectClass} value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                <option value="stripe">Church pays by card (Stripe payment link)</option>
                <option value="offline">Paid outside Stripe (e-transfer, cheque)</option>
                <option value="complimentary">Complimentary (no charge)</option>
              </select>
            </div>
            {method !== "complimentary" && (
              <div className="grid gap-3 grid-cols-[1fr_7rem]">
                <div className="space-y-1"><Label htmlFor="ms-price">Price before tax</Label><Input id="ms-price" type="number" min={1} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
                <div className="space-y-1"><Label htmlFor="ms-currency">Currency</Label>
                  <select id="ms-currency" className={selectClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="cad">CAD</option><option value="usd">USD</option><option value="gbp">GBP</option><option value="eur">EUR</option>
                  </select>
                </div>
              </div>
            )}
            <div className="space-y-1"><Label htmlFor="ms-note">Internal note (optional, not shown to the church)</Label><Textarea id="ms-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Partner discount agreed with Pastor Sam" /></div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={emailChurch} onChange={(e) => setEmailChurch(e.target.checked)} />
              <span>Email the church now{mode === "new" ? " (includes a link to choose their password)" : ""}{method === "stripe" ? " with the payment link" : ""}</span>
            </label>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy} data-testid="button-manual-survey-submit">{busy ? "Adding…" : "Add survey"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
