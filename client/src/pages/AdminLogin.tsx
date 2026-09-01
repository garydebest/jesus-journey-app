import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JJLogo } from "@/lib/logo";
import { useAdminAuth } from "@/lib/adminAuth";

// Distinct login surface from the church account flow — different URL
// (/admin/login), different credential (an admin password from an env
// variable, not a church email/password), and a separate session/token
// space so admin access can never be confused with a church login.
export function AdminLogin() {
  const [, setLocation] = useLocation();
  const { token, login } = useAdminAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      setLocation("/admin");
    }
  }, [token, setLocation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(password);
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <JJLogo className="h-10 w-16" />
          <h1 className="text-xl font-semibold tracking-tight">Jesus Journey</h1>
          <p className="text-sm text-muted-foreground text-center">Administrator sign in</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Administrator access</CardTitle>
            <CardDescription>Sign in to view every church, monitor survey progress, and manage reports.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-admin-login">
              <div className="space-y-1.5">
                <Label htmlFor="admin-password">Admin password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  data-testid="input-admin-password"
                />
              </div>

              {error && (
                <Alert variant="destructive" data-testid="alert-admin-login-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading || !password} data-testid="button-admin-login">
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
