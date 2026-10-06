import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JJLogo } from "@/lib/logo";
import { useChurchAuth, churchApiRequest } from "@/lib/churchAuth";
import { friendlyError } from "@/lib/friendlyError";

export function ChurchAuth({ initialMode = "login" }: { initialMode?: "login" | "signup" }) {
  const [, setLocation] = useLocation();
  const { token, signup, login } = useChurchAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [notice, setNotice] = useState<string | null>(null);
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
    setNotice(null);
    setLoading(true);
    try {
      if (mode === "forgot") {
        const res = await churchApiRequest(null, "POST", "/api/churches/forgot-password", { email });
        const json = await res.json();
        setNotice(json.message ?? "If an account uses that email, we've sent a link to reset the password.");
        return;
      }
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
      setError(friendlyError(err));
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
            <CardTitle className="text-lg">{mode === "signup" ? "Create your church account" : mode === "forgot" ? "Reset your password" : "Church sign in"}</CardTitle>
            <CardDescription>
              {mode === "signup"
                ? "Create a free account to explore a survey plan. A separate purchase is required to activate each survey."
                : mode === "forgot"
                ? "Enter the email you sign in with. We'll email you a link to choose a new password."
                : "Use your existing email and password to review reports, plan dates, or manage a purchased survey. Your login stays the same for every survey."}
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
                <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-email" />
              </div>
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. (604) 555-0132" data-testid="input-phone" />
                </div>
              )}
              {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="password">Password</Label>
                  {mode === "login" && (
                    <button type="button" className="text-xs text-primary underline underline-offset-2" onClick={() => { setMode("forgot"); setError(null); setNotice(null); }} data-testid="link-forgot-password">
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "signup" ? 8 : undefined} data-testid="input-password" />
                {mode === "signup" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
              </div>
              )}

              {error && (
                <Alert variant="destructive" data-testid="alert-auth-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {notice && (
                <Alert data-testid="alert-auth-notice">
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit-auth">
                {loading ? "Please wait..." : mode === "signup" ? "Create account" : mode === "forgot" ? "Email me a reset link" : "Sign in"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "forgot" ? (
                <button className="text-primary underline underline-offset-2" onClick={() => { setMode("login"); setError(null); setNotice(null); }} data-testid="link-forgot-back">
                  Back to sign in
                </button>
              ) : mode === "signup" ? (
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
