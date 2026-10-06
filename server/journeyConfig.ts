// ---------------------------------------------------------------------------
// Phase 1 client-journey configuration. Booking URLs are deploy-time
// configuration (Render environment variables) and are never hard-coded in
// React components or email templates. A missing or malformed URL produces a
// helpful fallback instead of a dead button.
// ---------------------------------------------------------------------------

export const SUPPORT_EMAIL = "admin@jesusjourney.life";
export const BOOKING_FALLBACK_MESSAGE = `Booking will be available shortly. Please contact ${SUPPORT_EMAIL}.`;

function httpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString().replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

export function bookingConfig() {
  return {
    orientationUrl: httpsUrl(process.env.ORIENTATION_CALENDLY_URL),
    debriefUrl: httpsUrl(process.env.DEBRIEF_CALENDLY_URL),
    // Intentionally unset in Phase 1: Growth Plan uses an interest form.
    growthPlanUrl: httpsUrl(process.env.GROWTH_PLAN_CALENDLY_URL),
    supportEmail: SUPPORT_EMAIL,
    fallbackMessage: BOOKING_FALLBACK_MESSAGE,
  };
}

export function internalNotificationsEmail(): string {
  return process.env.INTERNAL_NOTIFICATIONS_EMAIL?.trim() || SUPPORT_EMAIL;
}

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL?.trim() || "https://myjesusjourney.life").replace(/\/$/, "");
}

/** Whether journey emails are switched on. Defaults on; set JOURNEY_EMAILS_ENABLED=false to pause. */
export function journeyEmailsEnabled(): boolean {
  return (process.env.JOURNEY_EMAILS_ENABLED ?? "true").toLowerCase() !== "false";
}
