import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { JJLogo } from "@/lib/logo";
import { adminApiRequest, useAdminAuth } from "@/lib/adminAuth";
import { friendlyError } from "@/lib/friendlyError";
import { RecoveryCodesPanel } from "@/components/admin/RecoveryCodesPanel";

interface Profile {
  legacy?: boolean;
  id?: string;
  name: string;
  email?: string;
  role: "owner" | "admin";
  twoFactorEnabled?: boolean;
  recoveryCodesRemaining?: number;
  lastSignInAt?: string | null;
}
interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin";
  status: string;
  twoFactorEnabled: boolean;
  lastSignInAt: string | null;
}
interface Activity { at: string; who: string; action: string; detail: string | null }

const when = (s?: string | null) => (s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never");

function Note({ kind, text }: { kind: "ok" | "error"; text: string }) {
  return (
    <Alert variant={kind === "error" ? "destructive" : "default"} data-testid={`note-${kind}`}>
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}

export function AdminAccount() {
  const [, setLocation] = useLocation();
  const { token, setSession, logout } = useAdminAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Member[] | null>(null);
  const [activity, setActivity] = useState<Activity[] | null>(null);

  useEffect(() => {
    if (!token) setLocation("/admin/login");
  }, [token, setLocation]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const p: Profile = await (await adminApiRequest(token, "GET", "/api/admin/me")).json();
      setProfile(p);
      if (p.role === "owner") {
        const [t, a] = await Promise.all([
          adminApiRequest(token, "GET", "/api/admin/team").then((r) => r.json()),
          adminApiRequest(token, "GET", "/api/admin/activity").then((r) => r.json()),
        ]);
        setTeam(t.team);
        setActivity(a.activity);
      }
    } catch (err) {
      if (String((err as any)?.message ?? "").startsWith("401")) {
        logout();
        setLocation("/admin/login");
      }
    }
  }, [token, logout, setLocation]);
  useEffect(() => { load(); }, [load]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <JJLogo className="h-8 w-12" />
            <div>
              <div className="text-sm font-semibold">My account</div>
              <div className="text-xs text-muted-foreground">{profile?.legacy ? "Shared admin login" : profile ? `${profile.name} · ${profile.email}` : ""}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLocation("/admin")} data-testid="button-account-back">Back to overview</Button>
            <Button variant="outline" size="sm" onClick={() => { logout(); setLocation("/admin/login"); }} data-testid="button-account-signout">Sign out</Button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {profile?.legacy ? (
          <Note kind="ok" text="You're signed in with the old shared admin login. Add each person below and they'll be emailed a setup link. The shared login stops working as soon as an owner finishes setting up two-factor sign-in on their personal account." />
        ) : profile ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sign-in and security</CardTitle>
                <CardDescription>
                  Two-factor sign-in is {profile.twoFactorEnabled ? "on" : "off"} · {profile.recoveryCodesRemaining ?? 0} recovery codes left · last sign-in {when(profile.lastSignInAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-8 md:grid-cols-2">
                <ChangePassword token={token} onToken={setSession} />
                <ChangeEmail token={token} />
              </CardContent>
            </Card>
            <NewRecoveryCodes token={token} onDone={load} />
          </>
        ) : null}

        {profile?.role === "owner" && team && (
          <TeamCard token={token} team={team} selfId={profile.id} onChanged={load} />
        )}
        {profile?.role === "owner" && activity && <ActivityCard activity={activity} />}
      </main>
    </div>
  );
}

