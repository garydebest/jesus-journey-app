import type { Express, Request } from "express";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertChurchSchema, insertWaveSchema, updateChurchContactSchema, ITEM_CODES, requiredResponsesForClose } from "@shared/schema";
import { computeWaveAggregate } from "@shared/aggregate";
import { generateChurchReportPdf } from "./pdfReport";
import { fetchReportPdf } from "./reportStorage";
import {
  createSession,
  destroySession,
  requireChurchAuth,
  requireAdminAuth,
  getAdminPassword,
  createAdminSession,
  destroyAdminSession,
  type AuthedRequest,
} from "./auth";
import { z } from "zod";
import { PRICING_TIERS, priceCentsForTier, publicPricingList } from "./pricing";
import { createCheckoutSession, retrieveCheckoutSession, verifyStripeWebhookSignature, isStripeConfigured } from "./stripe";
import { currencyForRequest } from "./currency";

function sanitizeChurch(church: { passwordHash?: string; [k: string]: any }) {
  const { passwordHash, ...rest } = church;
  return rest;
}

const submitResponseSchema = z.object({
  joinCode: z.string().min(1),
  items: z.record(z.string(), z.number().min(1).max(5)),
  journeyPre: z.number().min(1).max(5).optional(),
  journeyPost: z.number().min(1).max(5).optional(),
  spiritualChange: z.number().min(1).max(5).optional(),
  demographics: z
    .object({
      gender: z.string().optional(),
      age: z.string().optional(),
      relationship: z.string().optional(),
      attendance: z.string().optional(),
      tenure: z.string().optional(),
      smallgroup: z.string().optional(),
      volunteer: z.string().optional(),
      children: z.array(z.string()).optional(),
      ethnicity: z.string().optional(),
    })
    .optional(),
  comment: z.string().optional(),
});

