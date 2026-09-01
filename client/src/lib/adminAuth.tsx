import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AdminAuthState {
  token: string | null;
  login: (password: string) => Promise<void>;
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

  const login: AdminAuthState["login"] = useCallback(async (password) => {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
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

  return <AdminAuthContext.Provider value={{ token, login, logout }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}

// Authenticated fetch helper for admin-scoped API calls.
export async function adminApiRequest(token: string | null, method: string, url: string, body?: unknown) {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(text);
  }
  return res;
}

export async function adminApiRequestBlob(token: string | null, url: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(text);
  }
  return res.blob();
}
