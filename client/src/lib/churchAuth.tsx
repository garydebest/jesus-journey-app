import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { apiRequest } from "./queryClient";

export interface ChurchAccount {
  id: string;
  name: string;
  communityCode: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string | null;
  region: string | null;
}

interface ChurchAuthState {
  token: string | null;
  church: ChurchAccount | null;
  signup: (data: {
    name: string;
    primaryContactName: string;
    primaryContactEmail: string;
    primaryContactPhone?: string;
    region?: string;
    password: string;
  }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setChurch: (church: ChurchAccount) => void;
}

const ChurchAuthContext = createContext<ChurchAuthState | undefined>(undefined);

// Token is held only in React state — never localStorage/cookies, which are
// blocked in the sandboxed preview iframe. Signing out or refreshing the page
// clears it, which is an acceptable tradeoff for this preview environment.
export function ChurchAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [church, setChurch] = useState<ChurchAccount | null>(null);

  const signup: ChurchAuthState["signup"] = useCallback(async (data) => {
    const res = await apiRequest("POST", "/api/churches/signup", data);
    const json = await res.json();
    setToken(json.token);
    setChurch(json.church);
  }, []);

  const login: ChurchAuthState["login"] = useCallback(async (email, password) => {
    const res = await apiRequest("POST", "/api/churches/login", { email, password });
    const json = await res.json();
    setToken(json.token);
    setChurch(json.church);
  }, []);

  const logout = useCallback(() => {
    if (token) {
      apiRequest("POST", "/api/churches/logout").catch(() => {});
    }
    setToken(null);
    setChurch(null);
  }, [token]);

  return (
    <ChurchAuthContext.Provider value={{ token, church, signup, login, logout, setChurch }}>
      {children}
    </ChurchAuthContext.Provider>
  );
}

export function useChurchAuth(): ChurchAuthState {
  const ctx = useContext(ChurchAuthContext);
  if (!ctx) throw new Error("useChurchAuth must be used within ChurchAuthProvider");
  return ctx;
}

// Authenticated fetch helper for church-scoped API calls.
export async function churchApiRequest(
  token: string | null,
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res;
}
