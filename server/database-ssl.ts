import type { ConnectionOptions } from "node:tls";
import { SUPABASE_ROOT_CA_2021 } from "./supabase-ca";

/**
 * Chooses TLS settings for the Postgres pool.
 * - URL already has sslmode=...: leave it to pg's connection-string handling (unchanged behaviour).
 * - Supabase host (*.supabase.com / *.supabase.co): verify the certificate chain against the
 *   official Supabase Root 2021 CA and check the hostname. Never falls back to unverified TLS.
 * - Any other host: previous behaviour (encrypted, unverified) so local/dev setups keep working.
 */
export function databaseSsl(connectionString: string): ConnectionOptions | undefined {
  if (connectionString.includes("sslmode=")) return undefined;
  let host = "";
  try {
    host = new URL(connectionString).hostname.toLowerCase();
  } catch {
    host = "";
  }
  if (/(^|\.)supabase\.(com|co)$/.test(host)) {
    return { ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true, servername: host };
  }
  return { rejectUnauthorized: false };
}
