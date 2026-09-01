// Jesus Journey brand mark: a folded four-panel map (teal, mint, coral, tan)
// with a location pin dropped on top, recreated to match the official logo.
export function JJLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" fill="none" className={className} aria-label="Jesus Journey logo">
      {/* Four folded map panels, left to right */}
      <path d="M2 8l13-5v29l-13 5z" fill="hsl(174 32% 42%)" />
      <path d="M15 3l13 4v29l-13-4z" fill="hsl(168 28% 78%)" />
      <path d="M28 7l13-4v29l-13 4z" fill="hsl(3 58% 58%)" />
      <path d="M41 3l13 5v29l-13-5z" fill="hsl(36 30% 78%)" />
      {/* Fold lines */}
      <path
        d="M15 3v29M28 7v29M41 3v29"
        stroke="hsl(30 15% 97%)"
        strokeWidth="0.9"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {/* Location pin dropped at the center fold */}
      <path
        d="M32 4c-4.4 0-8 3.6-8 8 0 6 8 15 8 15s8-9 8-15c0-4.4-3.6-8-8-8z"
        fill="hsl(220 15% 12%)"
      />
      <circle cx="32" cy="12" r="3.1" fill="hsl(36 30% 97%)" />
    </svg>
  );
}

// Full lockup: mark + JESUS JOURNEY wordmark, for larger/hero placements.
export function JJLogoLockup({ className = "h-14" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 84" fill="none" className={className} aria-label="Jesus Journey">
      <g transform="translate(78, 4) scale(0.9)">
        <path d="M2 8l13-5v29l-13 5z" fill="hsl(174 32% 42%)" />
        <path d="M15 3l13 4v29l-13-4z" fill="hsl(168 28% 78%)" />
        <path d="M28 7l13-4v29l-13 4z" fill="hsl(3 58% 58%)" />
        <path d="M41 3l13 5v29l-13-5z" fill="hsl(36 30% 78%)" />
        <path
          d="M15 3v29M28 7v29M41 3v29"
          stroke="hsl(30 15% 97%)"
          strokeWidth="0.9"
          strokeLinejoin="round"
          opacity="0.8"
        />
        <path
          d="M32 4c-4.4 0-8 3.6-8 8 0 6 8 15 8 15s8-9 8-15c0-4.4-3.6-8-8-8z"
          fill="hsl(220 15% 12%)"
        />
        <circle cx="32" cy="12" r="3.1" fill="hsl(36 30% 97%)" />
      </g>
      <text
        x="110"
        y="72"
        textAnchor="middle"
        fontSize="17"
        letterSpacing="4"
        fontWeight="600"
        fill="hsl(220 15% 12%)"
        fontFamily="inherit"
      >
        JESUS JOURNEY
      </text>
    </svg>
  );
}

// Text brand lockup used in the church dashboard/portal header and footer:
// mark + "my" script flourish + "Jesus Journey" wordmark + "Survey" sub-line.
// `variant="full"` (header) includes the cursive "my"; `variant="plain"`
// (footer) also includes it now, for brand consistency across header/footer.
export function JJBrandLockup({
  variant = "full",
  className = "",
  logoClassName = "h-8 w-12",
}: {
  variant?: "full" | "plain";
  className?: string;
  logoClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <JJLogo className={logoClassName} />
      <span className="inline-flex items-baseline gap-1">
        <em
          className="not-italic font-script text-muted-foreground"
          style={{ fontSize: "1.05em", transform: "rotate(-3deg)", display: "inline-block" }}
        >
          my
        </em>
        <span className="inline-flex flex-col leading-none">
          <span className={variant === "full" ? "font-sans font-bold tracking-tight text-sm" : "font-sans font-semibold text-sm"}>
            Jesus Journey
          </span>
          {variant === "full" && (
            <span className="font-sans font-medium text-[0.6rem] uppercase tracking-widest text-muted-foreground">
              Survey
            </span>
          )}
        </span>
      </span>
    </span>
  );
}