export async function registerRoutes(httpServer: Server, app: Express) {
  // -------------------------------------------------------------------
  // Church self-serve auth
  // -------------------------------------------------------------------
  app.post("/api/churches/signup", async (req, res) => {
    const parsed = insertChurchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid signup data", errors: parsed.error.flatten() });
    }
    const { password } = req.body as { password?: string };
    if (!password || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }
    const existing = await storage.getChurchByEmail(parsed.data.primaryContactEmail);
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const church = await storage.createChurch(parsed.data, passwordHash);
    const token = createSession(church.id);
    res.status(201).json({ token, church: sanitizeChurch(church) });
  });

  app.post("/api/churches/login", async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const church = await storage.getChurchByEmail(email);
    if (!church) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const ok = await bcrypt.compare(password, church.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = createSession(church.id);
    res.json({ token, church: sanitizeChurch(church) });
  });

  app.post("/api/churches/logout", (req: AuthedRequest, res) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (token) destroySession(token);
    res.json({ ok: true });
  });

  app.get("/api/churches/me", requireChurchAuth, async (req: AuthedRequest, res) => {
    const church = await storage.getChurchById(req.churchId!);
    if (!church) return res.status(404).json({ message: "Church not found" });
    res.json({ church: sanitizeChurch(church) });
  });

  app.patch("/api/churches/me", requireChurchAuth, async (req: AuthedRequest, res) => {
    const parsed = updateChurchContactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid contact info", errors: parsed.error.flatten() });
    }
    if (parsed.data.primaryContactEmail) {
      const existing = await storage.getChurchByEmail(parsed.data.primaryContactEmail);
      if (existing && existing.id !== req.churchId) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
    }
    const church = await storage.updateChurchContact(req.churchId!, parsed.data);
    if (!church) return res.status(404).json({ message: "Church not found" });
    res.json({ church: sanitizeChurch(church) });
  });

  // -------------------------------------------------------------------
  // Pricing (public)
  // -------------------------------------------------------------------
  app.get("/api/pricing", (req, res) => {
    const currency = currencyForRequest(req);
    res.json({ tiers: publicPricingList(currency), currency, stripeConfigured: isStripeConfigured() });
  });

  // -------------------------------------------------------------------
  // Waves (church-authenticated)
  // -------------------------------------------------------------------
  // Creates a wave in `pending_payment` state and immediately starts a
  // Stripe Checkout Session for it. The wave only becomes `live` once the
  // webhook confirms payment (see /api/stripe/webhook below). Every survey
  // is a standalone one-time purchase — no subscriptions.
  app.post("/api/waves", requireChurchAuth, async (req: AuthedRequest, res) => {
    const parsed = insertWaveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid wave data", errors: parsed.error.flatten() });
    }
    if (!isStripeConfigured()) {
      return res.status(503).json({ message: "Payments are not configured yet. Please try again shortly." });
    }
    const church = await storage.getChurchById(req.churchId!);
    if (!church) return res.status(404).json({ message: "Church not found" });

    const tier = parsed.data.sizeTier;
    const currency = currencyForRequest(req);
    const priceCents = priceCentsForTier(tier, currency);
    const wave = await storage.createWave(req.churchId!, parsed.data, priceCents, currency);

    const origin = `${req.protocol}://${req.get("host")}`;
    try {
      const session = await createCheckoutSession({
        amountCents: priceCents,
        currency,
        productName: `Jesus Journey Survey — ${PRICING_TIERS[tier].label}`,
        productDescription: `${wave.label} for ${church.name}`,
        successUrl: `${origin}/#/dashboard?checkout=success&wave=${wave.id}`,
        cancelUrl: `${origin}/#/dashboard?checkout=cancelled&wave=${wave.id}`,
        customerEmail: church.primaryContactEmail,
        metadata: { waveId: wave.id, churchId: church.id },
      });
      await storage.setWaveCheckoutSession(wave.id, session.id);
      res.status(201).json({ wave, checkoutUrl: session.url });
    } catch (err: any) {
      // Roll back the unpaid wave so it doesn't clutter the dashboard as a
      // dead entry if Stripe couldn't be reached.
      await storage.deleteUnpaidWave(wave.id);
      res.status(502).json({ message: `Could not start checkout: ${String(err?.message ?? err)}` });
    }
  });

  // Lets the dashboard confirm payment status right after the Stripe
  // redirect, without waiting on the webhook round trip.
  app.get("/api/waves/:id/payment-status", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    if (wave.paymentStatus === "paid" || !wave.stripeCheckoutSessionId) {
      return res.json({ wave });
    }
    try {
      const session = await retrieveCheckoutSession(wave.stripeCheckoutSessionId);
      if (session.payment_status === "paid") {
        const updated = await storage.markWavePaid(wave.id, session.payment_intent ?? undefined);
        return res.json({ wave: updated });
      }
      res.json({ wave });
    } catch {
      res.json({ wave });
    }
  });

  // Allows a church to abandon (delete) a wave that is still stuck in
  // pending_payment — e.g. they closed the Stripe tab without paying.
  app.delete("/api/waves/:id/pending", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    if (wave.paymentStatus === "paid") {
      return res.status(409).json({ message: "This survey has already been paid for." });
    }
    await storage.deleteUnpaidWave(wave.id);
    res.json({ ok: true });
  });

  app.get("/api/waves", requireChurchAuth, async (req: AuthedRequest, res) => {
    const waves = await storage.getWavesByChurch(req.churchId!);
    const withCounts = await Promise.all(
      waves.map(async (w) => ({
        ...w,
        responseCount: w.status === "closed" ? undefined : await storage.countResponsesByWave(w.id),
        snapshot: await storage.getSnapshotByWave(w.id),
      })),
    );
    res.json({ waves: withCounts });
  });

  app.get("/api/waves/:id", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    res.json({
      wave,
      responseCount: await storage.countResponsesByWave(wave.id),
      snapshot: await storage.getSnapshotByWave(wave.id),
    });
  });

  app.post("/api/waves/:id/close", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    if (wave.status === "closed") {
      return res.status(409).json({ message: "This survey wave is already closed" });
    }
    const rows = await storage.getResponsesByWave(wave.id);
    const requiredResponses = requiredResponsesForClose(wave.minSampleSize);
    if (rows.length < requiredResponses) {
      return res.status(400).json({
        message: `This survey needs at least ${requiredResponses} responses (50% of your total adults of ${wave.minSampleSize}) before it can be closed. You currently have ${rows.length}.`,
      });
    }
    const summary = computeWaveAggregate(rows);
    const church = await storage.getChurchById(wave.churchId);
    const pdfResult = await generateChurchReportPdf({
      waveId: wave.id,
      churchName: church?.name ?? "Your Church",
      waveLabel: wave.label,
      waveCreatedAt: wave.createdAt,
      rows,
    });
    if (!pdfResult.ok) {
      console.error("Full PDF report generation failed for wave", wave.id, pdfResult.error);
    }
    const snapshot = await storage.createAggregateSnapshot({
      waveId: wave.id,
      churchId: wave.churchId,
      respondentCount: summary.respondentCount,
      summaryJson: JSON.stringify(summary),
      reportPdfPath: pdfResult.ok ? pdfResult.storageKey ?? null : null,
      commentsReportPdfPath: pdfResult.ok ? pdfResult.commentsStorageKey ?? null : null,
    });
    await storage.purgeResponsesByWave(wave.id);
    await storage.markWaveReportGenerated(wave.id);
    const closed = await storage.setWaveClosed(wave.id);
    res.json({ wave: closed, snapshot });
  });

  // -------------------------------------------------------------------
  // Public: join a survey by code, submit a response
  // -------------------------------------------------------------------
  app.get("/api/join/:code", async (req, res) => {
    const wave = await storage.getWaveByJoinCode(String(req.params.code));
    if (!wave) return res.status(404).json({ message: "No survey found with that code" });
    if (wave.status === "closed") {
      return res.status(410).json({ message: "This survey is now closed" });
    }
    if (wave.status === "pending_payment" || wave.status === "not_started") {
      return res.status(403).json({ message: "This survey has not been opened by the church yet" });
    }
    const church = await storage.getChurchById(wave.churchId);
    res.json({
      waveId: wave.id,
      waveLabel: wave.label,
      churchName: church?.name ?? "Your church",
    });
  });

  app.post("/api/responses", async (req, res) => {
    const parsed = submitResponseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid response data", errors: parsed.error.flatten() });
    }
    const { joinCode, items, journeyPre, journeyPost, spiritualChange, demographics, comment } = parsed.data;
    const wave = await storage.getWaveByJoinCode(joinCode);
    if (!wave) return res.status(404).json({ message: "No survey found with that code" });
    if (wave.status === "closed") return res.status(410).json({ message: "This survey is now closed" });
    if (wave.status === "pending_payment" || wave.status === "not_started") {
      return res.status(403).json({ message: "This survey has not been opened by the church yet" });
    }

    const respondent = await storage.createRespondent("church_group", wave.id);

    const itemColumns: Record<string, number> = {};
    for (const code of ITEM_CODES) {
      const upper = code.toUpperCase();
      if (typeof items[upper] === "number") itemColumns[code] = items[upper];
    }

    await storage.saveResponse({
      respondentId: respondent.id,
      waveId: wave.id,
      ...itemColumns,
      journeyPre: journeyPre ?? null,
      journeyPost: journeyPost ?? null,
      spiritualChange: spiritualChange ?? null,
      gender: demographics?.gender ?? null,
      ageGroup: demographics?.age ?? null,
      relationshipStatus: demographics?.relationship ?? null,
      attendanceFrequency: demographics?.attendance ?? null,
      tenure: demographics?.tenure ?? null,
      smallGroupFrequency: demographics?.smallgroup ?? null,
      volunteerFrequency: demographics?.volunteer ?? null,
      childrenInHousehold: demographics?.children ? JSON.stringify(demographics.children) : null,
      raceEthnicity: demographics?.ethnicity ?? null,
      commentText: comment ?? null,
    } as any);

    res.status(201).json({ ok: true });
  });

  // -------------------------------------------------------------------
  // Church report retrieval
  // -------------------------------------------------------------------
  app.get("/api/waves/:id/report", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    const snapshot = await storage.getSnapshotByWave(wave.id);
    if (!snapshot) return res.status(404).json({ message: "Report not yet available" });
    res.json({ snapshot: { ...snapshot, summary: JSON.parse(snapshot.summaryJson) } });
  });

  app.get("/api/waves/:id/report.pdf", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    const snapshot = await storage.getSnapshotByWave(wave.id);
    if (!snapshot?.reportPdfPath) {
      return res.status(404).json({ message: "Full PDF report is not available for this wave" });
    }
    const pdfBuffer = await fetchReportPdf(snapshot.reportPdfPath);
    if (!pdfBuffer) {
      return res.status(404).json({ message: "Full PDF report is not available for this wave" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Our-Journey-with-Jesus-Report.pdf"');
    res.send(pdfBuffer);
  });

  app.get("/api/waves/:id/comments-report.pdf", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    const snapshot = await storage.getSnapshotByWave(wave.id);
    if (!snapshot?.commentsReportPdfPath) {
      return res.status(404).json({ message: "Comments report is not available for this wave" });
    }
    const pdfBuffer = await fetchReportPdf(snapshot.commentsReportPdfPath);
    if (!pdfBuffer) {
      return res.status(404).json({ message: "Comments report is not available for this wave" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Comments-Report.pdf"');
    res.send(pdfBuffer);
  });

  // -------------------------------------------------------------------
  // Admin (Gary) — separate login, session, and operator view
  // -------------------------------------------------------------------
  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body as { password?: string };
    if (!password || password !== getAdminPassword()) {
      return res.status(401).json({ message: "Incorrect admin password" });
    }
    const token = createAdminSession();
    res.json({ token });
  });

  app.post("/api/admin/logout", (req, res) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (token) destroyAdminSession(token);
    res.json({ ok: true });
  });

  app.get("/api/admin/overview", requireAdminAuth, async (_req, res) => {
    const waves = await storage.getAllWaves();
    const overview = await Promise.all(
      waves.map(async (w) => {
        const church = await storage.getChurchById(w.churchId);
        const snapshot = await storage.getSnapshotByWave(w.id);
        return {
          wave: w,
          churchName: church?.name ?? "Unknown",
          churchEmail: church?.primaryContactEmail ?? "",
          responseCount: w.status === "closed" ? snapshot?.respondentCount ?? 0 : await storage.countResponsesByWave(w.id),
          hasReport: !!snapshot,
          hasReportPdf: !!snapshot?.reportPdfPath,
          hasCommentsReportPdf: !!snapshot?.commentsReportPdfPath,
        };
      }),
    );
    res.json({ waves: overview });
  });

  // Grouped by church — contact info + every survey wave that church has run.
  app.get("/api/admin/churches", requireAdminAuth, async (_req, res) => {
    const allChurches = await storage.getAllChurches();
    const allWaves = await storage.getAllWaves();
    const result = await Promise.all(
      allChurches
        .map(async (church) => {
          const waves = await Promise.all(
            allWaves
              .filter((w) => w.churchId === church.id)
              .map(async (w) => {
                const snapshot = await storage.getSnapshotByWave(w.id);
                return {
                  wave: w,
                  responseCount: w.status === "closed" ? snapshot?.respondentCount ?? 0 : await storage.countResponsesByWave(w.id),
                  hasReport: !!snapshot,
                  hasReportPdf: !!snapshot?.reportPdfPath,
                  hasCommentsReportPdf: !!snapshot?.commentsReportPdfPath,
                };
              }),
          );
          waves.sort((a, b) => (a.wave.createdAt < b.wave.createdAt ? 1 : -1));
          return {
            church: sanitizeChurch(church),
            waves,
          };
        }),
    );
    result.sort((a, b) => (a.church.createdAt < b.church.createdAt ? 1 : -1));
    res.json({ churches: result });
  });

  app.post("/api/admin/waves/:id/close", requireAdminAuth, async (req, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave) return res.status(404).json({ message: "Wave not found" });
    if (wave.status === "closed") return res.status(409).json({ message: "Already closed" });
    const rows = await storage.getResponsesByWave(wave.id);
    if (rows.length === 0) {
      return res.status(400).json({ message: "Cannot close a wave with zero responses" });
    }
    const summary = computeWaveAggregate(rows);
    const church = await storage.getChurchById(wave.churchId);
    const pdfResult = await generateChurchReportPdf({
      waveId: wave.id,
      churchName: church?.name ?? "Your Church",
      waveLabel: wave.label,
      waveCreatedAt: wave.createdAt,
      rows,
    });
    if (!pdfResult.ok) {
      console.error("Full PDF report generation failed for wave", wave.id, pdfResult.error);
    }
    const snapshot = await storage.createAggregateSnapshot({
      waveId: wave.id,
      churchId: wave.churchId,
      respondentCount: summary.respondentCount,
      summaryJson: JSON.stringify(summary),
      reportPdfPath: pdfResult.ok ? pdfResult.storageKey ?? null : null,
      commentsReportPdfPath: pdfResult.ok ? pdfResult.commentsStorageKey ?? null : null,
    });
    await storage.purgeResponsesByWave(wave.id);
    await storage.markWaveReportGenerated(wave.id);
    const closed = await storage.setWaveClosed(wave.id);
    res.json({ wave: closed, snapshot });
  });

  app.get("/api/admin/waves/:id/report", requireAdminAuth, async (req, res) => {
    const snapshot = await storage.getSnapshotByWave(String(req.params.id));
    if (!snapshot) return res.status(404).json({ message: "Report not yet available" });
    res.json({ snapshot: { ...snapshot, summary: JSON.parse(snapshot.summaryJson) } });
  });

  app.get("/api/admin/waves/:id/report.pdf", requireAdminAuth, async (req, res) => {
    const snapshot = await storage.getSnapshotByWave(String(req.params.id));
    if (!snapshot?.reportPdfPath) {
      return res.status(404).json({ message: "Full PDF report is not available for this wave" });
    }
    const pdfBuffer = await fetchReportPdf(snapshot.reportPdfPath);
    if (!pdfBuffer) {
      return res.status(404).json({ message: "Full PDF report is not available for this wave" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Our-Journey-with-Jesus-Report.pdf"');
    res.send(pdfBuffer);
  });

  app.get("/api/admin/waves/:id/comments-report.pdf", requireAdminAuth, async (req, res) => {
    const snapshot = await storage.getSnapshotByWave(String(req.params.id));
    if (!snapshot?.commentsReportPdfPath) {
      return res.status(404).json({ message: "Comments report is not available for this wave" });
    }
    const pdfBuffer = await fetchReportPdf(snapshot.commentsReportPdfPath);
    if (!pdfBuffer) {
      return res.status(404).json({ message: "Comments report is not available for this wave" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Comments-Report.pdf"');
    res.send(pdfBuffer);
  });

  // -------------------------------------------------------------------
  // Stripe webhook — authoritative source of truth for payment completion.
  // Uses req.rawBody (captured by the express.json `verify` hook in
  // server/index.ts) for signature verification, since Stripe signs the
  // exact raw bytes of the request body.
  // -------------------------------------------------------------------
  app.post("/api/stripe/webhook", async (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set; rejecting webhook");
      return res.status(500).json({ message: "Webhook not configured" });
    }
    const rawBody = req.rawBody as Buffer | undefined;
    if (!rawBody) {
      return res.status(400).json({ message: "Missing raw body" });
    }
    const signatureHeader = req.headers["stripe-signature"] as string | undefined;
    const verification = verifyStripeWebhookSignature(rawBody, signatureHeader, secret);
    if (!verification.valid) {
      console.error("Stripe webhook signature verification failed:", verification.reason);
      return res.status(400).json({ message: `Signature verification failed: ${verification.reason}` });
    }

    const event = req.body as { type: string; data: { object: any } };
    try {
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        const session = event.data.object;
        if (session.payment_status === "paid") {
          const wave = await storage.getWaveByCheckoutSessionId(session.id);
          if (wave && wave.paymentStatus !== "paid") {
            await storage.markWavePaid(wave.id, session.payment_intent ?? undefined);
          }
        }
      }
      // checkout.session.expired / async_payment_failed: leave the wave in
      // pending_payment — the church can retry checkout or abandon it via
      // DELETE /api/waves/:id/pending.
      res.json({ received: true });
    } catch (err: any) {
      console.error("Stripe webhook handling error:", err?.message ?? err);
      res.status(500).json({ message: "Webhook handling error" });
    }
  });

  return httpServer;
}
