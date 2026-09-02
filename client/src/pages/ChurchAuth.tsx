import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JJLogo } from "@/lib/logo";
import { useChurchAuth } from "@/lib/churchAuth";

export function ChurchAuth() {
  const [, setLocation] = useLocation();
  const { token, signup, login } = useChurchAuth();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [password, setPassword] = useState("");

  // Navigate only once the auth context has actually committed the new
  // token, instead of navigating immediately after the async call resolves.
  // Navigating imperatively right after signup()/login() could race ahead of
  // the ChurchAuthProvider state update, causing ChurchDashboard's
  // `if (!token) setLocation("/church")` guard to bounce back here on the
  // first attempt (fixed by requiring a real, committed token before we
  // navigate at all).
  useEffect(() => {
    if (token) {
      setLocation("/dashboard");
    }
  }, [token, setLocation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }
        await signup({ name, primaryContactName: contactName, primaryContactEmail: email, primaryContactPhone: phone, region, password });
      } else {
        await login(email, password);
      }
      // Navigation happens in the effect above once `token` updates.
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
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-8">
          <JJLogo className="h-10 w-16" />
          <h1 className="text-xl font-semibold tracking-tight">Jesus Journey</h1>
          <p className="text-sm text-muted-foreground text-center">Church &amp; Group Survey Portal</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{mode === "signup" ? "Create your church account" : "Church sign in"}</CardTitle>
            <CardDescription>
              {mode === "signup"
                ? "Set up a free account to launch a survey and receive your aggregate report."
                : "Sign in to view your survey progress and reports."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-church-auth">
              {mode === "signup" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="church-name">Church or group name</Label>
                    <Input id="church-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-church-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-name">Primary contact name</Label>
                    <Input id="contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} required data-testid="input-contact-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="region">Region (optional)</Label>
                    <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. British Columbia" data-testid="input-region" />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-email" />
              </div>
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. (604) 555-0132" data-testid="input-phone" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} data-testid="input-password" />
                {mode === "signup" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
              </div>

              {error && (
                <Alert variant="destructive" data-testid="alert-auth-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit-auth">
                {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "signup" ? (
                <>
                  Already have an account?{" "}
                  <button className="text-primary underline underline-offset-2" onClick={() => { setMode("login"); setError(null); }} data-testid="link-switch-login">
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Need an account?{" "}
                  <button className="text-primary underline underline-offset-2" onClick={() => { setMode("signup"); setError(null); }} data-testid="link-switch-signup">
                    Create one
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center space-y-2">
          <div>
            <button
              className="text-sm text-muted-foreground underline underline-offset-2"
              onClick={() => setLocation("/")}
              data-testid="link-back-individual"
            >
              Just taking the survey for yourself? Start here
            </button>
          </div>
          <div>
            <a
              href="https://jesusjourney.life"
              className="text-sm text-muted-foreground underline underline-offset-2"
              data-testid="link-back-info-site"
            >
              ← Back to jesusjourney.life
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
