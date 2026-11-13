import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { apiRequest } from "./queryClient";
import { requestWithRetry, responseError, announceSignedOut, CHURCH_SIGNED_OUT_EVENT } from "./apiTransport";
import { DASHBOARD_DEMO_ACCOUNT, DASHBOARD_DEMO_TOKEN } from "@shared/dashboardDemo";

export interface ChurchAccount {
  isDemo?: boolean;
  id: string;
  name: string;
  communityCode: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string | null;
  region: string | null;
  surveyCoordinatorName?: string | null;
  surveyCoordinatorEmail?: string | null;
  leadPastorName?: string | null;
  leadPastorEmail?: string | null;
  leadPastorReceivesResults?: boolean;
  growthPlanInterestAt?: string | null;
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
  /** True after a sign-in ended on its own (expired or signed out elsewhere); cleared on the next sign-in. */
  sessionEnded: boolean;
}

const ChurchAuthContext = createContext<ChurchAuthState | undefined>(undefined);

// Token is held only in React state — never localStorage/cookies, which are
// blocked in the sandboxed preview iframe. Signing out or refreshing the page
// clears it, which is an acceptable tradeoff for this preview environment.
export function ChurchAuthProvider({ children, publicDemo = false }: { children: ReactNode; publicDemo?: boolean }) {
  const [token, setToken] = useState<string | null>(publicDemo ? DASHBOARD_DEMO_TOKEN : null);
  const [church, setChurch] = useState<ChurchAccount | null>(publicDemo ? DASHBOARD_DEMO_ACCOUNT : null);
  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => {
    if (publicDemo) return;
    const onEnded = () => { setToken((t) => { if (t) setSessionEnded(true); return null; }); setChurch(null); };
    window.addEventListener(CHURCH_SIGNED_OUT_EVENT, onEnded);
    return () => window.removeEventListener(CHURCH_SIGNED_OUT_EVENT, onEnded);
  }, [publicDemo]);

  const signup: ChurchAuthState["signup"] = useCallback(async (data) => {
    if (publicDemo) throw new Error("Exit the demo to create your own church account.");
    const res = await apiRequest("POST", "/api/churches/signup", data);
    const json = await res.json();
    setSessionEnded(false);
    setToken(json.token);
    setChurch(json.church);
  }, [publicDemo]);

  const login: ChurchAuthState["login"] = useCallback(async (email, password) => {
    if (publicDemo) throw new Error("Exit the demo to sign into your own church account.");
    const res = await apiRequest("POST", "/api/churches/login", { email, password });
    const json = await res.json();
    setSessionEnded(false);
    setToken(json.token);
    setChurch(json.church);
  }, [publicDemo]);

  const logout = useCallback(() => {
    if (token && !publicDemo) {
      churchApiRequest(token, "POST", "/api/churches/logout").catch(() => {});
    }
    setSessionEnded(false);
    setToken(null);
    setChurch(null);
  }, [token, publicDemo]);

  return (
    <ChurchAuthContext.Provider value={{ token, church, signup, login, logout, setChurch, sessionEnded }}>
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
  const res = await requestWithRetry(`${API_BASE}${url}`, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    if (res.status === 401 && token && token !== DASHBOARD_DEMO_TOKEN) announceSignedOut(CHURCH_SIGNED_OUT_EVENT);
    throw await responseError(res);
  }
  return res;
}
