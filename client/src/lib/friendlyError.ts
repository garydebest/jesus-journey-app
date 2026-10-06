/** Turns a thrown API error ("400: {\"message\":...}" or plain text) into a readable message. */
export function friendlyError(err: unknown): string {
  const msg = String((err as any)?.message ?? err);
  const cleaned = msg.replace(/^\d+:\s*/, "");
  try {
    const parsed = JSON.parse(cleaned);
    return parsed.message ?? cleaned;
  } catch {
    return cleaned;
  }
}
