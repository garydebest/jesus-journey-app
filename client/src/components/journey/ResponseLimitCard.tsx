import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApiRequest } from "@/lib/adminAuth";

// Owner-only control for a survey's response limit. The church never sees
// this; its dashboard just shows the limit that applies.
export interface ResponseLimitWave {
  id: string; status: string;
  responseLimit?: number | null;          // limit in force right now
  planResponseLimit?: number | null;      // limit of the purchased tier
  responseLimitOverride?: number | null;  // null = plan, 0 = no limit, n = custom
}

type Mode = "plan" | "custom" | "none";
const modeOf = (o: number | null | undefined): Mode => o === null || o === undefined ? "plan" : o === 0 ? "none" : "custom";
const describe = (n: number | null | undefined) => n === null || n === undefined ? "No limit" : `${n.toLocaleString()} responses`;
const errMessage = (err: any) => {
  const raw = String(err?.message ?? err).replace(/^\d+:\s*/, "");
  try { return JSON.parse(raw).message ?? raw; } catch { return raw; }
};

export function ResponseLimitCard({ token, wave, responseCount, isDemo, onChanged }: {
  token: string; wave: ResponseLimitWave; responseCount: number; isDemo: boolean; onChanged: (w: ResponseLimitWave) => void;
}) {
  const [mode, setMode] = useState<Mode>(modeOf(wave.responseLimitOverride));
  const [custom, setCustom] = useState(wave.responseLimitOverride ? String(wave.responseLimitOverride) : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const closed = wave.status === "closed";
  const customNumber = Number(custom);
  const customValid = Number.isInteger(customNumber) && customNumber >= 1 && customNumber <= 100000;
  const unchanged = mode === modeOf(wave.responseLimitOverride) && (mode !== "custom" || customNumber === wave.responseLimitOverride);
  const belowCount = mode === "custom" && customValid && customNumber <= responseCount;

  async function save() {
    setBusy(true); setMessage(null);
    try {
      const res = await adminApiRequest(token, "PATCH", `/api/admin/waves/${wave.id}/response-limit`, mode === "custom" ? { mode, limit: customNumber } : { mode });
      const json = await res.json();
      onChanged(json.wave);
      setMessage(`Saved. The limit is now ${describe(json.wave.responseLimit).toLowerCase()}. It applies straight away.`);
    } catch (err) { setMessage(errMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-2 border-t pt-4" data-testid="response-limit-card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Response limit</h3>
        <span className="text-xs text-muted-foreground">Owner only</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">Plan limit</span><span>{describe(wave.planResponseLimit)}</span></div>
      <div className="flex items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">Limit in force</span>
        <span data-testid="text-effective-limit">{describe(wave.responseLimit)}{wave.responseLimitOverride !== null && wave.responseLimitOverride !== undefined ? " (override)" : ""}</span></div>
      {closed ? <p className="text-xs text-muted-foreground">This survey is closed, so its limit can no longer change.</p> : <>
        <fieldset className="space-y-1 text-sm" disabled={isDemo || busy}>
          <legend className="sr-only">Response limit</legend>
          <label className="flex items-center gap-2"><input type="radio" name={`limit-${wave.id}`} checked={mode === "plan"} onChange={() => setMode("plan")} data-testid="radio-limit-plan" /> Use the plan limit</label>
          <label className="flex items-center gap-2"><input type="radio" name={`limit-${wave.id}`} checked={mode === "custom"} onChange={() => setMode("custom")} data-testid="radio-limit-custom" /> Custom limit</label>
          {mode === "custom" && (
            <div className="pl-6 space-y-1">
              <Label htmlFor={`limit-input-${wave.id}`} className="text-xs">Maximum responses</Label>
              <Input id={`limit-input-${wave.id}`} type="number" inputMode="numeric" min={1} max={100000} value={custom} onChange={(e) => setCustom(e.target.value)} className="w-40" data-testid="input-limit-custom" />
            </div>
          )}
          <label className="flex items-center gap-2"><input type="radio" name={`limit-${wave.id}`} checked={mode === "none"} onChange={() => setMode("none")} data-testid="radio-limit-none" /> No limit</label>
        </fieldset>
        {belowCount && <p className="text-xs text-amber-700 dark:text-amber-400">This survey already has {responseCount} responses. They will be kept, but no new responses will be accepted.</p>}
        <Button size="sm" variant="outline" disabled={isDemo || busy || unchanged || (mode === "custom" && !customValid)} onClick={save} data-testid="button-save-limit">Save limit</Button>
      </>}
      {message && <p className="text-sm" role="status">{message}</p>}
    </div>
  );
}
