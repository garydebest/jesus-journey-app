import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JJLogo } from "@/lib/logo";
import { adminPublicPost } from "@/lib/adminAuth";

const MIN = 12;

/** First-time account setup and "forgot password" both land here from an emailed link. */
export function AdminResetPassword({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  const [info, setInfo] = useState<{ valid: boolean; purpose?: "setup" | "reset"; name?: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    adminPublicPost("/api/admin/reset-password/check", { token }).then(setInfo).catch(() => setInfo({ valid: false }));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN) return setError(`Password must be at least ${MIN} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setLoading(true);
    try {
      await adminPublicPost("/api/admin/reset-password", { token, password });
      setDone(true);
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  const isSetup = info?.purpose === "setup";
  const first = (info?.name || "").split(/\s+/)[0];
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-8">
          <JJLogo className="h-10 w-16" />
          <h1 className="text-xl font-semibold tracking-tight">Jesus Journey</h1>
          <p className="text-sm text-muted-foreground text-center">Administrator account</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isSetup ? `Welcome${first ? `, ${first}` : ""}` : "Choose a new password"}</CardTitle>
            <CardDescription>
              {info === null
                ? "Checking your link..."
                : !info.valid
                  ? "This link is invalid, already used, or expired."
                  : done
                    ? "Your password is saved."
                    : isSetup
                      ? "Step 1 of 2: choose a password. Next you'll sign in and turn on two-factor sign-in."
                      : "Enter a new password for your administrator account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {info && !info.valid ? (
              <Button className="w-full" onClick={() => setLocation("/admin/login")} data-testid="button-admin-reset-invalid">Go to sign in to request a new link</Button>
            ) : done ? (
              <div className="space-y-4" data-testid="admin-reset-done">
                <p className="text-sm text-muted-foreground">
                  {isSetup
                    ? "Now sign in with your email and new password. You'll be shown how to add your account to an authenticator app such as Passwords on iPhone or iPad."
                    : "Sign in with your new password and your authenticator code. Any other signed-in devices were signed out."}
                </p>
                <Button className="w-full" onClick={() => setLocation("/admin/login")} data-testid="button-admin-reset-signin">Sign in</Button>
              </div>
            ) : info ? (
              <form onSubmit={submit} className="space-y-4" data-testid="form-admin-reset">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-new-password">New password</Label>
                  <Input id="admin-new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={MIN} autoFocus data-testid="input-admin-new-password" />
                  <p className="text-xs text-muted-foreground">At least {MIN} characters. On iPhone or iPad, choose "Use Strong Password" to have one created and saved for you.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-confirm-password">Confirm new password</Label>
                  <Input id="admin-confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required data-testid="input-admin-confirm-password" />
                </div>
                {error && (
                  <Alert variant="destructive" data-testid="alert-admin-reset-error"><AlertDescription>{error}</AlertDescription></Alert>
                )}
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-admin-reset-submit">{loading ? "Saving..." : "Save password"}</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
