export function JJLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-label="Jesus Journey logo">
      <path
        d="M24 4C14.06 4 6 12.06 6 22c0 13.5 15.5 20.6 17.1 21.3.57.25 1.23.25 1.8 0C26.5 42.6 42 35.5 42 22 42 12.06 33.94 4 24 4z"
        fill="hsl(174 30% 38%)"
      />
      <circle cx="24" cy="21" r="8" fill="hsl(41 28% 92%)" />
      <path
        d="M24 15v12M19 21h10"
        stroke="hsl(1 68% 61%)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
