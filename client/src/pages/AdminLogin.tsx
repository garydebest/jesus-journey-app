import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JJLogo } from "@/lib/logo";
import { useAdminAuth, adminPublicPost } from "@/lib/adminAuth";
import { RecoveryCodesPanel } from "@/components/admin/RecoveryCodesPanel";

// Administrator sign-in, separate from church accounts: each person signs in
// with their own email and password, then a 6-digit code from an
// authenticator app. The first sign-in walks them through adding the account
// to an authenticator and shows one-time recovery codes.

type Step =
  | { kind: "credentials" }
  | { kind: "forgot"; sent?: string }
  | { kind: "code"; challenge: string; name: string; useRecovery?: boolean }
  | { kind: "enroll"; challenge: string; name: string; email: string; secret: string; otpauthUrl: string; qrSvg: string }
  | { kind: "recovery"; token: string; codes: string[] }
  | { kind: "legacy" };

export function AdminLogin() {
  const [, setLocation] = useLocation();
  const { token, login, setSession } = useAdminAuth();
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token && step.kind !== "recovery") setLocation("/admin");
  }, [token, step.kind, setLocation]);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setLoading(true);
    try {
      await fn();
    } catch (err: any) {
      setError(String(err?.message ?? err).replace(/^\d+:\s*/, ""));
    } finally {
      setLoading(false);
    }
  }

  const submitCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await adminPublicPost("/api/admin/login", { email: email.trim(), password });
      setPassword("");
      setCode("");
      if (r.step === "enroll") setStep({ kind: "enroll", ...r });
      else setStep({ kind: "code", challenge: r.challenge, name: r.name });
    });
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (step.kind !== "code") return;
    run(async () => {
      const r = await adminPublicPost("/api/admin/login/code", { challenge: step.challenge, code: code.trim() });
      setSession(r.token);
    });
  };

  const submitEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (step.kind !== "enroll") return;
    run(async () => {
      const r = await adminPublicPost("/api/admin/login/enroll", { challenge: step.challenge, code: code.trim() });
      setStep({ kind: "recovery", token: r.token, codes: r.recoveryCodes });
    });
  };

  const submitForgot = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await adminPublicPost("/api/admin/forgot-password", { email: email.trim() });
      setStep({ kind: "forgot", sent: r.message });
    });
  };

  const submitLegacy = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      try {
        await login(username, password);
      } catch (err: any) {
        const msg = String(err?.message ?? err).replace(/^\d+:\s*/, "");
        let text = msg;
        try { text = JSON.parse(msg).message ?? msg; } catch {}
        throw new Error(text);
      }
    });
  };

  const back = () => {
    setError(null);
    setCode("");
    setStep({ kind: "credentials" });
  };

  // Tells Apple Passwords (and other password managers) which saved login this
  // code belongs to, so the code box is never treated as a new username.
  const hiddenUsername = (
    <input type="text" name="username" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
  );

  const codeInput = (label: string, recovery = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={recovery ? "admin-recovery-code" : "admin-otp"}>{label}</Label>
      <Input
        id={recovery ? "admin-recovery-code" : "admin-otp"}
        name={recovery ? "recovery-code" : "one-time-code"}
        type="text"
        inputMode={recovery ? "text" : "numeric"}
        autoComplete={recovery ? "off" : "one-time-code"}
        autoCapitalize="none"
        spellCheck={false}
        maxLength={recovery ? 20 : 7}
        placeholder={recovery ? "xxxxx-xxxxx" : "123456"}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        autoFocus
        className="text-lg tracking-widest"
        data-testid="input-admin-code"
      />
    </div>
  );

  let title = "Administrator sign in";
  let description = "Sign in with your own administrator email and password.";
  let body: JSX.Element;

  if (step.kind === "credentials") {
    body = (
      <form onSubmit={submitCredentials} className="space-y-4" data-testid="form-admin-login">
        <div className="space-y-1.5">
          <Label htmlFor="admin-email">Email</Label>
          <Input id="admin-email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus data-testid="input-admin-email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-password">Password</Label>
          <Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="input-admin-password" />
        </div>
        {error && <ErrorBox text={error} />}
        <Button type="submit" className="w-full" disabled={loading || !email || !password} data-testid="button-admin-login">
          {loading ? "Checking..." : "Continue"}
        </Button>
        <div className="flex flex-col items-center gap-2 pt-1">
          <button type="button" className="text-sm text-primary underline underline-offset-2" onClick={() => { setError(null); setStep({ kind: "forgot" }); }} data-testid="link-admin-forgot">
            Forgot your password, or setting up your account for the first time?
          </button>
          <button type="button" className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => { setError(null); setPassword(""); setStep({ kind: "legacy" }); }} data-testid="link-admin-legacy">
            Use the old shared admin login
          </button>
        </div>
      </form>
    );
  } else if (step.kind === "forgot") {
    title = "Get a password link";
    description = "Enter your administrator email. We'll send a link to set up your account or choose a new password.";
    body = step.sent ? (
      <div className="space-y-4" data-testid="admin-forgot-sent">
        <p className="text-sm text-muted-foreground">{step.sent}</p>
        <Button className="w-full" variant="outline" onClick={back}>Back to sign in</Button>
      </div>
    ) : (
      <form onSubmit={submitForgot} className="space-y-4" data-testid="form-admin-forgot">
        <div className="space-y-1.5">
          <Label htmlFor="admin-forgot-email">Email</Label>
          <Input id="admin-forgot-email" type="email" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus data-testid="input-admin-forgot-email" />
        </div>
        {error && <ErrorBox text={error} />}
        <Button type="submit" className="w-full" disabled={loading || !email} data-testid="button-admin-forgot">
          {loading ? "Sending..." : "Email me a link"}
        </Button>
        <div className="text-center"><button type="button" className="text-sm text-primary underline underline-offset-2" onClick={back}>Back to sign in</button></div>
      </form>
    );
  } else if (step.kind === "code") {
    title = `Welcome back, ${step.name.split(/\s+/)[0]}`;
    description = step.useRecovery ? "Enter one of your one-time recovery codes." : "Enter the 6-digit code from your authenticator app.";
    body = (
      <form onSubmit={submitCode} className="space-y-4" data-testid="form-admin-code">
        {hiddenUsername}
        {codeInput(step.useRecovery ? "Recovery code" : "Authentication code", !!step.useRecovery)}
        {!step.useRecovery && (
          <p className="text-xs text-muted-foreground">On iPhone or iPad, tap the box and choose the code suggested from Passwords, or open your authenticator app. Codes change every 30 seconds.</p>
        )}
        {error && <ErrorBox text={error} />}
        <Button type="submit" className="w-full" disabled={loading || !code.trim()} data-testid="button-admin-code">
          {loading ? "Checking..." : "Sign in"}
        </Button>
        <div className="flex flex-col items-center gap-2">
          <button type="button" className="text-sm text-primary underline underline-offset-2" onClick={() => { setCode(""); setError(null); setStep({ ...step, useRecovery: !step.useRecovery }); }} data-testid="link-admin-recovery">
            {step.useRecovery ? "Use my authenticator code instead" : "Lost your phone? Use a recovery code"}
          </button>
          <button type="button" className="text-xs text-muted-foreground underline underline-offset-2" onClick={back}>Start again</button>
        </div>
      </form>
    );
  } else if (step.kind === "enroll") {
    title = "Turn on two-factor sign-in";
    description = "One-time setup: add your account to an authenticator app, then enter the code it shows.";
    body = (
      <form onSubmit={submitEnroll} className="space-y-4" data-testid="form-admin-enroll">
        {hiddenUsername}
        <ol className="text-sm space-y-3 list-decimal pl-5">
          <li>
            <span className="font-medium">On this iPhone or iPad:</span> tap{" "}
            <a href={step.otpauthUrl} className="text-primary underline underline-offset-2" data-testid="link-admin-otpauth">Add to my authenticator</a>{" "}
            and choose Passwords (or your authenticator app) to save it.
          </li>
          <li>
            <span className="font-medium">On a computer:</span> scan this code with your phone's camera or authenticator app.
            <div className="mt-2 inline-block rounded-md border bg-white p-2" aria-label="QR code for your authenticator app">
              <img src={`data:image/svg+xml;utf8,${encodeURIComponent(step.qrSvg)}`} width={180} height={180} alt="QR code to add Jesus Journey Admin to an authenticator app" />
            </div>
          </li>
          <li>
            <span className="font-medium">Or type this key</span> into your authenticator app (account: {step.email}):
            <div className="mt-1 font-mono text-xs break-all rounded bg-muted px-2 py-1 select-all" data-testid="text-admin-secret">{step.secret.match(/.{1,4}/g)?.join(" ")}</div>
          </li>
        </ol>
        {codeInput("Enter the 6-digit code your app now shows")}
        {error && <ErrorBox text={error} />}
        <Button type="submit" className="w-full" disabled={loading || !code.trim()} data-testid="button-admin-enroll">
          {loading ? "Checking..." : "Turn on and sign in"}
        </Button>
        <div className="text-center"><button type="button" className="text-xs text-muted-foreground underline underline-offset-2" onClick={back}>Start again</button></div>
      </form>
    );
  } else if (step.kind === "recovery") {
    title = "Save your recovery codes";
    description = "Two-factor sign-in is on. If you ever lose your phone or iPad, each of these codes lets you sign in once.";
    body = (
      <RecoveryCodesPanel
        codes={step.codes}
        continueLabel="I've saved them — continue"
        onContinue={() => {
          setSession(step.token);
          setLocation("/admin");
        }}
      />
    );
  } else {
    title = "Shared admin login";
    description = "The old shared login works only until the owner finishes setting up their personal account.";
    body = (
      <form onSubmit={submitLegacy} className="space-y-4" data-testid="form-admin-legacy">
        <div className="space-y-1.5">
          <Label htmlFor="admin-username">Username</Label>
          <Input id="admin-username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus data-testid="input-admin-username" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-legacy-password">Password</Label>
          <Input id="admin-legacy-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="input-admin-legacy-password" />
        </div>
        {error && <ErrorBox text={error} />}
        <Button type="submit" className="w-full" disabled={loading || !username || !password} data-testid="button-admin-legacy">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
        <div className="text-center"><button type="button" className="text-sm text-primary underline underline-offset-2" onClick={back}>Back to personal sign-in</button></div>
      </form>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-8">
          <JJLogo className="h-10 w-16" />
          <h1 className="text-xl font-semibold tracking-tight">Jesus Journey</h1>
          <p className="text-sm text-muted-foreground text-center">Administrator sign in</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent key={step.kind + (step.kind === "code" && step.useRecovery ? "-recovery" : "")}>{body}</CardContent>
        </Card>
      </div>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <Alert variant="destructive" data-testid="alert-admin-login-error">
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}
