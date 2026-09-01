import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoCardIcon } from "./icons";
import { FullDoc } from "./FullDoc";
import { FULL_DOCS } from "@/lib/fullDocs.generated";
import type { InfoCard } from "@/lib/dashboardContent";

export function InfoCardView({ card }: { card: InfoCard }) {
  return (
    <Card className={card.highlight ? "border-primary/40 bg-primary/5" : ""} data-testid={`card-info-${card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-primary"><InfoCardIcon icon={card.icon} /></span>
          <CardTitle className="text-base font-serif">{card.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {card.statCallout && (
          <p className="rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary">{card.statCallout}</p>
        )}
        {card.body && <p className="text-sm text-muted-foreground leading-relaxed">{card.body}</p>}
        {card.bullets && (
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground leading-relaxed">
            {card.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
        {card.steps && (
          <ol className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            {card.steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 shrink-0 font-semibold text-foreground">{i + 1}.</span>
                <span>
                  <strong className="text-foreground">{s.label}</strong> — {s.text}
                </span>
              </li>
            ))}
          </ol>
        )}
        {card.note && <p className="text-xs italic text-muted-foreground">{card.note}</p>}
        {card.ctaLabel && (
          <Button variant="outline" size="sm" disabled title="Resource download coming soon">
            {card.ctaLabel}
          </Button>
        )}
        {card.fullDocIndexes?.map((idx) => (
          <FullDoc key={idx} doc={FULL_DOCS[idx]} />
        ))}
      </CardContent>
    </Card>
  );
}
