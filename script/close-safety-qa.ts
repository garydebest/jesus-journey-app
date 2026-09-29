// Isolated database + local storage emulator ONLY. No payment or customer data.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import WebSocket from "ws";
import { eq, sql } from "drizzle-orm";
import { ITEM_CODES, surveyWaves, responses, aggregateSnapshots, debriefingReports } from "../shared/schema";
import { SHORT_FORM_CODES } from "../shared/shortForm";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/jj_preview");
const objects = new Map<string, Buffer>();
let storageFailure = "";
const objectServer = createServer(async (req, res) => {
  const key = req.url!.split("/church-reports/")[1]?.split("?")[0];
  if (req.method === "POST" || req.method === "PUT") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    if (storageFailure && key?.endsWith(storageFailure)) {
      res.writeHead(503, {"Content-Type":"application/json"});
      return res.end(JSON.stringify({message:"Synthetic upload failure",error:"Unavailable",statusCode:503}));
    }
    objects.set(key!, Buffer.concat(chunks));
    res.writeHead(200, {"Content-Type":"application/json"});
    return res.end(JSON.stringify({Key:`church-reports/${key}`}));
  }
  const data = objects.get(key!);
  res.writeHead(data ? 200 : 404, {"Content-Type":"application/pdf"});
  res.end(storageFailure === "corrupt-download" ? Buffer.from("%PDF-corrupt") : data);
});
await new Promise<void>(resolve => objectServer.listen(0, "127.0.0.1", resolve));
process.env.SUPABASE_URL = `http://127.0.0.1:${(objectServer.address() as any).port}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-local-storage-emulator-only";
// The QA sandbox runs Node 20; the Supabase SDK expects Node 22's native WebSocket.
if (!globalThis.WebSocket) (globalThis as any).WebSocket = WebSocket;
const { db, storage } = await import("../server/storage");
const { closeSurvey, saveChurchResponse } = await import("../server/closeSurvey");
const good = {
  church: async () => ({ok:true,storageKey:"synthetic.pdf",commentsStorageKey:"synthetic-comments.pdf"}),
  debrief: async () => ({ok:true,storageKey:"synthetic-debrief.pdf"}),
};
const shortMode = process.env.JJ_QA_VARIANT === "short";
const mixedMode = process.env.JJ_QA_VARIANT === "mixed";
const fixtureCount = mixedMode ? 10 : 8;
const answer = (i = 0, comments = true) => ({
  ...Object.fromEntries(ITEM_CODES.map((key,index)=>[key,(shortMode || (mixedMode && i < 5)) && !SHORT_FORM_CODES.includes(key.toUpperCase()) ? null : 1+(index+i)%5])),
  journeyPre:shortMode || (mixedMode && i < 5) ? 1 : 3, journeyPost:4, spiritualChange:2, gender:i%2 ? "Male" : "Female",
  ageGroup:"30-39", commentText:comments ? "Synthetic QA comment only" : null,
});
async function fixture(comments = true) {
  const id = `qa-safety-${randomUUID()}`;
  await db.insert(surveyWaves).values({
    id, churchId:"preview-paid",label:"SYNTHETIC REPORT SAFETY TEST",joinCode:id,
    status:"live",paymentStatus:"paid",minSampleSize:16,opensAt:"2026-09-18",
  });
  for (let i=0;i<fixtureCount;i++) await saveChurchResponse(id, answer(i,comments));
  return id;
}
async function retained(id: string, count = fixtureCount) {
  assert.equal(await storage.countResponsesByWave(id),count);
  const wave = await storage.getWaveById(id);
  assert.equal(wave?.status,"live");
  assert.equal(wave?.reportGeneratedAt,null);
  assert.equal(wave?.closedAt,null);
  assert.equal(await storage.getSnapshotByWave(id),undefined);
  assert.equal(await storage.getDebriefingReportByWave(id),undefined);
}
const results: string[] = [];
async function check(name: string, fn: () => Promise<void>) {
  await fn(); results.push(name); console.log("PASS", name);
}
try {
  await check("generation exceptions retain all data", async () => {
    const id=await fixture();
    await assert.rejects(closeSurvey(id,false,{...good,church:async()=>{throw new Error("Synthetic renderer crash");}}),{status:503});
    await retained(id);
  });
  await check("missing church PDF and comments PDF prevent church/admin closure", async () => {
    for (const force of [false,true]) {
      for (const result of [{ok:false,error:"Synthetic failure"},{ok:true},{ok:true,storageKey:"church.pdf"}]) {
        const id=await fixture();
        await assert.rejects(closeSurvey(id,force,{...good,church:async()=>result}),{status:503});
        await retained(id);
      }
    }
  });
  await check("debriefing failure retains responses and creates no partial snapshot", async () => {
    const id=await fixture();
    await assert.rejects(closeSurvey(id,false,{...good,debrief:async()=>({ok:false,error:"Synthetic debrief failure"})}),{status:503});
    await retained(id);
  });
  await check("late database failure rolls back metadata, closure and deletion", async () => {
    const id=await fixture();
    await db.execute(sql.raw(`CREATE OR REPLACE FUNCTION qa_block_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.wave_id = '${id}' THEN RAISE EXCEPTION 'Synthetic database failure'; END IF; RETURN OLD; END $$`));
    await db.execute(sql.raw("CREATE TRIGGER qa_block_delete BEFORE DELETE ON responses FOR EACH ROW EXECUTE FUNCTION qa_block_delete()"));
    try {
      await assert.rejects(closeSurvey(id,false,good),{status:503});
      await retained(id);
    } finally {
      await db.execute(sql.raw("DROP TRIGGER qa_block_delete ON responses"));
      await db.execute(sql.raw("DROP FUNCTION qa_block_delete()"));
    }
  });
  await check("duplicate closing and late submission cannot lose unreported data", async () => {
    const id=await fixture();
    let unblock!:()=>void, entered!:()=>void;
    const gate=new Promise<void>(resolve=>{unblock=resolve;});
    const ready=new Promise<void>(resolve=>{entered=resolve;});
    const first=closeSurvey(id,false,{...good,church:async()=>{entered();await gate;return good.church();}});
    await ready;
    const second=closeSurvey(id,true,good);
    const late=saveChurchResponse(id,answer());
    const secondCheck=assert.rejects(second,{status:409});
    const lateCheck=assert.rejects(late,{status:410});
    unblock();
    await first; await secondCheck; await lateCheck;
    assert.equal(await storage.countResponsesByWave(id),0);
    assert.equal((await db.select().from(aggregateSnapshots).where(eq(aggregateSnapshots.waveId,id))).length,1);
    assert.equal((await db.select().from(debriefingReports).where(eq(debriefingReports.waveId,id))).length,1);
  });
  await check("real Python reports: comments upload failure retains all responses", async () => {
    const id=await fixture(); storageFailure="-comments.pdf";
    await assert.rejects(closeSurvey(id),{status:503});
    await retained(id); storageFailure="";
    await closeSurvey(id);
    assert.equal((await storage.getWaveById(id))?.status,"closed");
    assert.equal(await storage.countResponsesByWave(id),0);
    const snapshot=await storage.getSnapshotByWave(id);
    const debrief=await storage.getDebriefingReportByWave(id);
    if (shortMode || mixedMode) {
      const summary = JSON.parse(snapshot!.summaryJson);
      assert.equal(summary.cohortReporting.version, 1);
      assert.deepEqual(summary.pathwayAverages, []);
      assert.equal(summary.cohortReporting.cohorts[1].pathways.length, 15);
      const analysis = JSON.parse(debrief!.reportJson);
      assert(analysis.analysisScope);
      assert.equal(analysis.respondentCount, shortMode ? 0 : 5);
    }
    for(const key of [snapshot!.reportPdfPath,snapshot!.commentsReportPdfPath,debrief!.reportPdfPath]){
      assert.ok(objects.get(key!)?.subarray(0,5).equals(Buffer.from("%PDF-")));
    }
  });
  await check("real Python reports: debrief upload failure retains all responses", async () => {
    const id=await fixture(); storageFailure="-debrief.pdf";
    await assert.rejects(closeSurvey(id,true),{status:503});
    await retained(id); storageFailure="";
  });
  await check("read-back corruption prevents closure", async () => {
    const id=await fixture(); storageFailure="corrupt-download";
    await assert.rejects(closeSurvey(id),{status:503});
    await retained(id); storageFailure="";
  });
  await check("no-comments wave closes without requiring a comments PDF", async () => {
    const id=await fixture(false); await closeSurvey(id);
    assert.equal((await storage.getWaveById(id))?.status,"closed");
    assert.equal(await storage.countResponsesByWave(id),0);
    assert.equal((await storage.getSnapshotByWave(id))?.commentsReportPdfPath,null);
  });
  console.log(JSON.stringify({passed:results.length,checks:results,storage:"Local emulator, not production Supabase",paymentTested:false},null,2));
} finally {
  objectServer.close();
}
process.exit(0);
