import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JJLogo } from "@/lib/logo";
import { churchApiRequest } from "@/lib/churchAuth";
import { friendlyError } from "@/lib/friendlyError";

export function ResetPassword({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setLoading(true);
    try {
      await churchApiRequest(null, "POST", "/api/churches/reset-password", { token, password });
      setDone(true);
    } catch (err) {
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
            <CardTitle className="text-lg">Choose a new password</CardTitle>
            <CardDescription>{done ? "Your password has been changed." : "Enter a new password for your church account."}</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="space-y-4" data-testid="reset-password-done">
                <p className="text-sm text-muted-foreground">You can now sign in with your new password. For security, any other signed-in devices have been signed out.</p>
                <Button className="w-full" onClick={() => setLocation("/church/login")} data-testid="button-reset-to-login">Sign in</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-reset-password">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-password">New password</Label>
                  <Input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus data-testid="input-reset-password" />
                  <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-confirm">Confirm new password</Label>
                  <Input id="reset-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required data-testid="input-reset-confirm" />
                </div>
                {error && (
                  <Alert variant="destructive" data-testid="alert-reset-error">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-reset-submit">
                  {loading ? "Saving..." : "Save new password"}
                </Button>
                <div className="text-center">
                  <button type="button" className="text-sm text-primary underline underline-offset-2" onClick={() => setLocation("/church/login")} data-testid="link-reset-back">Back to sign in</button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
