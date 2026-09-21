// Isolated HTTP regression tests. No real database, payment or email access.
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { storage } from "../server/storage";
import { registerRoutes } from "../server/routes";
import { isParticipantDemoCode, PARTICIPANT_DEMO_CODE } from "../shared/participantDemo";

let storageCalls = 0;
for (const key of Object.keys(storage)) {
  if (typeof (storage as any)[key] === "function") {
    (storage as any)[key] = async () => {
      storageCalls++;
      throw Error("Unexpected storage access");
    };
  }
}
const app = express();
app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);
app.use((err: Error, _req: any, res: any, _next: any) => res.status(500).json({ message: err.message }));
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
try {
  for (const code of [PARTICIPANT_DEMO_CODE, "gracedemo", " GraceDemo "]) {
    assert(isParticipantDemoCode(code));
    const res = await fetch(`${base}/api/join/${encodeURIComponent(code)}`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).isDemo, true);
    const submit = await fetch(`${base}/api/responses`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode: code, items: { B1: 3 }, comment: "Synthetic practice" }),
    });
    assert.equal(submit.status, 403);
    assert.equal((await submit.json()).code, "PARTICIPANT_DEMO_READ_ONLY");
  }
  assert.equal(storageCalls, 0);
  for (const code of ["DEMOSAMPLE", "GRACE-CGGY", "GRACEDEMO2", "", null]) {
    assert.equal(isParticipantDemoCode(code), false);
  }
  // Verify normal wave lookup and closed/unpaid restrictions still follow the
  // real routes, not the reserved-code branch. Submission is browser-mocked.
  Object.assign(storage, {
    getWaveByJoinCode: async (code: string) => ({
      DEMOSAMPLE: { id: "closed", churchId: "fixture", status: "closed", paymentStatus: "paid" },
      UNPAID: { id: "unpaid", churchId: "fixture", status: "live", paymentStatus: "unpaid" },
      LIVE: { id: "live", churchId: "fixture", status: "live", paymentStatus: "paid", label: "Synthetic wave" },
    } as Record<string, any>)[code],
    getChurchById: async () => ({ name: "Synthetic church" }),
  });
  for (const [code, status] of [["DEMOSAMPLE", 410], ["UNPAID", 403], ["UNKNOWN", 404], ["LIVE", 200]] as const) {
    assert.equal((await fetch(`${base}/api/join/${code}`)).status, status);
  }
  console.log("PASS: demo metadata, case/whitespace handling, server rejection, zero demo storage calls, normal entry restrictions.");
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
