import { DEMO_CHURCH_ID } from "./surveyAccess";

// Public capability marker, NOT a password or a normal church session.
// Server-side allowlisting restricts it to the one published synthetic sample.
export const DASHBOARD_DEMO_TOKEN = "grace-dashboard-public-readonly-v1";
export const DASHBOARD_DEMO_WAVE_ID = "25fd5a3d-0b0a-4174-bb12-6fa36ffef1cc";
export const DASHBOARD_DEMO_ACCOUNT = {
  id: DEMO_CHURCH_ID,
  isDemo: true,
  name: "Grace Fellowship Community Church",
  communityCode: "DEMO",
  primaryContactName: "Demo contact",
  primaryContactEmail: "Sample dashboard · No sign-in required",
  primaryContactPhone: null,
  region: null,
};

// No wildcard routes, writes, payment-status reconciliation, contact details,
// admin APIs, or respondent data. Future endpoints remain denied by default.
const PUBLIC_DEMO_READ_PATHS = new Set([
  "/api/pricing",
  "/api/waves",
  `/api/waves/${DASHBOARD_DEMO_WAVE_ID}/report`,
  `/api/waves/${DASHBOARD_DEMO_WAVE_ID}/report.pdf`,
  `/api/waves/${DASHBOARD_DEMO_WAVE_ID}/comments-report.pdf`,
  `/api/waves/${DASHBOARD_DEMO_WAVE_ID}/pdf-link`,
]);

export function allowsDashboardDemoRequest(method: string, path: string): boolean {
  return (method === "GET" || method === "HEAD") && PUBLIC_DEMO_READ_PATHS.has(path);
}
