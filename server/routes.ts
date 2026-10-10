import { randomBytes } from "node:crypto";
import { verifyCalendlySignature, handleCalendlyEvent } from "./calendly";
import type { Express, Request } from "express";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import { storage, OrientationRequiredError, ORIENTATION_REQUIRED_MESSAGE } from "./storage";
import { bookingConfig } from "./journeyConfig";
import { onWavePaid, onOrientationCompleted, onSurveyActivated, onReportsReady, onDebriefBooked, onDebriefCompleted, onGrowthPlanInterest, runJourneySweep, adminResend, RESENDABLE } from "./journey";
import { EMAIL_TYPE_LABELS, type ClientEmailType } from "./journeyTemplates";
import { insertChurchSchema, insertWaveSchema, updateChurchContactSchema, ITEM_CODES, requiredResponsesForClose } from "@shared/schema";
import { TIMELINE_PHASES, computeTimelineDates, defaultClosesAt } from "@shared/timeline";
import { buildTimelineIcs } from "./ics";
import { closeSurvey, saveChurchResponse, SurveyCloseError } from "./closeSurvey";
import { fetchReportPdf } from "./reportStorage";
import { renderDebriefingPdfBuffer } from "./debriefingPdf";
import { SURVEY_REVIEW_FILENAME, FACILITATOR_FILENAME } from "./surveyReviewPdf";
import { projectReportForDisplay } from "@shared/debriefing/reportProjection";
import { projectChurchPdf } from "./churchPdfProjection";
import {
  createSession,
  destroySession,
  requireChurchAuth,
  restrictPublicDashboardDemo,
  requireAdminAuth,
  getAdminPassword,
  getAdminUsername,
  destroySessionsForChurch,
  createAdminSession,
  destroyAdminSession,
  type AuthedRequest,
} from "./auth";
import { z } from "zod";
import { requestPasswordReset, completePasswordReset, changePassword, PasswordResetError } from "./passwordReset";
import { PRICING_TIERS, priceCentsForTier, publicPricingList, tierForAdults } from "./pricing";
import { createCheckoutSession, retrieveCheckoutSession, verifyStripeWebhookSignature, isStripeConfigured, sessionHasAutomaticTax, sessionMatchesWavePrice } from "./stripe";
import { REGION_CURRENCY, regionForRequest } from "./currency";
import { runReminderSweep } from "./reminders";
import { acceptsResponses, calendarDate, emptySurveyPlan, isDemoChurch, surveyPlanSchema } from "@shared/surveyAccess";
import { isParticipantDemoCode, PARTICIPANT_DEMO_META } from "@shared/participantDemo";
import { DASHBOARD_DEMO_WAVE_ID } from "@shared/dashboardDemo";
import { submitResponseSchema } from "@shared/submission";
import { getWordcloudPdf } from "./wordcloud";
import { ethnicityPresetForCountry, encodeEthnicity } from "@shared/demographicPolicy";
import { projectDemographicSummary } from "@shared/demographicProjection";

function safeSnapshot<T extends { summaryJson: string } | undefined>(snapshot: T) {
  return snapshot ? { ...snapshot, summaryJson: JSON.stringify(projectDemographicSummary(JSON.parse(snapshot.summaryJson))) } : snapshot;
}

function sanitizeChurch(church: { passwordHash?: string; [k: string]: any }): Record<string, any> {
  const { passwordHash, surveyPlanJson, ...rest } = church;
  return { ...rest, isDemo: isDemoChurch(church.id) };
}

function sanitizeWave(wave: any) {
  return wave ? { ...wave, joinCode: wave.paymentStatus === "paid" ? wave.joinCode : null } : wave;
}

