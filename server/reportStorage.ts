import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFile, unlink } from "node:fs/promises";

const BUCKET = "church-reports";

let cachedClient: SupabaseClient | null | undefined;

/**
 * Lazily creates the Supabase service-role client used to persist generated
 * church report PDFs. Returns null (and logs once) when the required env
 * vars are missing, so callers can fail soft instead of crashing the whole
 * request — e.g. wave-close should still succeed even if report storage is
 * temporarily misconfigured.
 */
function getClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — generated report PDFs will not be persisted to durable storage.",
    );
    cachedClient = null;
    return cachedClient;
  }
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

/**
 * Uploads a locally-generated report PDF to Supabase Storage and returns the
 * storage object key to save on the aggregate snapshot row. The local file
 * is a scratch artifact from the Python subprocess and is deleted after a
 * successful upload — Storage is the durable copy from this point on.
 */
export async function persistReportPdf(waveId: string, localPath: string): Promise<{ ok: true; storageKey: string } | { ok: false; error: string }> {
  const client = getClient();
  if (!client) return { ok: false, error: "Report storage is not configured (missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)" };

  try {
    const buf = await readFile(localPath);
    const storageKey = `${waveId}.pdf`;
    const { error } = await client.storage.from(BUCKET).upload(storageKey, buf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) return { ok: false, error: error.message };
    await unlink(localPath).catch(() => {});
    return { ok: true, storageKey };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Downloads a previously-persisted report PDF's bytes from Supabase Storage.
 * Returns null if storage is unconfigured or the object is missing.
 */
export async function fetchReportPdf(storageKey: string): Promise<Buffer | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client.storage.from(BUCKET).download(storageKey);
  if (error || !data) return null;
  const arrayBuf = await data.arrayBuffer();
  return Buffer.from(arrayBuf);
}
