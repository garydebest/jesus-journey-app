import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JJLogo } from "@/lib/logo";
import { adminPublicPost, useAdminAuth } from "@/lib/adminAuth";

export function AdminConfirmEmail({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  const { logout } = useAdminAuth();
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [started, setStarted] = useState(false);

  // Requires a tap (not automatic) so email link scanners can't use the link up.
  async function confirm() {
    setStarted(true);
    try {
      await adminPublicPost("/api/admin/confirm-email", { token });
      logout();
      setState({ ok: true, message: "Your sign-in email has been changed. Please sign in again with the new address." });
    } catch (err: any) {
      setState({ ok: false, message: String(err?.message ?? err) });
    }
  }
  useEffect(() => setState(null), [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-8">
          <JJLogo className="h-10 w-16" />
          <h1 className="text-xl font-semibold tracking-tight">Jesus Journey</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Confirm your new sign-in email</CardTitle>
            <CardDescription>{state ? state.message : "Tap the button to finish changing the email you sign in with."}</CardDescription>
          </CardHeader>
          <CardContent>
            {state ? (
              <Button className="w-full" onClick={() => setLocation("/admin/login")} data-testid="button-admin-email-signin">Go to sign in</Button>
            ) : (
              <Button className="w-full" disabled={started} onClick={confirm} data-testid="button-admin-email-confirm">{started ? "Confirming..." : "Confirm new email"}</Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