export async function registerRoutes(httpServer: Server, app: Express) {
  app.use("/api", restrictPublicDashboardDemo);
  // The shared demo account is read-only on the server. Its interactive
  // planning and progress examples are simulated in the browser.
  app.use(["/api/waves", "/api/churches/me", "/api/churches/plan"], (req: AuthedRequest, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") return next();
    requireChurchAuth(req, res, () => {
      if (isDemoChurch(req.churchId!)) return res.status(403).json({ message: "The Grace demo is read-only. Your practice changes are not saved to the shared account." });
      next();
    });
  });

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

  // Forgot password: always the same response, whether or not the email has an account.
  app.post("/api/churches/forgot-password", async (req, res) => {
    const { email } = req.body as { email?: string };
    const generic = { ok: true, message: "If an account uses that email, we've sent a link to reset the password. It expires in one hour." };
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ message: "Please enter the email address you sign in with." });
    }
    try {
      await requestPasswordReset(email);
    } catch (err: any) {
      console.error("[password-reset] request failed:", err?.message ?? err);
    }
    res.json(generic);
  });

  app.post("/api/churches/reset-password", async (req, res) => {
    const { token, password } = req.body as { token?: string; password?: string };
    try {
      const churchId = await completePasswordReset(String(token ?? ""), String(password ?? ""));
      destroySessionsForChurch(churchId);
      res.json({ ok: true });
    } catch (err: any) {
      if (err instanceof PasswordResetError) return res.status(400).json({ message: err.message });
      console.error("[password-reset] reset failed:", err?.message ?? err);
      res.status(500).json({ message: "We couldn't reset your password. Please try again." });
    }
  });

  app.post("/api/churches/me/password", requireChurchAuth, async (req: AuthedRequest, res) => {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    try {
      await changePassword(req.churchId!, String(currentPassword ?? ""), String(newPassword ?? ""));
      const header = req.headers.authorization;
      destroySessionsForChurch(req.churchId!, header?.startsWith("Bearer ") ? header.slice(7) : undefined);
      res.json({ ok: true });
    } catch (err: any) {
      if (err instanceof PasswordResetError) return res.status(400).json({ message: err.message });
      console.error("[password-change] failed:", err?.message ?? err);
      res.status(500).json({ message: "We couldn't change your password. Please try again." });
    }
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

  app.get("/api/churches/plan", requireChurchAuth, async (req: AuthedRequest, res) => {
    const church = await storage.getChurchById(req.churchId!);
    if (!church) return res.status(404).json({ message: "Church not found" });
    let plan = emptySurveyPlan();
    try { plan = surveyPlanSchema.parse(JSON.parse(church.surveyPlanJson ?? "null")); } catch {}
    res.json({ plan });
  });

  app.put("/api/churches/plan", requireChurchAuth, async (req: AuthedRequest, res) => {
    const parsed = surveyPlanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid plan" });
    await storage.saveChurchPlan(req.churchId!, parsed.data);
    res.json({ plan: parsed.data });
  });

  // -------------------------------------------------------------------
  // Phase 1 booking configuration (public, non-secret). URLs come only from
  // deploy-time environment variables; null means "show the fallback".
  // -------------------------------------------------------------------
  app.get("/api/config/booking", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(bookingConfig());
  });

  // Separate paid Growth Plan: interest only in Phase 1 (no purchase flow).
  app.post("/api/churches/growth-plan-interest", requireChurchAuth, async (req: AuthedRequest, res) => {
    if (isDemoChurch(req.churchId!) || req.isPublicDemo) return res.status(403).json({ message: "The Grace demo is read-only." });
    const optIn = req.body?.optIn === true;
    const church = await storage.setGrowthPlanInterest(req.churchId!, optIn);
    if (!church) return res.status(404).json({ message: "Church not found" });
    void onGrowthPlanInterest(church.id);
    res.json({ church: sanitizeChurch(church) });
  });

  // -------------------------------------------------------------------
  // Pricing (public)
  // -------------------------------------------------------------------
  // Public: the marketing site (jesusjourney.life) reads this to show the
  // visitor's regional prices. Cloudflare sets CF-IPCountry on this request
  // from the visitor's own IP, so the cross-site fetch prices correctly.
  app.get("/api/pricing", (req, res) => {
    const origin = String(req.headers.origin ?? "");
    if (/^https:\/\/(www\.)?jesusjourney\.life$/.test(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin, CF-IPCountry");
    }
    res.setHeader("Cache-Control", "no-store");
    const region = regionForRequest(req);
    res.json({ tiers: publicPricingList(region), region, currency: REGION_CURRENCY[region], stripeConfigured: isStripeConfigured() });
  });

  // -------------------------------------------------------------------
  // Waves (church-authenticated)
  // -------------------------------------------------------------------
  // Creates a wave in `pending_payment` state and immediately starts a
  // Stripe Checkout Session for it. Payment makes it `not_started`;
  // explicit plan confirmation activates it. Every survey
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

    const existingWaves = await storage.getWavesByChurch(church.id);
    if (existingWaves.some((wave) => wave.paymentStatus === "paid" && wave.status !== "closed")) {
      return res.status(409).json({ message: "You already have a purchased survey. Confirm or complete it before buying another." });
    }
    // Price is set by the church's total adults (16+), never by a client-chosen tier.
    const tier = tierForAdults(parsed.data.minSampleSize);
    const region = regionForRequest(req);
    const currency = REGION_CURRENCY[region];
    const priceCents = priceCentsForTier(tier, region);
    const wave = await storage.createWave(req.churchId!, { ...parsed.data, sizeTier: tier }, priceCents, currency);

    const origin = `${req.protocol}://${req.get("host")}`;
    try {
      const session = await createCheckoutSession({
        amountCents: priceCents,
        currency,
        productName: `Jesus Journey Standard Plan — ${PRICING_TIERS[tier].label}`,
        productDescription: `${wave.label} for ${church.name}`,
        successUrl: `${origin}/#/dashboard?checkout=success&wave=${wave.id}`,
        cancelUrl: `${origin}/#/dashboard?checkout=cancelled&wave=${wave.id}`,
        customerEmail: church.primaryContactEmail,
        metadata: { waveId: wave.id, churchId: church.id, sizeTier: tier, pricingRegion: region },
      });
      await storage.setWaveCheckoutSession(wave.id, session.id);
      res.status(201).json({ wave: sanitizeWave(wave), checkoutUrl: session.url });
    } catch (err: any) {
      // Roll back the unpaid wave so it doesn't clutter the dashboard as a
      // dead entry if Stripe couldn't be reached.
      // No tax-disabled fallback: if Stripe Tax cannot calculate, stop here.
      await storage.deleteUnpaidWave(wave.id);
      console.error("Checkout session creation failed:", err?.message ?? err);
      res.status(502).json({ message: "We couldn't start checkout or calculate tax just now. No payment was taken. Please try again in a few minutes, or contact admin@jesusjourney.life if this keeps happening." });
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
      return res.json({ wave: sanitizeWave(wave) });
    }
    try {
      const session = await retrieveCheckoutSession(wave.stripeCheckoutSessionId);
      if (session.payment_status === "paid") {
        if (!sessionMatchesWavePrice(session, wave)) {
          console.error(`Paid session ${session.id} subtotal/currency does not match wave ${wave.id}; not activating automatically`);
          return res.json({ wave: sanitizeWave(wave) });
        }
        const updated = await storage.markWavePaid(wave.id, session.payment_intent ?? undefined);
        void onWavePaid(wave.id);
        return res.json({ wave: sanitizeWave(updated) });
      }
      // Never resume a checkout created before tax collection began.
      const resumable = session.status === "open" && sessionHasAutomaticTax(session);
      res.json({ wave: sanitizeWave(wave), checkoutUrl: resumable ? session.url : null });
    } catch {
      res.json({ wave: sanitizeWave(wave) });
    }
  });

  // Retain pending checkouts so delayed payment settlement stays recoverable.
  app.delete("/api/waves/:id/pending", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    // A Stripe session may still settle asynchronously after the visitor
    // leaves checkout. Never delete its wave while payment can arrive.
    return res.status(409).json({ message: "An unfinished checkout is kept until its payment status is resolved. It cannot activate a survey without payment." });
  });

  app.get("/api/waves", requireChurchAuth, async (req: AuthedRequest, res) => {
    if (req.isPublicDemo) {
      const wave = await storage.getWaveById(DASHBOARD_DEMO_WAVE_ID);
      if (!wave || !isDemoChurch(wave.churchId) || wave.status !== "closed") {
        return res.status(503).json({ message: "The sample dashboard is temporarily unavailable." });
      }
      const snapshot = await storage.getSnapshotByWave(wave.id);
      // Explicit public projection: no contact data, Stripe metadata, storage
      // paths, raw rows, or future demo-account surveys are exposed.
      return res.json({ waves: [{
        id: wave.id, label: wave.label, status: wave.status, paymentStatus: wave.paymentStatus,
        joinCode: "DEMO ONLY", minSampleSize: wave.minSampleSize,
        opensAt: wave.opensAt, closesAt: wave.closesAt, closedAt: wave.closedAt,
        createdAt: wave.createdAt,
        snapshot: snapshot ? {
          respondentCount: snapshot.respondentCount,
          hasReportPdf: !!snapshot.reportPdfPath,
          hasCommentsReportPdf: !!snapshot.commentsReportPdfPath,
        } : null,
      }] });
    }
    const waves = await storage.getWavesByChurch(req.churchId!);
    const withCounts = await Promise.all(
      waves.map(async (w) => ({
        ...sanitizeWave(w),
        responseCount: w.status === "closed" ? undefined : await storage.countResponsesByWave(w.id),
        snapshot: safeSnapshot(await storage.getSnapshotByWave(w.id)),
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
      wave: sanitizeWave(wave),
      responseCount: await storage.countResponsesByWave(wave.id),
      snapshot: safeSnapshot(await storage.getSnapshotByWave(wave.id)),
    });
  });

  app.get("/api/waves/:id/participation", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) return res.status(404).json({ message: "Wave not found" });
    if (wave.paymentStatus !== "paid") return res.status(403).json({ message: "Purchase is required." });
    if (wave.status === "closed") return res.status(409).json({ message: "See the saved report for this completed survey." });
    res.json(await storage.getResponseBreakdown(wave.id));
  });

  app.post("/api/waves/:id/confirm-plan", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) return res.status(404).json({ message: "Wave not found" });
    if (wave.paymentStatus !== "paid") return res.status(403).json({ message: "Purchase this survey before confirming its start date." });
    if (wave.status === "closed") return res.status(409).json({ message: "A completed survey cannot be reopened. Purchase a new survey." });
    const parsed = surveyPlanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid plan" });
    if (!parsed.data.opensAt || !parsed.data.closesAt) return res.status(400).json({ message: "Set both a start date and a planned closing date." });
    if (wave.status === "not_started" && !wave.orientationCompletedAt) {
      return res.status(403).json({ message: ORIENTATION_REQUIRED_MESSAGE, code: "ORIENTATION_REQUIRED" });
    }
    const paidTier = wave.sizeTier && wave.sizeTier in PRICING_TIERS ? PRICING_TIERS[wave.sizeTier as keyof typeof PRICING_TIERS] : null;
    if (paidTier?.max != null && parsed.data.minSampleSize > paidTier.max) {
      return res.status(409).json({ message: `Your adult total is above the ${paidTier.label} range you purchased. Please contact admin@jesusjourney.life to move to the right range.`, code: "ABOVE_PURCHASED_RANGE" });
    }
    if (wave.status === "not_started" && parsed.data.closesAt < new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ message: "Choose a closing date that has not already passed." });
    }
    try {
      const updated = await storage.confirmWavePlan(wave.id, req.churchId!, parsed.data);
      if (wave.status === "not_started") void onSurveyActivated(wave.id);
      res.json({ wave: sanitizeWave(updated) });
    } catch (error: any) {
      if (error instanceof OrientationRequiredError) return res.status(403).json({ message: error.message, code: error.code });
      res.status(409).json({ message: error.message });
    }
  });

  // Survey Action Plan (timeline) ----------------------------------------

  // Returns the full 14-phase plan with computed dates. If opensAt isn't set
  // yet, phase dates come back null and the client renders relative offsets
  // instead ("2 weeks before your start date") as a preview.
  app.get("/api/waves/:id/timeline", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    const overrides = await storage.getTimelinePhaseOverrides(wave.id);
    const overrideByKey = new Map(overrides.map((o) => [o.phaseKey, o]));
    const computed = computeTimelineDates(wave.opensAt, wave.closesAt);
    const phases = computed.map((phase) => {
      const override = overrideByKey.get(phase.key);
      return {
        ...phase,
        date: override?.overrideDate ?? phase.date,
        isAdjusted: !!override?.overrideDate,
        calculatedDate: phase.date,
      };
    });
    res.json({ wave: sanitizeWave(wave), phases });
  });

  const setWaveDatesSchema = z.object({
    opensAt: calendarDate,
    // If omitted, closesAt is auto-generated as opensAt + 2 weeks per the guide's
    // suggested schedule. Pass closesAt explicitly to override that default.
    closesAt: calendarDate.optional(),
  });

  // Sets or revises the survey's start date. Revising the start date after it
  // was already set re-shifts the ENTIRE plan (both prep/launch phases before
  // it and debrief/act phases after the end date), since every phase is
  // computed as an offset from these two anchors — there is nothing else to
  // update server-side; the client just re-fetches /timeline afterward.
  app.patch("/api/waves/:id/dates", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    if (wave.paymentStatus !== "paid") return res.status(403).json({ message: "Purchase is required to set survey dates." });
    if (wave.status === "closed") {
      return res.status(409).json({ message: "This survey is already closed; its dates can't be changed." });
    }
    const parsed = setWaveDatesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid dates", errors: parsed.error.flatten() });
    }
    const opensAt = parsed.data.opensAt;
    const closesAt = parsed.data.closesAt ?? defaultClosesAt(opensAt);
    if (closesAt < opensAt) return res.status(400).json({ message: "Closing date cannot precede start date." });
    const updated = await storage.setWaveDates(wave.id, opensAt, closesAt);
    res.json({ wave: updated });
  });

  const extendClosesAtSchema = z.object({
    closesAt: calendarDate,
  });

  // Extends (or otherwise revises) just the end date — e.g. the 50% response
  // threshold hasn't been reached yet. This only affects phases anchored to
  // "closes" (debrief/act, which shift with it); prep/launch phases already
  // anchored to opensAt are untouched.
  app.patch("/api/waves/:id/extend-close", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    if (wave.paymentStatus !== "paid") return res.status(403).json({ message: "Purchase is required." });
    if (wave.status === "closed") {
      return res.status(409).json({ message: "This survey is already closed; its dates can't be changed." });
    }
    if (!wave.opensAt) {
      return res.status(409).json({ message: "Set a start date before extending the end date." });
    }
    const parsed = extendClosesAtSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid date", errors: parsed.error.flatten() });
    }
    if (parsed.data.closesAt < wave.opensAt) return res.status(400).json({ message: "Closing date cannot precede start date." });
    const updated = await storage.setWaveDates(wave.id, wave.opensAt, parsed.data.closesAt);
    res.json({ wave: updated });
  });

  const nudgePhaseSchema = z.object({
    // Null clears the manual override and reverts to the calculated default.
    date: calendarDate.nullable(),
  });

  // Nudges a single phase to a manually-chosen date. This marks that phase as
  // "adjusted" so a later opensAt/closesAt change won't silently overwrite it
  // (see GET /timeline: overrides always win over the calculated date).
  app.patch("/api/waves/:id/timeline/:phaseKey", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    if (wave.paymentStatus !== "paid" || wave.status === "closed") return res.status(403).json({ message: "Only a purchased, unfinished survey can be adjusted." });
    const phaseKey = String(req.params.phaseKey);
    if (["full_launch", "survey_closes"].includes(phaseKey)) return res.status(400).json({ message: "Change the plan's start or closing date instead." });
    if (!TIMELINE_PHASES.some((p) => p.key === phaseKey)) {
      return res.status(404).json({ message: "Unknown timeline phase" });
    }
    const parsed = nudgePhaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid date", errors: parsed.error.flatten() });
    }
    const override = await storage.upsertTimelinePhaseOverride(wave.id, phaseKey, parsed.data.date);
    res.json({ override });
  });

  // Downloads the whole plan (or a single phase, with ?phase=<key>) as an
  // .ics file the church can import into Google Calendar, Apple Calendar, or
  // Outlook. Only phases with a resolved (non-null) date are included.
  app.get("/api/waves/:id/timeline.ics", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    if (wave.paymentStatus !== "paid" || !["live", "prep", "closing_soon", "closed"].includes(wave.status)) {
      return res.status(403).json({ message: "Confirm your purchased survey's action plan before adding it to your calendar." });
    }
    const overrides = await storage.getTimelinePhaseOverrides(wave.id);
    const overrideByKey = new Map(overrides.map((o) => [o.phaseKey, o]));
    const computed = computeTimelineDates(wave.opensAt, wave.closesAt).map((phase) => ({
      ...phase,
      date: overrideByKey.get(phase.key)?.overrideDate ?? phase.date,
    }));
    const onlyPhase = typeof req.query.phase === "string" ? req.query.phase : undefined;
    const selected = onlyPhase ? computed.filter((p) => p.key === onlyPhase) : computed;
    const ics = buildTimelineIcs(wave.label, selected, wave.id);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${wave.label.replace(/[^A-Za-z0-9-]+/g, "-")}-action-plan${onlyPhase ? `-${onlyPhase}` : ""}.ics"`,
    );
    res.send(ics);
  });

  app.post("/api/waves/:id/close", requireChurchAuth, async (req: AuthedRequest, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave || wave.churchId !== req.churchId) {
      return res.status(404).json({ message: "Wave not found" });
    }
    if (wave.status === "closed") {
      return res.status(409).json({ message: "This survey wave is already closed" });
    }
    if (!acceptsResponses(wave)) return res.status(403).json({ message: "Payment and start-date confirmation are required before closing." });
    try {
      const closed = await closeSurvey(wave.id);
      void onReportsReady(wave.id); // only after verified reports were committed
      res.json(closed);
    } catch (err) {
      if (err instanceof SurveyCloseError) return res.status(err.status).json({ message: err.message, code: err.code });
      throw err;
    }
  });

  // -------------------------------------------------------------------
  // Public: join a survey by code, submit a response
  // -------------------------------------------------------------------
  app.get("/api/survey-display", (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Vary", "CF-IPCountry");
    res.json({ ethnicityPreset: ethnicityPresetForCountry(req.get("CF-IPCountry")) });
  });
  app.get("/api/join/:code", async (req, res) => {
    if (isParticipantDemoCode(req.params.code)) return res.json(PARTICIPANT_DEMO_META);
    const wave = await storage.getWaveByJoinCode(String(req.params.code));
    if (!wave) return res.status(404).json({ message: "No survey found with that code" });
    if (wave.status === "closed") {
      return res.status(410).json({ message: "This survey is now closed" });
    }
    if (!acceptsResponses(wave)) {
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
    // Defense in depth: even a direct or stale-client demo submission cannot
    // look up a wave or write to the database.
    if (isParticipantDemoCode(req.body?.joinCode)) {
      return res.status(403).json({ message: "The participant demo does not collect responses.", code: "PARTICIPANT_DEMO_READ_ONLY" });
    }
    const parsed = submitResponseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid response data", errors: parsed.error.flatten() });
    }
    const { joinCode, items, journeyPre, journeyPost, spiritualChange, demographics, comment } = parsed.data;
    const wave = await storage.getWaveByJoinCode(joinCode);
    if (!wave) return res.status(404).json({ message: "No survey found with that code" });
    if (wave.status === "closed") return res.status(410).json({ message: "This survey is now closed" });
    if (isDemoChurch(wave.churchId)) return res.status(403).json({ message: "The demo does not collect real responses." });
    if (!acceptsResponses(wave)) {
      return res.status(403).json({ message: "This survey has not been opened by the church yet" });
    }

    const itemColumns: Record<string, number> = {};
    for (const code of ITEM_CODES) {
      const upper = code.toUpperCase();
      if (typeof items[upper] === "number") itemColumns[code] = items[upper];
    }

    try {
    await saveChurchResponse(wave.id, {
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
      childrenInHousehold: demographics?.children?.length ? JSON.stringify(demographics.children) : null,
      raceEthnicity: encodeEthnicity(demographics?.ethnicity),
      commentText: comment ?? null,
    } as any);
    } catch (err) {
      if (err instanceof SurveyCloseError) return res.status(err.status).json({ message: err.message, code: err.code });
      throw err;
    }

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
    if (req.isPublicDemo) {
      return res.json({ snapshot: { respondentCount: snapshot.respondentCount, summary: projectDemographicSummary(JSON.parse(snapshot.summaryJson)) } });
    }
    res.json({ snapshot: { ...safeSnapshot(snapshot), summary: projectDemographicSummary(JSON.parse(snapshot.summaryJson)) } });
  });

  // Church PDFs. Both kinds come from one loader so a button can never be
  // served the other report.
  const PDF_KINDS = {
    report: { filename: "Our-Journey-with-Jesus-Report.pdf", missing: "Full PDF report is not available for this wave" },
    comments: { filename: "Comments-Report.pdf", missing: "Comments report is not available for this wave" },
    // Derived from the saved Comments Report, so it exists whenever that does.
    wordcloud: { filename: "Comments-Wordcloud.pdf", missing: "Comments wordcloud is not available for this wave" },
  } as const;
  type PdfKind = keyof typeof PDF_KINDS;
  async function loadChurchPdf(waveId: string, churchId: string | undefined, kind: PdfKind): Promise<Buffer | { status: number; message: string }> {
    const wave = await storage.getWaveById(waveId);
    if (!wave || wave.churchId !== churchId) return { status: 404, message: "Wave not found" };
    const snapshot = await storage.getSnapshotByWave(wave.id);
    const path = kind === "report" ? snapshot?.reportPdfPath : snapshot?.commentsReportPdfPath;
    if (!path) return { status: 404, message: PDF_KINDS[kind].missing };
    if (kind === "wordcloud") {
      try {
        const cloud = await getWordcloudPdf(wave.id, path);
        return cloud ?? { status: 404, message: PDF_KINDS[kind].missing };
      } catch (err) {
        console.error("Comments wordcloud failed for wave", wave.id, err);
        return { status: 500, message: "The comments wordcloud could not be prepared. Please try again." };
      }
    }
    const pdfBuffer = await fetchReportPdf(path);
    if (!pdfBuffer) return { status: 404, message: PDF_KINDS[kind].missing };
    return kind === "report" ? await projectChurchPdf(pdfBuffer) : pdfBuffer;
  }
  async function sendChurchPdf(res: any, waveId: string, churchId: string | undefined, kind: PdfKind, disposition: "attachment" | "inline") {
    const result = await loadChurchPdf(waveId, churchId, kind);
    if (!Buffer.isBuffer(result)) return res.status(result.status).json({ message: result.message });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${PDF_KINDS[kind].filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(result);
  }

  app.get("/api/waves/:id/report.pdf", requireChurchAuth, async (req: AuthedRequest, res) => {
    await sendChurchPdf(res, String(req.params.id), req.churchId, "report", "attachment");
  });

  app.get("/api/waves/:id/comments-report.pdf", requireChurchAuth, async (req: AuthedRequest, res) => {
    await sendChurchPdf(res, String(req.params.id), req.churchId, "comments", "attachment");
  });

  app.get("/api/waves/:id/comments-wordcloud.pdf", requireChurchAuth, async (req: AuthedRequest, res) => {
    await sendChurchPdf(res, String(req.params.id), req.churchId, "wordcloud", "attachment");
  });

  // Short-lived view links so a PDF can open in its own browser tab (iPad/iPhone
  // Safari can't show a bearer-token download without leaving the dashboard).
  // The random token is the only credential; it expires after 10 minutes.
  const pdfLinks = new Map<string, { waveId: string; churchId: string; kind: PdfKind; expires: number }>();
  app.get("/api/waves/:id/pdf-link", requireChurchAuth, async (req: AuthedRequest, res) => {
    const kind = String(req.query.kind ?? "") as PdfKind;
    if (!(kind in PDF_KINDS)) return res.status(400).json({ message: "Unknown report type" });
    const waveId = String(req.params.id);
    const wave = await storage.getWaveById(waveId);
    if (!wave || wave.churchId !== req.churchId) return res.status(404).json({ message: "Wave not found" });
    const snapshot = await storage.getSnapshotByWave(wave.id);
    if (!(kind === "report" ? snapshot?.reportPdfPath : snapshot?.commentsReportPdfPath)) {
      return res.status(404).json({ message: PDF_KINDS[kind].missing });
    }
    const now = Date.now();
    for (const [t, v] of Array.from(pdfLinks.entries())) if (v.expires < now) pdfLinks.delete(t);
    const token = randomBytes(24).toString("base64url");
    pdfLinks.set(token, { waveId, churchId: req.churchId!, kind, expires: now + 10 * 60 * 1000 });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ url: `/api/pdf/${token}/${PDF_KINDS[kind].filename}` });
  });

  app.get("/api/pdf/:token/:filename", async (req, res) => {
    const link = pdfLinks.get(String(req.params.token));
    if (!link || link.expires < Date.now()) {
      return res.status(410).type("text/plain").send("This report link has expired. Return to your dashboard and open the report again.");
    }
    await sendChurchPdf(res, link.waveId, link.churchId, link.kind, "inline");
  });

  // -------------------------------------------------------------------
  // Admin (Gary) — separate login, session, and operator view
  // -------------------------------------------------------------------
  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    const usernameOk = typeof username === "string" && username.trim().toLowerCase() === getAdminUsername();
    if (!usernameOk || !password || password !== getAdminPassword()) {
      return res.status(401).json({ message: "Incorrect username or password" });
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
    const allLegacySnapshots = await storage.getAllLegacySnapshots();
    const result = await Promise.all(
      allChurches
        .map(async (church) => {
          const waves = await Promise.all(
            allWaves
              .filter((w) => w.churchId === church.id)
              .map(async (w) => {
                const snapshot = await storage.getSnapshotByWave(w.id);
                const debriefing = await storage.getDebriefingReportByWave(w.id);
                return {
                  wave: sanitizeWave(w),
                  responseCount: w.status === "closed" ? snapshot?.respondentCount ?? 0 : await storage.countResponsesByWave(w.id),
                  hasReport: !!snapshot,
                  hasReportPdf: !!snapshot?.reportPdfPath,
                  hasCommentsReportPdf: !!snapshot?.commentsReportPdfPath,
                  hasDebriefingReport: !!debriefing,
                  hasDebriefingReportPdf: !!debriefing,
                  hasSurveyReviewPdf: !!debriefing?.surveyReviewPdfPath,
                  hasFacilitatorPdf: !!debriefing?.facilitatorPdfPath,
                };
              }),
          );
          const statusRank = (status: string) => (status === "closed" ? 1 : 0);
          waves.sort((a, b) => {
            const rankDiff = statusRank(a.wave.status) - statusRank(b.wave.status);
            if (rankDiff !== 0) return rankDiff;
            return a.wave.createdAt < b.wave.createdAt ? 1 : -1;
          });
          const legacySnapshots = allLegacySnapshots
            .filter((s) => s.churchId === church.id)
            .map((s) => ({
              id: s.id,
              respondentCount: s.respondentCount,
              // Imported printed percentages cannot establish a category count.
              summary: { ...JSON.parse(s.summaryJson), demographics: {} },
              sourceFileNote: s.sourceFileNote,
              createdAt: s.createdAt,
            }));
          return {
            church: sanitizeChurch(church),
            waves,
            legacySnapshots,
          };
        }),
    );
    result.sort((a, b) => (a.church.createdAt < b.church.createdAt ? 1 : -1));
    res.json({ churches: result });
  });

  app.post("/api/admin/waves/:id/close", requireAdminAuth, async (req, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave) return res.status(404).json({ message: "Wave not found" });
    if (isDemoChurch(wave.churchId)) return res.status(403).json({ message: "The shared demo is read-only." });
    if (!acceptsResponses(wave)) return res.status(409).json({ message: "Only an activated paid survey can be force closed." });
    if (wave.status === "closed") return res.status(409).json({ message: "Already closed" });
    try {
      const closed = await closeSurvey(wave.id, true);
      void onReportsReady(wave.id);
      res.json(closed);
    } catch (err) {
      if (err instanceof SurveyCloseError) return res.status(err.status).json({ message: err.message, code: err.code });
      throw err;
    }
  });

  app.get("/api/admin/waves/:id/report", requireAdminAuth, async (req, res) => {
    const snapshot = await storage.getSnapshotByWave(String(req.params.id));
    if (!snapshot) return res.status(404).json({ message: "Report not yet available" });
    res.json({ snapshot: { ...safeSnapshot(snapshot), summary: projectDemographicSummary(JSON.parse(snapshot.summaryJson)) } });
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
    res.send(await projectChurchPdf(pdfBuffer));
  });

  app.get("/api/admin/waves/:id/comments-wordcloud.pdf", requireAdminAuth, async (req, res) => {
    const waveId = String(req.params.id);
    const snapshot = await storage.getSnapshotByWave(waveId);
    if (!snapshot?.commentsReportPdfPath) {
      return res.status(404).json({ message: "Comments wordcloud is not available for this wave" });
    }
    try {
      const pdfBuffer = await getWordcloudPdf(waveId, snapshot.commentsReportPdfPath);
      if (!pdfBuffer) return res.status(404).json({ message: "Comments wordcloud is not available for this wave" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="Comments-Wordcloud.pdf"');
      res.send(pdfBuffer);
    } catch (err) {
      console.error("Comments wordcloud failed for wave", waveId, err);
      res.status(500).json({ message: "The comments wordcloud could not be prepared." });
    }
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

  // Phase 1 facilitator controls. Booking dates are informational; only an
  // authorized admin marking orientation complete unlocks activation.
  const journeySchema = z.object({
    orientationBookedAt: calendarDate.nullable().optional(),
    orientationCompleted: z.boolean().optional(),
    debriefBookedAt: calendarDate.nullable().optional(),
    debriefCompleted: z.boolean().optional(),
  });
  app.patch("/api/admin/waves/:id/journey", requireAdminAuth, async (req, res) => {
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave) return res.status(404).json({ message: "Wave not found" });
    if (isDemoChurch(wave.churchId)) return res.status(403).json({ message: "The shared demo is read-only." });
    if (wave.paymentStatus !== "paid") return res.status(409).json({ message: "Only a paid survey has an orientation and debrief." });
    const parsed = journeySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid update" });
    const p = parsed.data;
    const update: Parameters<typeof storage.updateWaveJourney>[1] = {};
    if (p.orientationBookedAt !== undefined) update.orientationBookedAt = p.orientationBookedAt;
    if (p.orientationCompleted === true && !wave.orientationCompletedAt) {
      if (wave.status === "closed") return res.status(409).json({ message: "This survey is already closed." });
      update.orientationCompletedAt = new Date();
    }
    if (p.orientationCompleted === false && wave.orientationCompletedAt) {
      if (wave.status !== "not_started") return res.status(409).json({ message: "Orientation cannot be undone after the survey has been activated." });
      update.orientationCompletedAt = null;
    }
    if (p.debriefBookedAt !== undefined) update.debriefBookedAt = p.debriefBookedAt;
    if (p.debriefCompleted !== undefined) {
      if (wave.status !== "closed") return res.status(409).json({ message: "The results debrief follows survey closure." });
      update.debriefCompletedAt = p.debriefCompleted ? (wave.debriefCompletedAt ?? new Date()) : null;
    }
    const updated = await storage.updateWaveJourney(wave.id, update);
    if (update.orientationCompletedAt) void onOrientationCompleted(wave.id);
    if (update.debriefCompletedAt && !wave.debriefCompletedAt) void onDebriefCompleted(wave.id);
    // First time a debrief date is recorded for a closed survey: email the church its Survey Review (sent once).
    if (update.debriefBookedAt && !wave.debriefBookedAt && wave.status === "closed") void onDebriefBooked(wave.id);
    res.json({ wave: sanitizeWave(updated) });
  });

  app.get("/api/admin/waves/:id/emails", requireAdminAuth, async (req, res) => {
    const events = await storage.getEmailEventsByWave(String(req.params.id));
    res.json({
      events: events.map((e) => ({ ...e, label: (EMAIL_TYPE_LABELS as Record<string, string>)[e.eventType] ?? e.eventType })),
      resendable: RESENDABLE.map((type) => ({ type, label: EMAIL_TYPE_LABELS[type] })),
    });
  });

  app.post("/api/admin/waves/:id/emails/resend", requireAdminAuth, async (req, res) => {
    const type = String(req.body?.eventType ?? "") as ClientEmailType;
    if (!RESENDABLE.includes(type)) return res.status(400).json({ message: "This message cannot be resent manually." });
    const wave = await storage.getWaveById(String(req.params.id));
    if (!wave) return res.status(404).json({ message: "Wave not found" });
    if (isDemoChurch(wave.churchId)) return res.status(403).json({ message: "The shared demo is read-only." });
    try {
      res.json({ outcomes: await adminResend(type, wave.id) });
    } catch (err: any) {
      res.status(409).json({ message: err?.message ?? "Could not resend" });
    }
  });

  // Admin-only internal analysis report — never exposed to church accounts.
  app.get("/api/admin/waves/:id/debriefing", requireAdminAuth, async (req, res) => {
    const debriefing = await storage.getDebriefingReportByWave(String(req.params.id));
    if (!debriefing) return res.status(404).json({ message: "Debriefing report is not yet available" });
    const { reportJson, ...metadata } = debriefing;
    res.json({ debriefing: { ...metadata, report: projectReportForDisplay(JSON.parse(reportJson)) } });
  });

  // Survey Review (church-facing) and Facilitator's Report, saved at close.
  for (const [route, field, filename] of [
    ["survey-review.pdf", "surveyReviewPdfPath", SURVEY_REVIEW_FILENAME],
    ["facilitator.pdf", "facilitatorPdfPath", FACILITATOR_FILENAME],
  ] as const) {
    app.get(`/api/admin/waves/:id/${route}`, requireAdminAuth, async (req, res) => {
      const debriefing = await storage.getDebriefingReportByWave(String(req.params.id));
      const key = debriefing?.[field];
      if (!key) return res.status(404).json({ message: "This report is not available for this survey" });
      const pdf = await fetchReportPdf(key);
      if (!pdf) return res.status(503).json({ message: "The saved report could not be loaded. Please try again." });
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdf);
    });
  }

  app.get("/api/admin/waves/:id/debriefing.pdf", requireAdminAuth, async (req, res) => {
    const debriefing = await storage.getDebriefingReportByWave(String(req.params.id));
    if (!debriefing) {
      return res.status(404).json({ message: "Debriefing report PDF is not available for this wave" });
    }
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderDebriefingPdfBuffer(JSON.parse(debriefing.reportJson));
    } catch (error) {
      console.error("Debriefing PDF render failed", error);
      return res.status(503).json({ message: "The paired PDF could not be prepared. Your saved report is unchanged; please try again." });
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Debriefing-Report.pdf"');
    res.send(pdfBuffer);
  });

  // -------------------------------------------------------------------
  // Calendly webhook — a booked "Debriefing Call" records the debrief date and
  // emails the Survey Review once. Signed with CALENDLY_WEBHOOK_SIGNING_KEY.
  app.post("/api/calendly/webhook", async (req, res) => {
    const key = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    if (!key) return res.status(503).json({ error: "Calendly webhook not configured" });
    const rawBody = req.rawBody as Buffer | undefined;
    if (!rawBody) return res.status(400).json({ error: "Missing body" });
    const check = verifyCalendlySignature(rawBody, req.headers["calendly-webhook-signature"] as string | undefined, key);
    if (!check.valid) {
      console.error("Calendly webhook signature verification failed:", check.reason);
      return res.status(400).json({ error: "Invalid signature" });
    }
    try {
      const outcome = await handleCalendlyEvent(req.body);
      console.log("Calendly webhook:", req.body?.event, outcome);
      res.json({ ok: true, outcome });
    } catch (err: any) {
      console.error("Calendly webhook handling error:", err?.message ?? err);
      res.status(500).json({ error: "Handling failed" });
    }
  });

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
          if (wave && !sessionMatchesWavePrice(session, wave)) {
            // Base price is compared with the pre-tax subtotal (amount_total
            // includes GST/HST). A mismatch needs manual review.
            console.error(`Webhook: session ${session.id} subtotal ${session.amount_subtotal} ${session.currency} does not match wave ${wave.id} price ${wave.priceCents} ${wave.currency}; not activating`);
            return res.json({ received: true });
          }
          if (wave && wave.paymentStatus !== "paid") {
            await storage.markWavePaid(wave.id, session.payment_intent ?? undefined);
          }
          if (wave) void onWavePaid(wave.id); // idempotent: sends at most once per survey
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

  // Internal endpoint for the daily reminder sweep, triggered by a Render
  // Cron Job (see render-cron/README.md). Protected by a shared secret
  // rather than church auth, since it's not called by any browser session.
  app.post("/api/internal/run-reminder-sweep", async (req, res) => {
    const secret = process.env.INTERNAL_CRON_SECRET;
    if (!secret || req.header("x-cron-secret") !== secret) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const result = await runReminderSweep();
      let journey: Awaited<ReturnType<typeof runJourneySweep>> | { error: string };
      try { journey = await runJourneySweep(); } catch (err: any) { journey = { error: String(err?.message ?? err) }; }
      res.json({ ...result, journey });
    } catch (err: any) {
      console.error("Reminder sweep error:", err?.message ?? err);
      res.status(500).json({ message: "Reminder sweep failed" });
    }
  });

  return httpServer;
}
