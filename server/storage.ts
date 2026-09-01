import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as schema from "@shared/schema";
import {
  churches,
  surveyWaves,
  respondents,
  responses,
  aggregateSnapshots,
  type Church,
  type InsertChurch,
  type SurveyWave,
  type InsertWave,
  type Respondent,
  type EntryMode,
  type ResponseRow,
  type InsertResponse,
  type AggregateSnapshot,
} from "@shared/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — required for Postgres connection.");
}

const pool = new Pool({
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
      await ensureColumn("survey_waves", "size_tier", "size_tier TEXT");
      await ensureColumn("survey_waves", "payment_status", "payment_status TEXT NOT NULL DEFAULT 'unpaid'");
      await ensureColumn("survey_waves", "price_cents", "price_cents INTEGER");
      await ensureColumn("survey_waves", "stripe_checkout_session_id", "stripe_checkout_session_id TEXT");
      await ensureColumn("survey_waves", "stripe_payment_intent_id", "stripe_payment_intent_id TEXT");
      await ensureColumn("survey_waves", "paid_at", "paid_at TEXT");
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

export interface IStorage {
  // Churches
  getChurchById(id: string): Promise<Church | undefined>;
  getChurchByEmail(email: string): Promise<Church | undefined>;
  getAllChurches(): Promise<Church[]>;
  createChurch(data: InsertChurch, passwordHash: string): Promise<Church>;
  updateChurchContact(id: string, data: schema.UpdateChurchContact): Promise<Church | undefined>;

  // Waves
  createWave(churchId: string, data: InsertWave, priceCents: number): Promise<SurveyWave>;
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

  // Respondents & responses
  createRespondent(entryMode: EntryMode, waveId?: string): Promise<Respondent>;
  saveResponse(data: InsertResponse): Promise<ResponseRow>;
  getResponsesByWave(waveId: string): Promise<ResponseRow[]>;
  countResponsesByWave(waveId: string): Promise<number>;
  purgeResponsesByWave(waveId: string): Promise<number>;

  // Aggregate snapshots
  createAggregateSnapshot(data: Omit<AggregateSnapshot, "id" | "generatedAt">): Promise<AggregateSnapshot>;
  getSnapshotByWave(waveId: string): Promise<AggregateSnapshot | undefined>;
  getSnapshotsByChurch(churchId: string): Promise<AggregateSnapshot[]>;
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
    if (Object.keys(updates).length === 0) return this.getChurchById(id);
    const rows = await db.update(churches).set(updates).where(eq(churches.id, id)).returning();
    return rows[0];
  }

  async createWave(churchId: string, data: InsertWave, priceCents: number): Promise<SurveyWave> {
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
        minSampleSize: data.minSampleSize ?? 10,
        joinCode,
        status: "pending_payment",
        sizeTier: data.sizeTier,
        paymentStatus: "unpaid",
        priceCents,
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
        status: "live",
        stripePaymentIntentId: paymentIntentId ?? null,
        paidAt: new Date().toISOString(),
      })
      .where(eq(surveyWaves.id, id))
      .returning();
    return rows[0];
  }

  async deleteUnpaidWave(id: string): Promise<void> {
    await db.delete(surveyWaves).where(eq(surveyWaves.id, id));
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
    return db.select().from(surveyWaves).where(eq(surveyWaves.churchId, churchId));
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

  async purgeResponsesByWave(waveId: string): Promise<number> {
    const rows = await db.delete(responses).where(eq(responses.waveId, waveId)).returning();
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
}

export const storage = new DatabaseStorage();
