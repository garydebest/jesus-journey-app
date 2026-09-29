import { PATHWAYS } from "@shared/pathways";
import { SURVEY_ITEMS } from "@shared/surveyItems";
import { SHORT_PATHWAY_ITEMS, selectShortPathways } from "@shared/shortForm";
import narratives from "@shared/shortFormNarratives.json";
import type { ItemResponses } from "@shared/scoring";

export function ShortReportSections({ items }: { items: ItemResponses }) {
  const { strengths, opportunities } = selectShortPathways(items);
  const copy = narratives as Record<string, { strength: string; opportunity: string }>;
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
  </>;
}
