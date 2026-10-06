// Approved survey ownership notice (Gary, October 6, 2026). Use this exact text.
export const SURVEY_COPYRIGHT = "© 2017–2026 Jesus Journey Group. All rights reserved.";
export const TERMS_URL = "https://jesusjourney.life/terms";

// Discreet notice with a Terms link. The link opens in a new tab so an
// in-progress survey (held only in this page's memory) is never lost.
export function SurveyCopyright({ className = "", showTerms = true }: { className?: string; showTerms?: boolean }) {
  return (
    <p className={`text-xs text-muted-foreground leading-relaxed text-center ${className}`} data-testid="text-survey-copyright">
      <span>{SURVEY_COPYRIGHT}</span>
      {showTerms && (
        <>
          {" "}
          <a
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground print:hidden whitespace-nowrap"
            data-testid="link-survey-terms"
          >
            Terms<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </>
      )}
    </p>
  );
}
