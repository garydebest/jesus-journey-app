// Facilitator assignment QA. Local jj_preview database ONLY; mail captured in memory. Run:
//   MAILER_TEST_OUTBOX=1 DATABASE_URL=postgres://jj:jj@localhost:5432/jj_preview npx tsx script/facilitator-assignment-qa.ts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/jj_preview", "QA is restricted to the local jj_preview database");
assert.equal(process.env.MAILER_TEST_OUTBOX, "1", "Set MAILER_TEST_OUTBOX=1");

const { db, storage, pool } = await import("../server/storage");
const { churches } = await import("../shared/schema");
const { testOutbox } = await import("../server/mailer");
const J = await import("../server/journey");
const A = await import("../server/adminAccounts");
const { handleCalendlyEvent } = await import("../server/calendly");

let passed = 0;
async function test(name: string, fn: () => Promise<void>) { await fn(); passed++; console.log("  ✓", name); }
const tag = randomUUID().slice(0, 6);
await A.ensureAdminTables();
await storage.getChurchById("bootstrap");
const adminId = randomUUID();
await pool.query(`INSERT INTO admin_users (id, email, name, role) VALUES ($1, $2, 'Melt van der Spuy', 'admin')`, [adminId, `melt-${tag}@newjoy.test`]);
const churchId = `qa-fac-${tag}`;
await db.insert(churches).values({ id: churchId, name: `Fac Church ${tag}`, primaryContactName: "Pat", primaryContactEmail: `p-${tag}@example.test`, communityCode: `QF-${tag}`, passwordHash: "x" });

console.log("Facilitator assignment QA");
await test("unassigned church: subject has no facilitator, only the shared mailbox gets it", async () => {
  testOutbox.length = 0;
  await J.sendInternalEmail("internal_growth_interest", (await storage.getChurchById(churchId))!, null, `a-${tag}`);
  assert.equal(testOutbox.length, 1);
  assert.ok(testOutbox[0].subject.startsWith("[Jesus Journey] ") && testOutbox[0].subject.endsWith(`— Fac Church ${tag}`));
  assert.match(testOutbox[0].text!, /Facilitator: Not yet assigned/);
});
await test("facilitator list includes active admins; notice email is validated and saved", async () => {
  assert.ok((await A.listFacilitators()).some((f) => f.id === adminId));
  await assert.rejects(A.setAdminNoticeEmail(null, adminId, "not-an-email"));
  await A.setAdminNoticeEmail(null, adminId, "Melt.vanderspuy@jesusjourney.life");
  assert.equal((await A.getFacilitator(adminId))?.noticeEmail, "melt.vanderspuy@jesusjourney.life");
});
await test("assigned church: first name in subject, copy to the facilitator, no duplicate on repeat", async () => {
  await storage.setChurchFacilitator(churchId, adminId);
  testOutbox.length = 0;
  const church = (await storage.getChurchById(churchId))!;
  await J.sendInternalEmail("internal_growth_interest", church, null, `b-${tag}`);
  assert.equal(testOutbox.length, 2);
  assert.ok(testOutbox.every((m) => m.subject.endsWith(`— Fac Church ${tag} — Melt`)));
  assert.deepEqual(testOutbox.map((m) => m.to).sort(), ["admin@jesusjourney.life", "melt.vanderspuy@jesusjourney.life"]);
  assert.match(testOutbox[0].text!, /Facilitator: Melt van der Spuy/);
  await J.sendInternalEmail("internal_growth_interest", church, null, `b-${tag}`);
  assert.equal(testOutbox.length, 2);
});
await test("removed facilitator is treated as unassigned", async () => {
  await pool.query(`UPDATE admin_users SET disabled_at = now() WHERE id = $1`, [adminId]);
  assert.equal(await A.getFacilitator(adminId), null);
  testOutbox.length = 0;
  await J.sendInternalEmail("internal_growth_interest", (await storage.getChurchById(churchId))!, null, `c-${tag}`);
  assert.equal(testOutbox.length, 1);
  assert.ok(!testOutbox[0].subject.endsWith("Melt"));
  await pool.query(`UPDATE admin_users SET disabled_at = NULL WHERE id = $1`, [adminId]);
});
await test("Calendly cancellation notice names church + facilitator and copies them", async () => {
  const { surveyWaves } = await import("../shared/schema");
  const waveId = `qaw-${tag}`;
  await db.insert(surveyWaves).values({ id: waveId, churchId, label: "QA", status: "closed", paymentStatus: "paid", joinCode: `QF${tag}`, minSampleSize: 40 });
  testOutbox.length = 0;
  await handleCalendlyEvent({ event: "invitee.canceled", payload: { name: "Pat", email: "x@example.test", tracking: { utm_content: waveId }, scheduled_event: { start_time: new Date().toISOString(), name: "Debrief" } } });
  assert.equal(testOutbox.length, 2);
  assert.ok(testOutbox.every((m) => m.subject === `Calendly debrief canceled — Fac Church ${tag} — Melt`));
});
console.log(`\n${passed} facilitator assignment checks passed.`);
await pool.end();
process.exit(0);
