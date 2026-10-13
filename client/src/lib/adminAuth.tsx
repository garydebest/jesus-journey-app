import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { requestWithRetry, responseError } from "./apiTransport";

interface AdminAuthState {
  token: string | null;
  /** Legacy shared login (username + password). Personal accounts use the step-by-step flow on the sign-in page. */
  login: (username: string, password: string) => Promise<void>;
  /** Stores a session token returned by a completed sign-in or password change. */
  setSession: (token: string) => void;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthState | undefined>(undefined);

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// Separate token/session space from church auth. Held only in React state —
// never localStorage/cookies, which are blocked in the sandboxed preview
// iframe. Signing out or refreshing the page clears it, an acceptable
// tradeoff for this preview environment.
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  const login: AdminAuthState["login"] = useCallback(async (username, password) => {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(text);
    }
    const json = await res.json();
    setToken(json.token);
  }, []);

  const logout = useCallback(() => {
    if (token) {
      fetch(`${API_BASE}/api/admin/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setToken(null);
  }, [token]);

  const setSession = useCallback((t: string) => setToken(t), []);

  return <AdminAuthContext.Provider value={{ token, login, setSession, logout }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}

/** Unauthenticated JSON POST for the sign-in, setup and reset steps. Throws with the server's message. */
export async function adminPublicPost<T = any>(url: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.message || res.statusText || "Something went wrong. Please try again.");
  return json as T;
}

// Authenticated fetch helper for admin-scoped API calls.
export async function adminApiRequest(token: string | null, method: string, url: string, body?: unknown) {
  const res = await requestWithRetry(`${API_BASE}${url}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw await responseError(res);
  }
  return res;
}

export async function adminApiRequestBlob(token: string | null, url: string): Promise<Blob> {
  const res = await requestWithRetry(`${API_BASE}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw await responseError(res);
  }
  return res.blob();
}
