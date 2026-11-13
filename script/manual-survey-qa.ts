// Admin-entered church survey with a custom price. Local jj_preview database
// ONLY; Stripe is a local stub and mail is captured in memory. Run after
// script/seed-preview.ts on a database where the shared admin login is still on:
//   MAILER_TEST_OUTBOX=1 ADMIN_KEY=qa-admin-key ADMIN_USERNAME=admin DATABASE_URL=postgres://jj:jj@localhost:5432/jj_preview npx tsx script/manual-survey-qa.ts
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import { createServer, type IncomingMessage } from "node:http";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/jj_preview", "QA is restricted to the local jj_preview database");
assert.equal(process.env.MAILER_TEST_OUTBOX, "1", "Set MAILER_TEST_OUTBOX=1");

// ---- Stripe stub -----------------------------------------------------------
type Session = { id: string; url: string; status: string; payment_status: string; amount_subtotal: number; currency: string; automatic_tax: { enabled: boolean }; payment_intent: string | null; body: string };
const sessions = new Map<string, Session>();
let sessionSeq = 0;
const readBody = (req: IncomingMessage) => new Promise<string>((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const stripe = createServer(async (req, res) => {
  const body = decodeURIComponent((await readBody(req)).replace(/\+/g, " "));
  res.setHeader("Content-Type", "application/json");
  if (req.method === "POST" && req.url === "/v1/checkout/sessions") {
    const form = new URLSearchParams(await Promise.resolve(body.split("&").map((kv) => kv).join("&")));
    const id = `cs_test_${++sessionSeq}`;
    const s: Session = { id, url: `https://checkout.stripe.test/${id}`, status: "open", payment_status: "unpaid", amount_subtotal: Number(form.get("line_items[0][price_data][unit_amount]")), currency: String(form.get("line_items[0][price_data][currency]")), automatic_tax: { enabled: form.get("automatic_tax[enabled]") === "true" }, payment_intent: null, body };
    sessions.set(id, s);
    return res.end(JSON.stringify(s));
  }
  const m = req.url?.match(/^\/v1\/checkout\/sessions\/(.+)$/);
  if (req.method === "GET" && m && sessions.has(decodeURIComponent(m[1]))) return res.end(JSON.stringify(sessions.get(decodeURIComponent(m[1]))));
  res.statusCode = 404; res.end(JSON.stringify({ error: { message: "not found" } }));
});
await new Promise<void>((r) => stripe.listen(0, r));
process.env.CUSTOM_CRED_API_STRIPE_COM_URL = `http://127.0.0.1:${(stripe.address() as any).port}`;
process.env.CUSTOM_CRED_API_STRIPE_COM_TOKEN = "sk_test_stub";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_qa";
process.env.APP_BASE_URL = "https://app.example.test";

const { ensureBootstrapped, pool, storage } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");
const { testOutbox } = await import("../server/mailer");
await ensureBootstrapped();

const app = express();
app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
const server = createServer(app);
await registerRoutes(server, app);
await new Promise<void>((r) => server.listen(0, r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const call = async (method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}) => {
  const res = await fetch(base + path, { method, redirect: "manual", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json: any = {}; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, location: res.headers.get("location") };
};
const post = (p: string, b?: unknown, t?: string) => call("POST", p, b ?? {}, t);
const get = (p: string, t?: string) => call("GET", p, undefined, t);
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log("  ✓", name); };
const settle = () => new Promise((r) => setTimeout(r, 400));

const NEW_EMAIL = "manual-new@example.test", OFF_EMAIL = "manual-offline@example.test";
for (const email of [NEW_EMAIL, OFF_EMAIL]) {
  const { rows } = await pool.query(`SELECT id FROM churches WHERE primary_contact_email = $1`, [email]);
  for (const { id } of rows) {
    await pool.query(`DELETE FROM church_email_events WHERE church_id = $1`, [id]);
    await pool.query(`DELETE FROM church_password_resets WHERE church_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM survey_waves WHERE church_id = $1`, [id]);
    await pool.query(`DELETE FROM churches WHERE id = $1`, [id]);
  }
}

const login = await post("/api/admin/login", { username: process.env.ADMIN_USERNAME || "admin", password: process.env.ADMIN_KEY });
assert.equal(login.status, 200, `shared admin login: ${login.text}`);
const admin = login.json.token as string;

const newChurchBody = {
  newChurch: { name: "Manual Test Church", primaryContactName: "Pat Example", primaryContactEmail: NEW_EMAIL, region: "British Columbia" },
  label: "Spring 2027 Survey", minSampleSize: 180, price: 350, currency: "cad", paymentMethod: "stripe", adminNote: "Partner rate agreed by Gary", emailChurch: true,
};
let stripeWaveId = "", payPath = "", firstSession = "", churchToken = "";

await test("only administrators can add a manual survey", async () => {
  assert.equal((await post("/api/admin/manual-surveys", newChurchBody)).status, 401);
});

await test("validation: complimentary must be 0, card price at least 1, one church choice", async () => {
  assert.equal((await post("/api/admin/manual-surveys", { ...newChurchBody, paymentMethod: "complimentary", price: 10 }, admin)).status, 400);
  assert.equal((await post("/api/admin/manual-surveys", { ...newChurchBody, price: 0.5 }, admin)).status, 400);
  assert.equal((await post("/api/admin/manual-surveys", { ...newChurchBody, price: 10.555 }, admin)).status, 400);
  assert.equal((await post("/api/admin/manual-surveys", { ...newChurchBody, churchId: "x" }, admin)).status, 400);
  assert.equal((await post("/api/admin/manual-surveys", { ...newChurchBody, minSampleSize: 10 }, admin)).status, 400);
});

await test("new church + Stripe: account, unpaid survey at the custom price, taxed checkout, email with pay and password links", async () => {
  testOutbox.length = 0;
  const r = await post("/api/admin/manual-surveys", newChurchBody, admin);
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.createdChurch, true);
  assert.equal(r.json.wave.status, "pending_payment");
  assert.equal(r.json.wave.paymentStatus, "unpaid");
  assert.equal(r.json.wave.priceCents, 35000);
  assert.equal(r.json.wave.currency, "cad");
  assert.equal(r.json.wave.sizeTier, "upto_200");
  assert.equal(r.json.wave.responseLimit, 200);
  assert.equal(r.json.wave.pricingSource, "admin_custom");
  assert.equal(r.json.wave.adminNote, "Partner rate agreed by Gary");
  assert.equal(r.json.wave.paymentLinkToken, undefined, "token never returned raw");
  assert.match(r.json.paymentLinkUrl, /^https:\/\/app\.example\.test\/pay\/[A-Za-z0-9_-]{20,}$/);
  assert.equal(r.json.emailStatus, "sent");
  stripeWaveId = r.json.wave.id;
  payPath = new URL(r.json.paymentLinkUrl).pathname;
  const wave = await storage.getWaveById(stripeWaveId);
  firstSession = wave!.stripeCheckoutSessionId!;
  const s = sessions.get(firstSession)!;
  for (const part of ["automatic_tax[enabled]=true", "billing_address_collection=required", "line_items[0][price_data][unit_amount]=35000", "line_items[0][price_data][currency]=cad", "line_items[0][price_data][tax_behavior]=exclusive", "line_items[0][price_data][product_data][tax_code]=txcd_20060048", `metadata[waveId]=${stripeWaveId}`, "metadata[pricingSource]=admin_custom", `customer_email=${NEW_EMAIL}`]) {
    assert.ok(s.body.split("&").includes(part), `checkout missing ${part}`);
  }
  const mail = testOutbox.find((m) => m.to === NEW_EMAIL);
  assert.ok(mail, "church email captured");
  assert.match(mail!.subject, /ready for payment/);
  assert.ok(mail!.text.includes(r.json.paymentLinkUrl), "pay link in email");
  assert.ok(mail!.text.includes("CAD 350.00"), "price in email");
  assert.ok(!mail!.text.includes("Partner rate"), "internal note never emailed");
  assert.match(mail!.text, /\/#\/church\/reset\/[A-Za-z0-9_-]+/);
  const { rows } = await pool.query(`SELECT expires_at FROM church_password_resets WHERE church_id = $1 AND used_at IS NULL`, [r.json.church.id]);
  assert.equal(rows.length, 1);
  assert.ok(new Date(rows[0].expires_at).getTime() - Date.now() > 6.9 * 24 * 3600 * 1000, "setup link lasts seven days");
});

await test("duplicate email is refused for a new church", async () => {
  const r = await post("/api/admin/manual-surveys", newChurchBody, admin);
  assert.equal(r.status, 409);
});

await test("the church sets its password from the emailed link and signs in; church API hides token and note", async () => {
  const mail = testOutbox.find((m) => m.to === NEW_EMAIL)!;
  const token = mail.text.match(/\/#\/church\/reset\/([A-Za-z0-9_-]+)/)![1];
  assert.equal((await post("/api/churches/reset-password", { token, password: "chosen-password-1" })).status, 200);
  const signIn = await post("/api/churches/login", { email: NEW_EMAIL, password: "chosen-password-1" });
  assert.equal(signIn.status, 200, signIn.text);
  churchToken = signIn.json.token;
  const waves = await get("/api/waves", churchToken);
  const w = waves.json.waves.find((x: any) => x.id === stripeWaveId);
  assert.ok(w);
  assert.equal(w.paymentLinkToken, undefined);
  assert.equal(w.adminNote, undefined);
  assert.equal(w.joinCode, null, "no code before payment");
});

await test("pay link reuses the open checkout, then starts a fresh one after it expires", async () => {
  const a = await get(payPath);
  assert.equal(a.status, 303);
  assert.equal(a.location, sessions.get(firstSession)!.url);
  sessions.get(firstSession)!.status = "expired";
  const b = await get(payPath);
  assert.equal(b.status, 303);
  const wave = await storage.getWaveById(stripeWaveId);
  assert.notEqual(wave!.stripeCheckoutSessionId, firstSession);
  assert.equal(b.location, sessions.get(wave!.stripeCheckoutSessionId!)!.url);
  assert.equal(sessions.get(wave!.stripeCheckoutSessionId!)!.amount_subtotal, 35000);
  const c = await get("/pay/not-a-real-token");
  assert.equal(c.status, 200); assert.match(c.text, /not valid/);
});

await test("church dashboard Resume checkout also renews an expired checkout", async () => {
  const before = (await storage.getWaveById(stripeWaveId))!.stripeCheckoutSessionId!;
  sessions.get(before)!.status = "expired";
  const r = await get(`/api/waves/${stripeWaveId}/payment-status`, churchToken);
  assert.equal(r.status, 200);
  const after = (await storage.getWaveById(stripeWaveId))!.stripeCheckoutSessionId!;
  assert.notEqual(after, before);
  assert.equal(r.json.checkoutUrl, sessions.get(after)!.url);
});

await test("signed Stripe webhook at the custom subtotal marks it paid (tax on top is fine)", async () => {
  testOutbox.length = 0;
  const sid = (await storage.getWaveById(stripeWaveId))!.stripeCheckoutSessionId!;
  const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: sid, payment_status: "paid", amount_subtotal: 35000, amount_total: 36750, currency: "cad", payment_intent: "pi_qa" } } });
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", "whsec_qa").update(`${t}.${payload}`).digest("hex");
  const res = await fetch(`${base}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": `t=${t},v1=${sig}` }, body: payload });
  assert.equal(res.status, 200);
  const wave = await storage.getWaveById(stripeWaveId);
  assert.equal(wave!.paymentStatus, "paid");
  assert.equal(wave!.status, "not_started");
  assert.equal(wave!.stripePaymentIntentId, "pi_qa");
  await settle();
  assert.ok(testOutbox.some((m) => m.to === NEW_EMAIL && /ready to plan/.test(m.subject)), "standard purchase confirmation after payment");
  const paid = await get(payPath);
  assert.equal(paid.status, 200); assert.match(paid.text, /already paid/);
});

await test("a church with an open paid survey can't get a second one", async () => {
  const church = await storage.getChurchByEmail(NEW_EMAIL);
  const r = await post("/api/admin/manual-surveys", { ...newChurchBody, newChurch: undefined, churchId: church!.id }, admin);
  assert.equal(r.status, 409);
});

await test("paid outside Stripe: marked paid immediately, no Stripe session, confirmation sent", async () => {
  testOutbox.length = 0;
  const before = sessions.size;
  const r = await post("/api/admin/manual-surveys", { ...newChurchBody, newChurch: { ...newChurchBody.newChurch, name: "Offline Test Church", primaryContactEmail: OFF_EMAIL }, paymentMethod: "offline", price: 275.5, currency: "usd" }, admin);
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.wave.paymentStatus, "paid");
  assert.equal(r.json.wave.status, "not_started");
  assert.equal(r.json.wave.paymentMethod, "offline");
  assert.equal(r.json.wave.priceCents, 27550);
  assert.equal(r.json.paymentLinkUrl, null);
  assert.equal(sessions.size, before, "no Stripe call");
  await settle();
  assert.ok(testOutbox.some((m) => m.to === OFF_EMAIL && /reserved/.test(m.subject) && /\/#\/church\/reset\//.test(m.text)), "password setup email");
  assert.ok(testOutbox.some((m) => m.to === OFF_EMAIL && /ready to plan/.test(m.subject)), "purchase confirmation");
});

await test("Mark paid converts an unpaid card survey to complimentary, and refuses ordinary surveys", async () => {
  const church = await storage.getChurchByEmail(OFF_EMAIL);
  await pool.query(`UPDATE survey_waves SET status = 'closed' WHERE church_id = $1`, [church!.id]);
  const r = await post("/api/admin/manual-surveys", { churchId: church!.id, label: "Second survey", minSampleSize: 450, price: 600, currency: "cad", paymentMethod: "stripe", emailChurch: false }, admin);
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.emailStatus, "not sent");
  assert.equal(r.json.wave.sizeTier, "r401_700");
  const link = await post(`/api/admin/waves/${r.json.wave.id}/payment-link`, {}, admin);
  assert.equal(link.status, 200); assert.equal(link.json.paymentLinkUrl, r.json.paymentLinkUrl);
  assert.equal((await post(`/api/admin/waves/${r.json.wave.id}/mark-paid`, { method: "bogus" }, admin)).status, 400);
  const m = await post(`/api/admin/waves/${r.json.wave.id}/mark-paid`, { method: "complimentary" }, admin);
  assert.equal(m.status, 200, m.text);
  assert.equal(m.json.wave.paymentStatus, "paid");
  assert.equal(m.json.wave.paymentMethod, "complimentary");
  assert.equal((await post(`/api/admin/waves/${r.json.wave.id}/mark-paid`, { method: "offline" }, admin)).status, 409, "only once");
  assert.equal((await post(`/api/admin/waves/${r.json.wave.id}/payment-link`, {}, admin)).status, 409, "no link once paid");
});

await test("admin listing shows custom pricing fields; activity log records the action", async () => {
  const r = await get("/api/admin/churches", admin);
  const g = r.json.churches.find((x: any) => x.church.primaryContactEmail === NEW_EMAIL);
  assert.equal(g.waves[0].wave.pricingSource, "admin_custom");
  assert.equal(g.waves[0].wave.adminNote, "Partner rate agreed by Gary");
  const { rows } = await pool.query(`SELECT action FROM admin_activity WHERE action LIKE 'Added church survey manually%' ORDER BY created_at DESC LIMIT 1`);
  assert.match(rows[0].action, /CAD 350\.00|CAD 600\.00/);
});

console.log(`manual-survey QA: ${passed} checks passed`);
server.close(); stripe.close();
await pool.end();
process.exit(0);
