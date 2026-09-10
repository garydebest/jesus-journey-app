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
  // Church's total number of adults (16+) in their congregation/group, entered before the
  // survey opens. The survey can only be closed and reports generated once actual responses
  // reach 50% of this number (see requiredResponsesForClose in server/routes.ts).
  // Column name kept as min_sample_size to avoid a migration; semantics changed from "exact
  // minimum responses" to "total adult count used as the 50% gating base".
  minSampleSize: integer("min_sample_size").notNull().default(16),
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
  minSampleSize: z.number().int().min(16, "Total number of adults must be at least 16."),
}).pick({
  label: true,
  minSampleSize: true,
  opensAt: true,
  closesAt: true,
  sizeTier: true,
});

// Actual response threshold required before a wave can be closed and reports generated:
// 50% of the church's total number of adults, rounded up.
export function requiredResponsesForClose(declaredTotal: number): number {
  return Math.ceil(declaredTotal * 0.5);
}

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
  commentsReportPdfPath: text("comments_report_pdf_path"), // Supabase Storage object key for the separate Comments Report PDF (e.g. "<waveId>-comments.pdf"), null if the wave had no written comments
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type AggregateSnapshot = typeof aggregateSnapshots.$inferSelect;
export type InsertAggregateSnapshot = typeof aggregateSnapshots.$inferInsert;

// ---------------------------------------------------------------------------
// Survey Action Plan — per-wave calendarized timeline. Base dates for every
// phase are computed on the fly from the wave's opensAt/closesAt (see
// shared/timeline.ts) so most phases never need a database row at all. A row
// only exists here once a church manually nudges a phase's date away from
// its calculated default, or once a reminder email has been sent for it —
// this table is the "diff" against the calculated plan, not the plan itself.
// ---------------------------------------------------------------------------
export const surveyTimelinePhases = pgTable("survey_timeline_phases", {
  id: text("id").primaryKey(), // uuid
  waveId: text("wave_id").notNull().references(() => surveyWaves.id),
  phaseKey: text("phase_key").notNull(), // matches TimelinePhaseDef.key in shared/timeline.ts
  // Manual override date (YYYY-MM-DD). Null means "use the calculated default".
  overrideDate: text("override_date"),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type SurveyTimelinePhase = typeof surveyTimelinePhases.$inferSelect;
export type InsertSurveyTimelinePhase = typeof surveyTimelinePhases.$inferInsert;

// ---------------------------------------------------------------------------
// Debriefing Reports — admin-only analytical companion to the church report.
// Generated once per wave, in the same close-wave request as the church
// report, from the same raw response rows, BEFORE those rows are purged.
// Additive only: no existing table's shape changes. One row per wave
// (idempotent — a re-close overwrites, never duplicates).
// ---------------------------------------------------------------------------
export const debriefingReports = pgTable("debriefing_reports", {
  id: text("id").primaryKey(), // uuid
  waveId: text("wave_id").notNull().unique().references(() => surveyWaves.id),
  churchId: text("church_id").notNull().references(() => churches.id),
  respondentCount: integer("respondent_count").notNull(),
  reportJson: text("report_json").notNull(), // full structured DebriefingReport (see shared/debriefing/types.ts)
  reportPdfPath: text("report_pdf_path"), // Supabase Storage object key in the "church-reports" bucket (e.g. "<waveId>-debrief.pdf")
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type DebriefingReportRow = typeof debriefingReports.$inferSelect;
export type InsertDebriefingReportRow = typeof debriefingReports.$inferInsert;