function ChangePassword({ token, onToken }: { token: string; onToken: (t: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    if (next.length < 12) return setNote({ kind: "error", text: "New password must be at least 12 characters." });
    if (next !== confirm) return setNote({ kind: "error", text: "The two new passwords don't match." });
    setBusy(true);
    try {
      const r = await (await adminApiRequest(token, "POST", "/api/admin/me/password", { currentPassword: current, newPassword: next })).json();
      onToken(r.token);
      setCurrent(""); setNext(""); setConfirm("");
      setNote({ kind: "ok", text: "Password changed. Other signed-in devices were signed out." });
    } catch (err) {
      setNote({ kind: "error", text: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3" data-testid="form-change-password">
      <h3 className="text-sm font-semibold">Change password</h3>
      <div className="space-y-1.5"><Label htmlFor="cp-current">Current password</Label><Input id="cp-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label htmlFor="cp-new">New password (12+ characters)</Label><Input id="cp-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label htmlFor="cp-confirm">Confirm new password</Label><Input id="cp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
      {note && <Note {...note} />}
      <Button type="submit" disabled={busy} data-testid="button-change-password">{busy ? "Saving..." : "Change password"}</Button>
    </form>
  );
}

function ChangeEmail({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    setBusy(true);
    try {
      await adminApiRequest(token, "POST", "/api/admin/me/email", { newEmail: email, currentPassword: current });
      setCurrent("");
      setNote({ kind: "ok", text: `We've sent a confirmation link to ${email}. Your sign-in email changes when you open it.` });
    } catch (err) {
      setNote({ kind: "error", text: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3" data-testid="form-change-email">
      <h3 className="text-sm font-semibold">Change sign-in email</h3>
      <div className="space-y-1.5"><Label htmlFor="ce-email">New email</Label><Input id="ce-email" type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label htmlFor="ce-current">Current password</Label><Input id="ce-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></div>
      {note && <Note {...note} />}
      <Button type="submit" disabled={busy} data-testid="button-change-email">{busy ? "Sending..." : "Send confirmation link"}</Button>
    </form>
  );
}

function NewRecoveryCodes({ token, onDone }: { token: string; onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    setBusy(true);
    try {
      const r = await (await adminApiRequest(token, "POST", "/api/admin/me/recovery-codes", { currentPassword: current })).json();
      setCurrent("");
      setCodes(r.recoveryCodes);
    } catch (err) {
      setNote(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recovery codes</CardTitle>
        <CardDescription>Create a fresh set if you've used some or think they've been seen. Your old codes stop working.</CardDescription>
      </CardHeader>
      <CardContent>
        {codes ? (
          <div className="max-w-md"><RecoveryCodesPanel codes={codes} continueLabel="Done" onContinue={() => { setCodes(null); onDone(); }} /></div>
        ) : (
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3" data-testid="form-new-recovery">
            <div className="space-y-1.5"><Label htmlFor="rc-current">Current password</Label><Input id="rc-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></div>
            <Button type="submit" variant="outline" disabled={busy} data-testid="button-new-recovery">{busy ? "Creating..." : "Create new recovery codes"}</Button>
            {note && <div className="w-full"><Note kind="error" text={note} /></div>}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function TeamCard({ token, team, selfId, onChanged }: { token: string; team: Member[]; selfId?: string; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "owner">("admin");
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(m: Member, action: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setNote(null);
    setBusy(m.id + action);
    try {
      const r = await (await adminApiRequest(token, "POST", `/api/admin/team/${m.id}/${action}`)).json();
      const sent = r.emailSent === false ? " The email could not be sent; check the mail settings." : "";
      const msg: Record<string, string> = {
        "send-link": `Sent ${m.status === "invited" ? "a setup" : "a password"} link to ${m.email}.${sent}`,
        "reset-two-factor": `Two-factor sign-in was reset for ${m.name}. They'll set it up again at their next sign-in.`,
        remove: `${m.name}'s access was removed and they were signed out.`,
        restore: `${m.name}'s access was restored.`,
      };
      setNote({ kind: sent ? "error" : "ok", text: msg[action] ?? "Done." });
      onChanged();
    } catch (err) {
      setNote({ kind: "error", text: friendlyError(err) });
    } finally {
      setBusy(null);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    setBusy("add");
    try {
      const r = await (await adminApiRequest(token, "POST", "/api/admin/team", { name, email, role })).json();
      setNote({ kind: r.emailSent ? "ok" : "error", text: r.emailSent ? `Added ${name}. A setup link was emailed to ${email}.` : `Added ${name}, but the setup email could not be sent. Use "Send setup link" once mail is working.` });
      setName(""); setEmail(""); setRole("admin");
      onChanged();
    } catch (err) {
      setNote({ kind: "error", text: friendlyError(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Administrator team</CardTitle>
        <CardDescription>Everyone signs in with their own email, password and authenticator code. Only owners can see this section.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="divide-y rounded-md border" data-testid="list-admin-team">
          {team.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-3" data-testid={`row-admin-${m.email}`}>
              <div className="min-w-0">
                <div className="text-sm font-medium">{m.name} {m.id === selfId && <span className="text-muted-foreground font-normal">(you)</span>}</div>
                <div className="text-xs text-muted-foreground break-all">{m.email} · last sign-in {when(m.lastSignInAt)}</div>
                <div className="mt-1 flex gap-1.5">
                  <Badge variant="outline">{m.role === "owner" ? "Owner" : "Administrator"}</Badge>
                  <Badge variant={m.status === "active" ? "secondary" : "outline"}>{m.status}</Badge>
                </div>
              </div>
              {m.id !== selfId && (
                <div className="flex flex-wrap gap-2">
                  {m.status !== "removed" && (
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(m, "send-link")}>{m.status === "invited" ? "Send setup link" : "Send password reset"}</Button>
                  )}
                  {m.twoFactorEnabled && m.status !== "removed" && (
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(m, "reset-two-factor", `Reset two-factor sign-in for ${m.name}? Use this if they lost their phone. They'll set it up again at their next sign-in.`)}>Reset two-factor</Button>
                  )}
                  {m.status === "removed" ? (
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(m, "restore")}>Restore access</Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(m, "remove", `Remove ${m.name}'s administrator access? They'll be signed out immediately.`)}>Remove access</Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {note && <Note {...note} />}
        <form onSubmit={add} className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end" data-testid="form-add-admin">
          <div className="space-y-1.5"><Label htmlFor="add-name">Name</Label><Input id="add-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label htmlFor="add-email">Email</Label><Input id="add-email" type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-1.5">
            <Label htmlFor="add-role">Role</Label>
            <select id="add-role" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as "admin" | "owner")}>
              <option value="admin">Administrator</option>
              <option value="owner">Owner (can manage the team)</option>
            </select>
          </div>
          <Button type="submit" disabled={busy === "add"} data-testid="button-add-admin">{busy === "add" ? "Adding..." : "Add and send setup link"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ActivityCard({ activity }: { activity: Activity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
        <CardDescription>Sign-ins, account changes, and every administrator action on church surveys (latest 200).</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-admin-activity">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1 pr-3">When</th><th className="py-1 pr-3">Who</th><th className="py-1 pr-3">What</th><th className="py-1">Details</th></tr></thead>
              <tbody>
                {activity.map((a, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{when(a.at)}</td>
                    <td className="py-1.5 pr-3">{a.who}</td>
                    <td className="py-1.5 pr-3">{a.action}</td>
                    <td className="py-1.5 text-muted-foreground">{a.detail ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
