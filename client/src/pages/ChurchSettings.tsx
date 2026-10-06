import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JJBrandLockup } from "@/lib/logo";
import { useChurchAuth, churchApiRequest } from "@/lib/churchAuth";

export function ChurchSettings() {
  const [, setLocation] = useLocation();
  const { token, church, setChurch } = useChurchAuth();

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [coordName, setCoordName] = useState("");
  const [coordEmail, setCoordEmail] = useState("");
  const [pastorName, setPastorName] = useState("");
  const [pastorEmail, setPastorEmail] = useState("");
  const [pastorResults, setPastorResults] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) {
      setLocation("/church");
      return;
    }
  }, [token, setLocation]);

  useEffect(() => {
    if (church) {
      setName(church.name);
      setContactName(church.primaryContactName);
      setEmail(church.primaryContactEmail);
      setPhone(church.primaryContactPhone ?? "");
      setRegion(church.region ?? "");
      setCoordName(church.surveyCoordinatorName ?? "");
      setCoordEmail(church.surveyCoordinatorEmail ?? "");
      setPastorName(church.leadPastorName ?? "");
      setPastorEmail(church.leadPastorEmail ?? "");
      setPastorResults(!!church.leadPastorReceivesResults);
    }
  }, [church]);

  if (!token || !church) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await churchApiRequest(token, "PATCH", "/api/churches/me", {
        name,
        primaryContactName: contactName,
        primaryContactEmail: email,
        primaryContactPhone: phone,
        region,
        surveyCoordinatorName: coordName,
        surveyCoordinatorEmail: coordEmail,
        leadPastorName: pastorName,
        leadPastorEmail: pastorEmail,
        leadPastorReceivesResults: pastorResults && !!pastorEmail.trim(),
      });
      const json = await res.json();
      setChurch(json.church);
      setSaved(true);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      const cleaned = msg.replace(/^\d+:\s*/, "");
      try {
        const parsed = JSON.parse(cleaned);
        setError(parsed.message ?? cleaned);
      } catch {
        setError(cleaned);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <JJBrandLockup logoClassName="h-8 w-12" />
          <Button variant="outline" size="sm" onClick={() => setLocation("/dashboard")} data-testid="button-back-dashboard">
            Back to dashboard
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto px-4 py-10 w-full">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Account settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update your church name and contact details. This is who we'll reach out to about your surveys and reports.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact information</CardTitle>
            <CardDescription>Your join code and password are managed separately and are not shown here.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-church-settings">
              <div className="space-y-1.5">
                <Label htmlFor="settings-church-name">Church or group name</Label>
                <Input id="settings-church-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-settings-church-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-contact-name">Primary contact name</Label>
                <Input id="settings-contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} required data-testid="input-settings-contact-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-email">Email</Label>
                <Input id="settings-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-settings-email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-phone">Phone (optional)</Label>
                <Input id="settings-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. (604) 555-0132" data-testid="input-settings-phone" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-region">Region (optional)</Label>
                <Input id="settings-region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. British Columbia" data-testid="input-settings-region" />
              </div>

              <fieldset className="space-y-4 rounded-lg border p-4" data-testid="fieldset-survey-contacts">
                <legend className="px-1 text-sm font-semibold">Survey contacts</legend>
                <p className="text-xs text-muted-foreground -mt-2">The Survey Coordinator receives preparation, launch, participation and closing emails, with the primary contact copied. Each person receives their own email.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-coord-name">Survey Coordinator name</Label>
                    <Input id="settings-coord-name" value={coordName} onChange={(e) => setCoordName(e.target.value)} data-testid="input-settings-coord-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-coord-email">Survey Coordinator email</Label>
                    <Input id="settings-coord-email" type="email" value={coordEmail} onChange={(e) => setCoordEmail(e.target.value)} data-testid="input-settings-coord-email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-pastor-name">Lead pastor name</Label>
                    <Input id="settings-pastor-name" value={pastorName} onChange={(e) => setPastorName(e.target.value)} data-testid="input-settings-pastor-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settings-pastor-email">Lead pastor email</Label>
                    <Input id="settings-pastor-email" type="email" value={pastorEmail} onChange={(e) => setPastorEmail(e.target.value)} data-testid="input-settings-pastor-email" />
                  </div>
                </div>
                <label htmlFor="settings-pastor-results" className="flex items-start gap-3 text-sm cursor-pointer">
                  <input id="settings-pastor-results" type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={pastorResults} onChange={(e) => setPastorResults(e.target.checked)} disabled={!pastorEmail.trim()} data-testid="checkbox-pastor-results" />
                  <span>The lead pastor should receive the “results are ready” email</span>
                </label>
              </fieldset>

              {error && (
                <Alert variant="destructive" data-testid="alert-settings-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {saved && !error && (
                <Alert data-testid="alert-settings-saved">
                  <AlertDescription>Your contact information has been updated.</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={saving} data-testid="button-save-settings">
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
