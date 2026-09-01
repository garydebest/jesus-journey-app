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
