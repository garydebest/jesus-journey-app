import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BookingConfig {
  orientationUrl: string | null;
  debriefUrl: string | null;
  growthPlanUrl: string | null;
  supportEmail: string;
  fallbackMessage: string;
}

const FALLBACK: BookingConfig = {
  orientationUrl: null, debriefUrl: null, growthPlanUrl: null,
  supportEmail: "admin@jesusjourney.life",
  fallbackMessage: "Booking will be available shortly. Please contact admin@jesusjourney.life.",
};

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
let cached: Promise<BookingConfig> | null = null;
function loadBookingConfig(): Promise<BookingConfig> {
  if (!cached) {
    cached = fetch(`${API_BASE}/api/config/booking`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : FALLBACK))
      .catch(() => { cached = null; return FALLBACK; });
  }
  return cached;
}

/** Booking URLs come from deploy-time server configuration, never from source. */
export function useBookingConfig(): BookingConfig | null {
  const [config, setConfig] = useState<BookingConfig | null>(null);
  useEffect(() => { let live = true; loadBookingConfig().then((c) => live && setConfig(c)); return () => { live = false; }; }, []);
  return config;
}

/** Calendly passes utm_content back in its webhook, so the booking can be matched to the survey. */
export function withSurveyTag(url: string | null, waveId?: string | null): string | null {
  if (!url || !waveId) return url;
  try { const u = new URL(url); u.searchParams.set("utm_source", "jj-app"); u.searchParams.set("utm_content", waveId); return u.toString(); } catch { return url; }
}

export function BookingButton({ kind, variant = "default", size = "default", className = "", disabled = false, waveId }: {
  kind: "orientation" | "debrief";
  waveId?: string | null;
  variant?: "default" | "outline";
  size?: "default" | "sm";
  className?: string;
  disabled?: boolean;
}) {
  const config = useBookingConfig();
  const label = kind === "orientation" ? "Book your orientation" : "Book your results debrief";
  if (!config) return <Button variant={variant} size={size} className={className} disabled>{label}</Button>;
  const href = kind === "orientation" ? config.orientationUrl : withSurveyTag(config.debriefUrl, waveId);
  if (!href || disabled) {
    return <p className="text-sm text-muted-foreground rounded-md bg-muted/50 px-3 py-2" role="note" data-testid={`booking-fallback-${kind}`}>
      {disabled ? "Booking is not available in the demo." : config.fallbackMessage}
    </p>;
  }
  return (
    <Button variant={variant} size={size} className={className} asChild>
      <a href={href} target="_blank" rel="noopener noreferrer" data-testid={`button-book-${kind}`}>
        <CalendarCheck className="mr-2 h-4 w-4" aria-hidden="true" />{label}
        <span className="sr-only"> (opens Calendly in a new tab)</span>
      </a>
    </Button>
  );
}
