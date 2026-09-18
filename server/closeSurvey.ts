import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./storage";
import { aggregateSnapshots, churches, debriefingReports, respondents, responses, surveyWaves, requiredResponsesForClose, type InsertResponse } from "@shared/schema";
import { acceptsResponses, isDemoChurch } from "@shared/surveyAccess";
import { computeWaveAggregate } from "@shared/aggregate";
import { buildDebriefingReport } from "@shared/debriefing/engine";
import { generateChurchReportPdf } from "./pdfReport";
import { generateDebriefingReportPdf } from "./debriefingPdf";

export class SurveyCloseError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

const reportFailureMessage = "The reports could not all be generated and safely saved. No responses have been deleted and your survey remains open. Please try again, or contact support if the problem continues.";
const renderers = { church: generateChurchReportPdf, debrief: generateDebriefingReportPdf };

/**
 * The wave lock serializes closing with response submission across processes.
 * All report metadata, closure and raw-response deletion commit together.
 * A render/upload/read-back/database failure rolls back everything in the DB.
 * Uploaded files may remain after rollback and are safely overwritten on retry.
 */
export async function closeSurvey(waveId: string, force = false, reports = renderers) {
  try {
    return await db.transaction(async (tx) => {
      const [wave] = await tx.select().from(surveyWaves).where(eq(surveyWaves.id, waveId)).for("update");
      if (!wave) throw new SurveyCloseError(404, "Wave not found");
      if (isDemoChurch(wave.churchId)) throw new SurveyCloseError(403, "The shared demo is read-only.");
      if (wave.status === "closed") throw new SurveyCloseError(409, "This survey wave is already closed");
      if (!acceptsResponses(wave)) throw new SurveyCloseError(403, "Payment and start-date confirmation are required before closing.");
      const rows = await tx.select().from(responses).where(eq(responses.waveId, waveId));
      const minimum = force ? 1 : requiredResponsesForClose(wave.minSampleSize);
      if (rows.length < minimum) throw new SurveyCloseError(400, `This survey needs at least ${minimum} responses before it can be closed. You currently have ${rows.length}.`);
      const [church] = await tx.select().from(churches).where(eq(churches.id, wave.churchId));
      const summary = computeWaveAggregate(rows);
      const pdf = await reports.church({
        waveId, churchName: church?.name ?? "Your Church", waveLabel: wave.label,
        waveCreatedAt: wave.createdAt, rows,
      });
      const hasComments = rows.some(row => row.commentText?.trim());
      if (!pdf.ok || !pdf.storageKey || (hasComments && !pdf.commentsStorageKey)) {
        throw new Error(pdf.error ?? "A required church or comments PDF was not saved");
      }
      const debrief = buildDebriefingReport({
        waveId, churchId: wave.churchId, churchName: church?.name ?? "Your Church",
        waveLabel: wave.label, rows,
      });
      const debriefPdf = await reports.debrief(waveId, debrief);
      if (!debriefPdf.ok || !debriefPdf.storageKey) throw new Error(debriefPdf.error ?? "Debriefing PDF was not saved");

      // No snapshot is exposed before every required PDF is saved and verified.
      const [snapshot] = await tx.insert(aggregateSnapshots).values({
        id: randomUUID(), waveId, churchId: wave.churchId,
        respondentCount: summary.respondentCount, summaryJson: JSON.stringify(summary),
        reportPdfPath: pdf.storageKey, commentsReportPdfPath: pdf.commentsStorageKey ?? null,
      }).returning();
      await tx.insert(debriefingReports).values({
        id: randomUUID(), waveId, churchId: wave.churchId,
        respondentCount: debrief.respondentCount, reportJson: JSON.stringify(debrief),
        reportPdfPath: debriefPdf.storageKey,
      });
      const now = new Date().toISOString();
      const [closed] = await tx.update(surveyWaves).set({
        status: "closed", closedAt: now, reportGeneratedAt: now,
      }).where(eq(surveyWaves.id, waveId)).returning();
      await tx.delete(responses).where(eq(responses.waveId, waveId));
      return { wave: closed, snapshot };
    });
  } catch (error) {
    if (error instanceof SurveyCloseError) throw error;
    console.error("Survey close aborted; responses retained", waveId, error);
    throw new SurveyCloseError(503, reportFailureMessage, "REPORTS_NOT_SAVED");
  }
}

/** Check status under the same wave lock used by closeSurvey, then save atomically. */
export async function saveChurchResponse(waveId: string, data: Omit<InsertResponse, "respondentId" | "waveId">) {
  return db.transaction(async tx => {
    const [wave] = await tx.select().from(surveyWaves).where(eq(surveyWaves.id, waveId)).for("share");
    if (!wave || wave.status === "closed") throw new SurveyCloseError(410, "This survey is now closed");
    if (isDemoChurch(wave.churchId) || !acceptsResponses(wave)) throw new SurveyCloseError(403, "This survey is not accepting responses.");
    const id = randomUUID();
    await tx.insert(respondents).values({ id, entryMode: "church_group", waveId });
    const [response] = await tx.insert(responses).values({ ...data, respondentId: id, waveId }).returning();
    return response;
  });
}
