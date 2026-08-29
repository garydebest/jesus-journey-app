export function JJLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-label="Jesus Journey logo">
      {/* Folded map, three panels */}
      <path
        d="M6 11l11-4 14 4 11-4v29l-11 4-14-4-11 4z"
        fill="hsl(41 28% 92%)"
        stroke="hsl(174 30% 30%)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M17 7v29M31 11v29" stroke="hsl(174 30% 30%)" strokeWidth="1.4" />
      {/* Dashed route */}
      <path
        d="M11 30c3-4 6-2 8-6s2-8 6-10"
        stroke="hsl(174 30% 38%)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="1 4"
        fill="none"
      />
      {/* Location pin dropped on the map */}
      <path
        d="M33 16c-3.3 0-6 2.7-6 6 0 4.5 6 11 6 11s6-6.5 6-11c0-3.3-2.7-6-6-6z"
        fill="hsl(1 68% 61%)"
      />
      <circle cx="33" cy="22" r="2.2" fill="hsl(41 28% 96%)" />
    </svg>
  );
}
