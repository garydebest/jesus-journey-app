import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Churches — self-serve accounts for primary contacts
// ---------------------------------------------------------------------------
export const churches = pgTable("churches", {
  id: text("id").primaryKey(), // uuid
  name: text("name").notNull(),
  communityCode: text("community_code").notNull().unique(), // human-typeable join code, e.g. "GRACE-4821"
  primaryContactName: text("primary_contact_name").notNull(),
  primaryContactEmail: text("primary_contact_email").notNull().unique(),
  primaryContactPhone: text("primary_contact_phone"),
  passwordHash: text("password_hash").notNull(),
  region: text("region"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const insertChurchSchema = createInsertSchema(churches, {
  primaryContactEmail: z.string().email(),
}).omit({ id: true, createdAt: true, communityCode: true, passwordHash: true });

export type InsertChurch = z.infer<typeof insertChurchSchema>;
export type Church = typeof churches.$inferSelect;

// Editable subset for the church settings page — contact info only, never
// the join code, id, or password (password changes get their own flow).
export const updateChurchContactSchema = z.object({
  name: z.string().min(1).optional(),
  primaryContactName: z.string().min(1).optional(),
  primaryContactEmail: z.string().email().optional(),
  primaryContactPhone: z.string().optional(),
  region: z.string().optional(),
});

export type UpdateChurchContact = z.infer<typeof updateChurchContactSchema>;

// ---------------------------------------------------------------------------
// Survey waves — one per church survey period
// ---------------------------------------------------------------------------
export const WAVE_STATUSES = ["pending_payment", "not_started", "prep", "live", "closing_soon", "closed"] as const;
export type WaveStatus = (typeof WAVE_STATUSES)[number];

// Church size tiers used for pricing. Dollar amounts live in server/pricing.ts
// (not the schema) so they can be edited without a migration.
export const SIZE_TIERS = ["small", "medium", "large", "extra_large"] as const;
export type SizeTier = (typeof SIZE_TIERS)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const surveyWaves = pgTable("survey_waves", {
  id: text("id").primaryKey(), // uuid
  churchId: text("church_id").notNull().references(() => churches.id),
  label: text("label").notNull(), // e.g. "Fall 2026 Survey"
  joinCode: text("join_code").notNull().unique(), // short code respondents use to join, e.g. "4821"
  opensAt: text("opens_at"),
  closesAt: text("closes_at"),
  minSampleSize: integer("min_sample_size").notNull().default(10),
  status: text("status", { enum: WAVE_STATUSES }).notNull().default("not_started"),
  closedAt: text("closed_at"),
  reportGeneratedAt: text("report_generated_at"),
  sizeTier: text("size_tier", { enum: SIZE_TIERS }),
  paymentStatus: text("payment_status", { enum: PAYMENT_STATUSES }).notNull().default("unpaid"),
  priceCents: integer("price_cents"), // snapshot of the tier price at purchase time
  currency: text("currency").notNull().default("usd"), // ISO currency code the price/checkout was in (cad/usd/gbp/eur), snapshot at purchase time
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paidAt: text("paid_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const insertWaveSchema = createInsertSchema(surveyWaves, {
  sizeTier: z.enum(SIZE_TIERS),
}).pick({
  label: true,
  minSampleSize: true,
  opensAt: true,
  closesAt: true,
  sizeTier: true,
});

export type InsertWave = z.infer<typeof insertWaveSchema>;
export type SurveyWave = typeof surveyWaves.$inferSelect;

// ---------------------------------------------------------------------------
// Respondents — anonymous, either standalone individual or tied to a wave
// ---------------------------------------------------------------------------
export const ENTRY_MODES = ["individual_no_retention", "church_group"] as const;
export type EntryMode = (typeof ENTRY_MODES)[number];

export const respondents = pgTable("respondents", {
  id: text("id").primaryKey(), // uuid
  waveId: text("wave_id").references(() => surveyWaves.id),
  entryMode: text("entry_mode", { enum: ENTRY_MODES }).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type Respondent = typeof respondents.$inferSelect;

// ---------------------------------------------------------------------------
// Responses — raw per-respondent answers (church_group rows are purge-eligible
// after report generation; individual mode never persists a row at all)
// ---------------------------------------------------------------------------
const ITEM_CODES = [
  "b1","b2","b3","b4","b5","b6","b7","b8","b9",
  "k1","k2","k3","k4","k5","k6","k7","k8","k9",
  "a1","a2","a3","a4","a5","a6","a7","a8","a9",
  "l1","l2","l3","l4","l5","l6","l7","l8","l9",
  "p1","p2","p3","p4","p5","p6","p7","p8","p9",
  "c1","c2","c3","c4","c5","c6","c7","c8","c9",
  "t1","t2","t3","t4","t5","t6","t7","t8","t9",
] as const;

const itemColumns = Object.fromEntries(
  ITEM_CODES.map((code) => [code, integer(code)]),
) as Record<(typeof ITEM_CODES)[number], ReturnType<typeof integer>>;

export const responses = pgTable("responses", {
  respondentId: text("respondent_id").primaryKey().references(() => respondents.id),
  waveId: text("wave_id").references(() => surveyWaves.id),
  ...itemColumns,
  journeyPre: integer("journey_pre"), // Q1 pre-survey
  journeyPost: integer("journey_post"), // Q9 post-survey — feeds church report maturity profile
  spiritualChange: integer("spiritual_change"), // Q10
  gender: text("gender"),
  ageGroup: text("age_group"),
  relationshipStatus: text("relationship_status"),
  attendanceFrequency: text("attendance_frequency"),
  tenure: text("tenure"),
  smallGroupFrequency: text("small_group_frequency"),
  volunteerFrequency: text("volunteer_frequency"),
  childrenInHousehold: text("children_in_household"), // JSON-encoded string array
  raceEthnicity: text("race_ethnicity"),
  commentText: text("comment_text"), // church mode only, never shown per-respondent
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type InsertResponse = typeof responses.$inferInsert;
export type ResponseRow = typeof responses.$inferSelect;
export { ITEM_CODES };

// ---------------------------------------------------------------------------
// Aggregate snapshots — durable per-wave summary numbers, kept forever even
// after raw responses are purged, for historical comparison across waves.
// ---------------------------------------------------------------------------
export const aggregateSnapshots = pgTable("aggregate_snapshots", {
  id: text("id").primaryKey(), // uuid
  waveId: text("wave_id").notNull().unique().references(() => surveyWaves.id),
  churchId: text("church_id").notNull().references(() => churches.id),
  respondentCount: integer("respondent_count").notNull(),
  summaryJson: text("summary_json").notNull(), // pathway/goal averages, maturity distribution, demographics
  reportPdfPath: text("report_pdf_path"), // Supabase Storage object key in the "church-reports" bucket (e.g. "<waveId>.pdf"), if generated
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type AggregateSnapshot = typeof aggregateSnapshots.$inferSelect;
export type InsertAggregateSnapshot = typeof aggregateSnapshots.$inferInsert;
