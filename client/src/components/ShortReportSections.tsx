import { PATHWAYS, GOALS } from "@shared/pathways";
import { SURVEY_ITEMS } from "@shared/surveyItems";
import { SHORT_PATHWAY_ITEMS, selectShortPathways, shortPathwayScores } from "@shared/shortForm";
import narratives from "@shared/shortFormNarratives.json";
import { bandFor, itemIsStrength, type ItemResponses } from "@shared/scoring";
import { Badge } from "@/components/ui/badge";
import { SeeAllToggle } from "@/components/SeeAllToggle";

const BAND_STYLES = {
  high: { text: "Strength", bg: "hsl(150 35% 36%)" },
  medium: { text: "Developing", bg: "hsl(38 70% 45%)" },
  low: { text: "Growth opportunity", bg: "hsl(24 85% 48%)" },
} as const;

export function ShortReportSections({ items, showAll = false, onToggle }: {
  items: ItemResponses;
  showAll?: boolean;
  onToggle?: () => void;
}) {
  const { strengths, opportunities } = selectShortPathways(items);
  const copy = narratives as Record<string, { strength: string; opportunity: string }>;
  const scores = shortPathwayScores(items);
  return <>
    {([
      ["strength", "Strengths to Celebrate", strengths],
      ["opportunity", "Opportunities to Explore", opportunities],
    ] as const).map(([kind, heading, selected]) => (
      <section key={kind} className="space-y-4" data-testid={`section-short-${kind}`}>
        <h2 className="text-lg font-semibold">{heading}</h2>
        {selected.map(score => {
          const pathway = PATHWAYS.find(p => p.num === score.num)!;
          return <article key={pathway.num} className="rounded-lg border border-border p-5 space-y-3 break-inside-avoid"
            data-testid={`card-pathway-${pathway.num}`}>
            <p className="text-xs text-muted-foreground">Pathway {pathway.num}</p>
            <h3 className="text-sm font-semibold">{pathway.name}</h3>
            <p className="text-xs text-muted-foreground">{pathway.tagline}</p>
            <p className="text-sm leading-relaxed" data-testid={`text-pathway-narrative-${pathway.num}`}>{copy[pathway.num][kind]}</p>
            <ul className="space-y-2 list-disc pl-5">
              {SHORT_PATHWAY_ITEMS[pathway.num].map(code => (
                <li key={code} className="text-sm" data-testid={`text-item-bullet-${code}`}>
                  {SURVEY_ITEMS.find(item => item.code === code)!.text}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{pathway.scripture}</p>
          </article>;
        })}
      </section>
    ))}

    {onToggle && <SeeAllToggle open={showAll} onToggle={onToggle} controls="section-all-results" />}

    <div id="section-all-results" className={showAll ? "space-y-6" : "hidden print:block space-y-6"} data-testid="section-all-results">
      <h2 className="text-lg font-semibold pt-2 border-t border-border">All your results</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Your average score for each Pathway measured in this shorter survey. A green dot marks a Strength to
        Celebrate, and an orange dot marks an Opportunity to Explore.
      </p>
      {GOALS.map(goal => (
        <section key={goal} className="space-y-3" data-testid={`section-short-all-${goal.split(" ")[0].toLowerCase()}`}>
          <h3 className="text-sm font-semibold">{goal.toUpperCase()}</h3>
          {PATHWAYS.filter(p => p.goal === goal).map(pathway => {
            const s = scores.find(x => x.num === pathway.num)!;
            const band = s.score === null ? null : BAND_STYLES[bandFor(s.score)];
            return <article key={pathway.num} className="rounded-lg border border-border p-4 space-y-2 break-inside-avoid"
              data-testid={`card-pathway-all-${pathway.num}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Pathway {pathway.num}</p>
                  <p className="text-sm font-semibold">{pathway.name}</p>
                </div>
                {s.score === null
                  ? <p className="text-xs text-muted-foreground text-right">Not measured in this shorter survey</p>
                  : <div className="text-right shrink-0">
                      <p className="text-base font-semibold tabular-nums">{s.score.toFixed(2)}</p>
                      <Badge className="border-0 text-white" style={{ background: band!.bg }}>{band!.text}</Badge>
                    </div>}
              </div>
              {SHORT_PATHWAY_ITEMS[pathway.num].length > 0 && <ul className="space-y-1.5">
                {SHORT_PATHWAY_ITEMS[pathway.num].map(code => {
                  const val = items[code];
                  const strong = typeof val === "number" && itemIsStrength(val);
                  return <li key={code} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" aria-hidden="true"
                      style={{ background: strong ? BAND_STYLES.high.bg : BAND_STYLES.low.bg, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }} />
                    <span><span className="sr-only">{strong ? "Strength to Celebrate: " : "Opportunity to Explore: "}</span>
                      {SURVEY_ITEMS.find(item => item.code === code)!.text}</span>
                  </li>;
                })}
              </ul>}
            </article>;
          })}
        </section>
      ))}
      {onToggle && showAll && <SeeAllToggle open={showAll} onToggle={onToggle} controls="section-all-results" />}
    </div>
  </>;
}
