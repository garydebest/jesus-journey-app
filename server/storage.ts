import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, and, sql } from "drizzle-orm";
import type { SurveyPlan, ResponseBreakdown } from "@shared/surveyAccess";
import { randomUUID } from "node:crypto";
import { safeDemographicCounts } from "@shared/demographicPolicy";
import * as schema from "@shared/schema";
import {
  churches,
  surveyWaves,
  respondents,
  responses,
  aggregateSnapshots,
  surveyTimelinePhases,
  debriefingReports,
  legacySnapshots,
  churchEmailEvents,
  type ChurchEmailEvent,
  type Church,
  type InsertChurch,
  type SurveyWave,
  type InsertWave,
  type Respondent,
  type EntryMode,
  type ResponseRow,
  type InsertResponse,
  type AggregateSnapshot,
  type SurveyTimelinePhase,
  type DebriefingReportRow,
  type LegacySnapshotRow,
} from "@shared/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — required for Postgres connection.");
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });

// Ensure tables exist (lightweight bootstrap; drizzle-kit push is the source of truth in dev)
const bootstrapSql = `
CREATE TABLE IF NOT EXISTS churches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  community_code TEXT NOT NULL UNIQUE,
  primary_contact_name TEXT NOT NULL,
  primary_contact_email TEXT NOT NULL UNIQUE,
  primary_contact_phone TEXT,
  password_hash TEXT NOT NULL,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS survey_waves (
  id TEXT PRIMARY KEY,
  church_id TEXT NOT NULL REFERENCES churches(id),
  label TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  opens_at TEXT,
  closes_at TEXT,
  min_sample_size INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'not_started',
  closed_at TEXT,
  report_generated_at TEXT,
  size_tier TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  price_cents INTEGER,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  paid_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS respondents (
  id TEXT PRIMARY KEY,
  wave_id TEXT REFERENCES survey_waves(id),
  entry_mode TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS responses (
  respondent_id TEXT PRIMARY KEY REFERENCES respondents(id),
  wave_id TEXT REFERENCES survey_waves(id),
  b1 INTEGER, b2 INTEGER, b3 INTEGER, b4 INTEGER, b5 INTEGER, b6 INTEGER, b7 INTEGER, b8 INTEGER, b9 INTEGER,
  k1 INTEGER, k2 INTEGER, k3 INTEGER, k4 INTEGER, k5 INTEGER, k6 INTEGER, k7 INTEGER, k8 INTEGER, k9 INTEGER,
  a1 INTEGER, a2 INTEGER, a3 INTEGER, a4 INTEGER, a5 INTEGER, a6 INTEGER, a7 INTEGER, a8 INTEGER, a9 INTEGER,
  l1 INTEGER, l2 INTEGER, l3 INTEGER, l4 INTEGER, l5 INTEGER, l6 INTEGER, l7 INTEGER, l8 INTEGER, l9 INTEGER,
  p1 INTEGER, p2 INTEGER, p3 INTEGER, p4 INTEGER, p5 INTEGER, p6 INTEGER, p7 INTEGER, p8 INTEGER, p9 INTEGER,
  c1 INTEGER, c2 INTEGER, c3 INTEGER, c4 INTEGER, c5 INTEGER, c6 INTEGER, c7 INTEGER, c8 INTEGER, c9 INTEGER,
  t1 INTEGER, t2 INTEGER, t3 INTEGER, t4 INTEGER, t5 INTEGER, t6 INTEGER, t7 INTEGER, t8 INTEGER, t9 INTEGER,
  journey_pre INTEGER,
  journey_post INTEGER,
  spiritual_change INTEGER,
  gender TEXT,
  age_group TEXT,
  relationship_status TEXT,
  attendance_frequency TEXT,
  tenure TEXT,
  small_group_frequency TEXT,
  volunteer_frequency TEXT,
  children_in_household TEXT,
  race_ethnicity TEXT,
  comment_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS aggregate_snapshots (
  id TEXT PRIMARY KEY,
  wave_id TEXT NOT NULL UNIQUE REFERENCES survey_waves(id),
  church_id TEXT NOT NULL REFERENCES churches(id),
  respondent_count INTEGER NOT NULL,
  summary_json TEXT NOT NULL,
  report_pdf_path TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

// Lightweight forward-only migration guard: adds columns introduced after a
// database already existed, mirroring the previous SQLite ensureColumn logic.
async function ensureColumn(table: string, column: string, ddl: string) {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column],
  );
  if (rows.length === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

let bootstrapped: Promise<void> | null = null;
export function ensureBootstrapped(): Promise<void> {
  if (!bootstrapped) {
    bootstrapped = (async () => {
      await pool.query(bootstrapSql);
      await ensureColumn("churches", "primary_contact_phone", "primary_contact_phone TEXT");
      await ensureColumn("churches", "survey_plan_json", "survey_plan_json TEXT");
      await ensureColumn("survey_waves", "size_tier", "size_tier TEXT");
      await ensureColumn("survey_waves", "payment_status", "payment_status TEXT NOT NULL DEFAULT 'unpaid'");
      await ensureColumn("survey_waves", "price_cents", "price_cents INTEGER");
      await ensureColumn("survey_waves", "stripe_checkout_session_id", "stripe_checkout_session_id TEXT");
      await ensureColumn("survey_waves", "stripe_payment_intent_id", "stripe_payment_intent_id TEXT");
      await ensureColumn("survey_waves", "paid_at", "paid_at TEXT");
      // Phase 1 client journey (additive, nullable or defaulted).
      await ensureColumn("churches", "survey_coordinator_name", "survey_coordinator_name TEXT");
      await ensureColumn("churches", "survey_coordinator_email", "survey_coordinator_email TEXT");
      await ensureColumn("churches", "lead_pastor_name", "lead_pastor_name TEXT");
      await ensureColumn("churches", "lead_pastor_email", "lead_pastor_email TEXT");
      await ensureColumn("churches", "lead_pastor_receives_results", "lead_pastor_receives_results BOOLEAN NOT NULL DEFAULT false");
      await ensureColumn("churches", "growth_plan_interest_at", "growth_plan_interest_at TIMESTAMPTZ");
      await ensureColumn("churches", "email_opt_in_growth_plan", "email_opt_in_growth_plan BOOLEAN NOT NULL DEFAULT false");
      // Survey Review and Facilitator's Report (October 2026).
      const { rows: hasDebriefTable } = await pool.query(`SELECT to_regclass('debriefing_reports') AS t`);
      if (hasDebriefTable[0]?.t) {
        await ensureColumn("debriefing_reports", "survey_review_pdf_path", "survey_review_pdf_path TEXT");
        await ensureColumn("debriefing_reports", "facilitator_pdf_path", "facilitator_pdf_path TEXT");
        await ensureColumn("debriefing_reports", "survey_review_json", "survey_review_json TEXT");
      }
      await ensureColumn("survey_waves", "orientation_booked_at", "orientation_booked_at TEXT");
      await ensureColumn("survey_waves", "orientation_completed_at", "orientation_completed_at TIMESTAMPTZ");
      await ensureColumn("survey_waves", "activated_at", "activated_at TIMESTAMPTZ");
      await ensureColumn("survey_waves", "debrief_booked_at", "debrief_booked_at TEXT");
      await ensureColumn("survey_waves", "debrief_completed_at", "debrief_completed_at TIMESTAMPTZ");
      await pool.query(`CREATE TABLE IF NOT EXISTS church_email_events (
        id TEXT PRIMARY KEY,
        church_id TEXT NOT NULL REFERENCES churches(id),
        wave_id TEXT REFERENCES survey_waves(id),
        event_type TEXT NOT NULL,
        recipient_email TEXT NOT NULL,
        recipient_role TEXT NOT NULL,
        status TEXT NOT NULL,
        provider_message_id TEXT,
        sent_at TIMESTAMPTZ,
        error_message TEXT,
        idempotency_key TEXT NOT NULL UNIQUE,
        triggered_by TEXT NOT NULL DEFAULT 'system',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS church_email_events_wave_idx ON church_email_events (wave_id)`);
    })();
  }
  return bootstrapped;
}

function genCode(len = 4): string {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I to avoid confusion
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const ORIENTATION_REQUIRED_MESSAGE = "Your survey has been purchased. Please complete your required Jesus Journey Survey Orientation before activating your participant code.";
export class OrientationRequiredError extends Error {
  code = "ORIENTATION_REQUIRED";
  constructor() { super(ORIENTATION_REQUIRED_MESSAGE); }
}

export interface WaveJourneyUpdate {
  orientationBookedAt?: string | null;
  orientationCompletedAt?: Date | null;
  debriefBookedAt?: string | null;
  debriefCompletedAt?: Date | null;
}

export interface IStorage {
  // Churches
  getChurchById(id: string): Promise<Church | undefined>;
  getChurchByEmail(email: string): Promise<Church | undefined>;
  getAllChurches(): Promise<Church[]>;
  createChurch(data: InsertChurch, passwordHash: string): Promise<Church>;
  updateChurchContact(id: string, data: schema.UpdateChurchContact): Promise<Church | undefined>;

  // Waves
  createWave(churchId: string, data: InsertWave, priceCents: number, currency: string): Promise<SurveyWave>;
  getWaveById(id: string): Promise<SurveyWave | undefined>;
  getWaveByJoinCode(code: string): Promise<SurveyWave | undefined>;
  getWavesByChurch(churchId: string): Promise<SurveyWave[]>;
  getAllWaves(): Promise<SurveyWave[]>;
  updateWaveStatus(id: string, status: schema.WaveStatus): Promise<SurveyWave | undefined>;
  setWaveClosed(id: string): Promise<SurveyWave | undefined>;
  markWaveReportGenerated(id: string): Promise<SurveyWave | undefined>;
  setWaveCheckoutSession(id: string, sessionId: string): Promise<SurveyWave | undefined>;
  getWaveByCheckoutSessionId(sessionId: string): Promise<SurveyWave | undefined>;
  markWavePaid(id: string, paymentIntentId: string | undefined): Promise<SurveyWave | undefined>;
  deleteUnpaidWave(id: string): Promise<void>;
  setWaveDates(id: string, opensAt: string | null, closesAt: string | null): Promise<SurveyWave | undefined>;
  saveChurchPlan(churchId: string, plan: SurveyPlan): Promise<void>;
  confirmWavePlan(waveId: string, churchId: string, plan: SurveyPlan): Promise<SurveyWave>;
  getResponseBreakdown(waveId: string): Promise<ResponseBreakdown>;
  updateWaveJourney(id: string, data: WaveJourneyUpdate): Promise<SurveyWave | undefined>;
  setGrowthPlanInterest(churchId: string, optIn: boolean): Promise<Church | undefined>;

  // Client-journey email audit
  claimEmailEvent(data: { churchId: string; waveId: string | null; eventType: string; recipientEmail: string; recipientRole: string; idempotencyKey: string; triggeredBy: string }): Promise<ChurchEmailEvent | undefined>;
  finishEmailEvent(id: string, result: { status: "sent" | "failed" | "skipped"; providerMessageId?: string | null; errorMessage?: string | null }): Promise<void>;
  getEmailEventsByWave(waveId: string): Promise<ChurchEmailEvent[]>;
  getEmailEventsByChurch(churchId: string): Promise<ChurchEmailEvent[]>;

  // Survey Action Plan (timeline) phase overrides
  getTimelinePhaseOverrides(waveId: string): Promise<SurveyTimelinePhase[]>;
  upsertTimelinePhaseOverride(waveId: string, phaseKey: string, overrideDate: string | null): Promise<SurveyTimelinePhase>;
  markTimelineReminderSent(waveId: string, phaseKey: string): Promise<void>;
  getAllTimelinePhaseOverrides(): Promise<SurveyTimelinePhase[]>;

  // Respondents & responses
  createRespondent(entryMode: EntryMode, waveId?: string): Promise<Respondent>;
  saveResponse(data: InsertResponse): Promise<ResponseRow>;
  getResponsesByWave(waveId: string): Promise<ResponseRow[]>;
  countResponsesByWave(waveId: string): Promise<number>;

  // Aggregate snapshots
  createAggregateSnapshot(data: Omit<AggregateSnapshot, "id" | "generatedAt">): Promise<AggregateSnapshot>;
  getSnapshotByWave(waveId: string): Promise<AggregateSnapshot | undefined>;
  getSnapshotsByChurch(churchId: string): Promise<AggregateSnapshot[]>;
  createDebriefingReport(data: Omit<DebriefingReportRow, "id" | "generatedAt">): Promise<DebriefingReportRow>;
  getDebriefingReportByWave(waveId: string): Promise<DebriefingReportRow | undefined>;
  setDebriefingReportPdfPath(waveId: string, reportPdfPath: string): Promise<DebriefingReportRow | undefined>;

  // Legacy (pre-app, PDF-sourced) historical snapshots
  createLegacyChurch(name: string, region: string | null): Promise<Church>;
  createLegacySnapshot(data: Omit<LegacySnapshotRow, "id" | "createdAt">): Promise<LegacySnapshotRow>;
  getLegacySnapshotsByChurch(churchId: string): Promise<LegacySnapshotRow[]>;
  getAllLegacySnapshots(): Promise<LegacySnapshotRow[]>;
}

export class DatabaseStorage implements IStorage {
  async getChurchById(id: string): Promise<Church | undefined> {
    const rows = await db.select().from(churches).where(eq(churches.id, id));
    return rows[0];
  }

  async getChurchByEmail(email: string): Promise<Church | undefined> {
    const rows = await db.select().from(churches).where(eq(churches.primaryContactEmail, email.toLowerCase()));
    return rows[0];
  }

  async getAllChurches(): Promise<Church[]> {
    return db.select().from(churches);
  }

  async createChurch(data: InsertChurch, passwordHash: string): Promise<Church> {
    let code = "";
    // ensure unique community code
    for (let attempts = 0; attempts < 10; attempts++) {
      code = `${data.name.replace(/[^A-Za-z]/g, "").slice(0, 5).toUpperCase() || "GRP"}-${genCode(4)}`;
      const existing = await db.select().from(churches).where(eq(churches.communityCode, code));
      if (existing.length === 0) break;
    }
    const rows = await db
      .insert(churches)
      .values({
        id: randomUUID(),
        name: data.name,
        primaryContactName: data.primaryContactName,
        primaryContactEmail: data.primaryContactEmail.toLowerCase(),
        primaryContactPhone: data.primaryContactPhone ?? null,
        passwordHash,
        region: data.region ?? null,
        communityCode: code,
      })
      .returning();
    return rows[0];
  }

  async updateChurchContact(id: string, data: schema.UpdateChurchContact): Promise<Church | undefined> {
    const updates: Partial<typeof churches.$inferInsert> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.primaryContactName !== undefined) updates.primaryContactName = data.primaryContactName;
    if (data.primaryContactEmail !== undefined) updates.primaryContactEmail = data.primaryContactEmail.toLowerCase();
    if (data.primaryContactPhone !== undefined) updates.primaryContactPhone = data.primaryContactPhone || null;
    if (data.region !== undefined) updates.region = data.region || null;
    if (data.surveyCoordinatorName !== undefined) updates.surveyCoordinatorName = data.surveyCoordinatorName || null;
    if (data.surveyCoordinatorEmail !== undefined) updates.surveyCoordinatorEmail = data.surveyCoordinatorEmail ? data.surveyCoordinatorEmail.toLowerCase() : null;
    if (data.leadPastorName !== undefined) updates.leadPastorName = data.leadPastorName || null;
    if (data.leadPastorEmail !== undefined) updates.leadPastorEmail = data.leadPastorEmail ? data.leadPastorEmail.toLowerCase() : null;
    if (data.leadPastorReceivesResults !== undefined) updates.leadPastorReceivesResults = data.leadPastorReceivesResults;
    if (Object.keys(updates).length === 0) return this.getChurchById(id);
    const rows = await db.update(churches).set(updates).where(eq(churches.id, id)).returning();
    return rows[0];
  }

  async createWave(churchId: string, data: InsertWave, priceCents: number, currency: string): Promise<SurveyWave> {
    let joinCode = "";
    for (let attempts = 0; attempts < 10; attempts++) {
      joinCode = genCode(5);
      const existing = await db.select().from(surveyWaves).where(eq(surveyWaves.joinCode, joinCode));
      if (existing.length === 0) break;
    }
    const rows = await db
      .insert(surveyWaves)
      .values({
        id: randomUUID(),
        churchId,
        label: data.label,
        opensAt: data.opensAt ?? null,
        closesAt: data.closesAt ?? null,
        minSampleSize: data.minSampleSize ?? 16,
        joinCode,
        status: "pending_payment",
        sizeTier: data.sizeTier,
        paymentStatus: "unpaid",
        priceCents,
        currency,
      })
      .returning();
    return rows[0];
  }

  async setWaveCheckoutSession(id: string, sessionId: string): Promise<SurveyWave | undefined> {
    const rows = await db
      .update(surveyWaves)
      .set({ stripeCheckoutSessionId: sessionId })
      .where(eq(surveyWaves.id, id))
      .returning();
    return rows[0];
  }

  async getWaveByCheckoutSessionId(sessionId: string): Promise<SurveyWave | undefined> {
    const rows = await db.select().from(surveyWaves).where(eq(surveyWaves.stripeCheckoutSessionId, sessionId));
    return rows[0];
  }

  async markWavePaid(id: string, paymentIntentId: string | undefined): Promise<SurveyWave | undefined> {
    const rows = await db
      .update(surveyWaves)
      .set({
        paymentStatus: "paid",
        status: "not_started",
        stripePaymentIntentId: paymentIntentId ?? null,
        paidAt: new Date().toISOString(),
      })
      .where(and(eq(surveyWaves.id, id), eq(surveyWaves.paymentStatus, "unpaid"), eq(surveyWaves.status, "pending_payment")))
      .returning();
    return rows[0] ?? this.getWaveById(id);
  }

  async deleteUnpaidWave(id: string): Promise<void> {
    await db.delete(surveyWaves).where(and(eq(surveyWaves.id, id), eq(surveyWaves.paymentStatus, "unpaid"), eq(surveyWaves.status, "pending_payment")));
  }

  async saveChurchPlan(churchId: string, plan: SurveyPlan): Promise<void> {
    await db.update(churches).set({ surveyPlanJson: JSON.stringify(plan) }).where(eq(churches.id, churchId));
  }

  async confirmWavePlan(waveId: string, churchId: string, plan: SurveyPlan): Promise<SurveyWave> {
    return db.transaction(async (tx) => {
      // Lock the wave so a duplicate confirmation cannot reactivate a closed
      // survey or race a different plan into the saved timeline.
      const [wave] = await tx.select().from(surveyWaves)
        .where(and(eq(surveyWaves.id, waveId), eq(surveyWaves.churchId, churchId))).for("update");
      if (!wave || wave.paymentStatus !== "paid" || wave.status === "closed") throw new Error("This survey cannot be activated.");
      // Phase 1 required-orientation gate, enforced under the wave lock so no
      // client or direct API call can activate an un-oriented survey.
      if (wave.status === "not_started" && !wave.orientationCompletedAt) throw new OrientationRequiredError();
      const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(responses).where(eq(responses.waveId, waveId));
      if (total > 0 && plan.minSampleSize !== wave.minSampleSize) throw new Error("The adult total is locked after the first response.");
      const [updated] = await tx.update(surveyWaves).set({
        opensAt: plan.opensAt, closesAt: plan.closesAt, minSampleSize: plan.minSampleSize, status: "live",
        ...(wave.activatedAt ? {} : { activatedAt: new Date() }),
      }).where(eq(surveyWaves.id, waveId)).returning();
      const existing = await tx.select().from(surveyTimelinePhases).where(eq(surveyTimelinePhases.waveId, waveId));
      for (const phase of existing) {
        await tx.update(surveyTimelinePhases).set({ overrideDate: plan.overrides[phase.phaseKey] ?? null, updatedAt: new Date() })
          .where(eq(surveyTimelinePhases.id, phase.id));
      }
      for (const [phaseKey, overrideDate] of Object.entries(plan.overrides)) {
        if (!existing.some((p) => p.phaseKey === phaseKey)) {
          await tx.insert(surveyTimelinePhases).values({ id: randomUUID(), waveId, phaseKey, overrideDate });
        }
      }
      await tx.update(churches).set({ surveyPlanJson: null }).where(eq(churches.id, churchId));
      return updated;
    });
  }

  async updateWaveJourney(id: string, data: WaveJourneyUpdate): Promise<SurveyWave | undefined> {
    const updates: Partial<typeof surveyWaves.$inferInsert> = {};
    for (const key of ["orientationBookedAt", "orientationCompletedAt", "debriefBookedAt", "debriefCompletedAt"] as const) {
      if (data[key] !== undefined) (updates as any)[key] = data[key];
    }
    if (Object.keys(updates).length === 0) return this.getWaveById(id);
    const rows = await db.update(surveyWaves).set(updates).where(eq(surveyWaves.id, id)).returning();
    return rows[0];
  }

  async setGrowthPlanInterest(churchId: string, optIn: boolean): Promise<Church | undefined> {
    const rows = await db.update(churches).set({ growthPlanInterestAt: new Date(), emailOptInGrowthPlan: optIn })
      .where(eq(churches.id, churchId)).returning();
    return rows[0];
  }

  /**
   * Atomically claims an idempotency key. Returns the row to send with, or
   * undefined if this exact message was already sent or is in flight. Failed
   * and skipped attempts may be re-claimed by a later sweep.
   */
  async claimEmailEvent(data: { churchId: string; waveId: string | null; eventType: string; recipientEmail: string; recipientRole: string; idempotencyKey: string; triggeredBy: string }): Promise<ChurchEmailEvent | undefined> {
    const inserted = await db.insert(churchEmailEvents).values({ id: randomUUID(), status: "sending", ...data })
      .onConflictDoNothing({ target: churchEmailEvents.idempotencyKey }).returning();
    if (inserted[0]) return inserted[0];
    const retried = await db.update(churchEmailEvents)
      .set({ status: "sending", errorMessage: null, recipientEmail: data.recipientEmail })
      .where(and(eq(churchEmailEvents.idempotencyKey, data.idempotencyKey), sql`${churchEmailEvents.status} in ('failed','skipped')`))
      .returning();
    return retried[0];
  }

  async finishEmailEvent(id: string, result: { status: "sent" | "failed" | "skipped"; providerMessageId?: string | null; errorMessage?: string | null }): Promise<void> {
    await db.update(churchEmailEvents).set({
      status: result.status,
      providerMessageId: result.providerMessageId ?? null,
      errorMessage: result.errorMessage ? result.errorMessage.slice(0, 500) : null,
      sentAt: new Date(),
    }).where(eq(churchEmailEvents.id, id));
  }

  async getEmailEventsByWave(waveId: string): Promise<ChurchEmailEvent[]> {
    return db.select().from(churchEmailEvents).where(eq(churchEmailEvents.waveId, waveId)).orderBy(desc(churchEmailEvents.createdAt));
  }

  async getEmailEventsByChurch(churchId: string): Promise<ChurchEmailEvent[]> {
    return db.select().from(churchEmailEvents).where(eq(churchEmailEvents.churchId, churchId)).orderBy(desc(churchEmailEvents.createdAt));
  }

  async getResponseBreakdown(waveId: string): Promise<ResponseBreakdown> {
    // Counts only, no answers, respondent IDs, timestamps or cross-tabs leave
    // the server through this endpoint. Every topic goes through the same
    // 10-person policy independently.
    const columns = {
      gender: responses.gender,
      age: responses.ageGroup,
      relationship: responses.relationshipStatus,
      attendance: responses.attendanceFrequency,
      tenure: responses.tenure,
      smallGroup: responses.smallGroupFrequency,
      volunteer: responses.volunteerFrequency,
    } as const;
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(responses).where(eq(responses.waveId, waveId));
    const out: any = { total, suppressed: {} };
    for (const [key, column] of Object.entries(columns)) {
      const groups = await db.select({ label: column, count: sql<number>`count(*)::int` })
        .from(responses).where(eq(responses.waveId, waveId)).groupBy(column);
      const safe = Object.entries(safeDemographicCounts(
        Object.fromEntries(groups.filter(g => g.label).map(g => [g.label!, g.count])), total,
      )).map(([label, count]) => ({ label, count }));
      out[key] = safe;
      out.suppressed[key] = !safe.length;
    }
    return out as ResponseBreakdown;
  }

  async setWaveDates(id: string, opensAt: string | null, closesAt: string | null): Promise<SurveyWave | undefined> {
    const rows = await db
      .update(surveyWaves)
      .set({ opensAt, closesAt })
      .where(eq(surveyWaves.id, id))
      .returning();
    return rows[0];
  }

  async getTimelinePhaseOverrides(waveId: string): Promise<SurveyTimelinePhase[]> {
    return db.select().from(surveyTimelinePhases).where(eq(surveyTimelinePhases.waveId, waveId));
  }

  async upsertTimelinePhaseOverride(waveId: string, phaseKey: string, overrideDate: string | null): Promise<SurveyTimelinePhase> {
    const existing = await db
      .select()
      .from(surveyTimelinePhases)
      .where(and(eq(surveyTimelinePhases.waveId, waveId), eq(surveyTimelinePhases.phaseKey, phaseKey)));
    if (existing[0]) {
      const rows = await db
        .update(surveyTimelinePhases)
        .set({ overrideDate, updatedAt: new Date() })
        .where(eq(surveyTimelinePhases.id, existing[0].id))
        .returning();
      return rows[0];
    }
    const rows = await db
      .insert(surveyTimelinePhases)
      .values({ id: randomUUID(), waveId, phaseKey, overrideDate })
      .returning();
    return rows[0];
  }

  async markTimelineReminderSent(waveId: string, phaseKey: string): Promise<void> {
    const existing = await db
      .select()
      .from(surveyTimelinePhases)
      .where(and(eq(surveyTimelinePhases.waveId, waveId), eq(surveyTimelinePhases.phaseKey, phaseKey)));
    if (existing[0]) {
      await db
        .update(surveyTimelinePhases)
        .set({ reminderSentAt: new Date(), updatedAt: new Date() })
        .where(eq(surveyTimelinePhases.id, existing[0].id));
      return;
    }
    await db
      .insert(surveyTimelinePhases)
      .values({ id: randomUUID(), waveId, phaseKey, overrideDate: null, reminderSentAt: new Date() });
  }

  async getAllTimelinePhaseOverrides(): Promise<SurveyTimelinePhase[]> {
    return db.select().from(surveyTimelinePhases);
  }

  async getWaveById(id: string): Promise<SurveyWave | undefined> {
    const rows = await db.select().from(surveyWaves).where(eq(surveyWaves.id, id));
    return rows[0];
  }

  async getWaveByJoinCode(code: string): Promise<SurveyWave | undefined> {
    const rows = await db.select().from(surveyWaves).where(eq(surveyWaves.joinCode, code.toUpperCase()));
    return rows[0];
  }

  async getWavesByChurch(churchId: string): Promise<SurveyWave[]> {
    // Order newest-first so the dashboard's "current wave" workflow card
    // (start / monitor / close buttons) always reflects the most recently
    // created wave, not an arbitrary DB row order that could resurface an
    // old closed survey ahead of a brand-new live one.
    return db
      .select()
      .from(surveyWaves)
      .where(eq(surveyWaves.churchId, churchId))
      .orderBy(desc(surveyWaves.createdAt));
  }

  async getAllWaves(): Promise<SurveyWave[]> {
    return db.select().from(surveyWaves);
  }

  async updateWaveStatus(id: string, status: schema.WaveStatus): Promise<SurveyWave | undefined> {
    const rows = await db.update(surveyWaves).set({ status }).where(eq(surveyWaves.id, id)).returning();
    return rows[0];
  }

  async setWaveClosed(id: string): Promise<SurveyWave | undefined> {
    const rows = await db
      .update(surveyWaves)
      .set({ status: "closed", closedAt: new Date().toISOString() })
      .where(eq(surveyWaves.id, id))
      .returning();
    return rows[0];
  }

  async markWaveReportGenerated(id: string): Promise<SurveyWave | undefined> {
    const rows = await db
      .update(surveyWaves)
      .set({ reportGeneratedAt: new Date().toISOString() })
      .where(eq(surveyWaves.id, id))
      .returning();
    return rows[0];
  }

  async createRespondent(entryMode: EntryMode, waveId?: string): Promise<Respondent> {
    const rows = await db
      .insert(respondents)
      .values({ id: randomUUID(), entryMode, waveId: waveId ?? null })
      .returning();
    return rows[0];
  }

  async saveResponse(data: InsertResponse): Promise<ResponseRow> {
    const rows = await db.insert(responses).values(data).returning();
    return rows[0];
  }

  async getResponsesByWave(waveId: string): Promise<ResponseRow[]> {
    return db.select().from(responses).where(eq(responses.waveId, waveId));
  }

  async countResponsesByWave(waveId: string): Promise<number> {
    const rows = await this.getResponsesByWave(waveId);
    return rows.length;
  }

  async createAggregateSnapshot(data: Omit<AggregateSnapshot, "id" | "generatedAt">): Promise<AggregateSnapshot> {
    const rows = await db
      .insert(aggregateSnapshots)
      .values({ id: randomUUID(), ...data })
      .returning();
    return rows[0];
  }

  async getSnapshotByWave(waveId: string): Promise<AggregateSnapshot | undefined> {
    const rows = await db.select().from(aggregateSnapshots).where(eq(aggregateSnapshots.waveId, waveId));
    return rows[0];
  }

  async getSnapshotsByChurch(churchId: string): Promise<AggregateSnapshot[]> {
    return db.select().from(aggregateSnapshots).where(eq(aggregateSnapshots.churchId, churchId));
  }

  async createDebriefingReport(data: Omit<DebriefingReportRow, "id" | "generatedAt">): Promise<DebriefingReportRow> {
    const rows = await db
      .insert(debriefingReports)
      .values({ id: randomUUID(), ...data })
      .returning();
    return rows[0];
  }

  async getDebriefingReportByWave(waveId: string): Promise<DebriefingReportRow | undefined> {
    const rows = await db.select().from(debriefingReports).where(eq(debriefingReports.waveId, waveId));
    return rows[0];
  }

  async setDebriefingReportPdfPath(waveId: string, reportPdfPath: string): Promise<DebriefingReportRow | undefined> {
    const rows = await db
      .update(debriefingReports)
      .set({ reportPdfPath })
      .where(eq(debriefingReports.waveId, waveId))
      .returning();
    return rows[0];
  }

  // ---- Legacy (pre-app, PDF-sourced) historical snapshots ----

  async createLegacyChurch(name: string, region: string | null): Promise<Church> {
    let code = "";
    for (let attempts = 0; attempts < 10; attempts++) {
      code = `${name.replace(/[^A-Za-z]/g, "").slice(0, 5).toUpperCase() || "GRP"}-${genCode(4)}`;
      const existing = await db.select().from(churches).where(eq(churches.communityCode, code));
      if (existing.length === 0) break;
    }
    // Legacy churches never sign in, so contact fields are placeholders — never used for
    // login or notifications. Email must still be unique to satisfy the column constraint.
    const placeholderEmail = `legacy+${randomUUID()}@jesusjourney.life`;
    const rows = await db
      .insert(churches)
      .values({
        id: randomUUID(),
        name,
        primaryContactName: "(legacy record — no live contact)",
        primaryContactEmail: placeholderEmail,
        primaryContactPhone: null,
        passwordHash: "legacy-no-login",
        region,
        communityCode: code,
      })
      .returning();
    return rows[0];
  }

  async createLegacySnapshot(data: Omit<LegacySnapshotRow, "id" | "createdAt">): Promise<LegacySnapshotRow> {
    const rows = await db
      .insert(legacySnapshots)
      .values({ id: randomUUID(), ...data })
      .returning();
    return rows[0];
  }

  async getLegacySnapshotsByChurch(churchId: string): Promise<LegacySnapshotRow[]> {
    return db.select().from(legacySnapshots).where(eq(legacySnapshots.churchId, churchId));
  }

  async getAllLegacySnapshots(): Promise<LegacySnapshotRow[]> {
    return db.select().from(legacySnapshots);
  }
}

export const storage = new DatabaseStorage();
