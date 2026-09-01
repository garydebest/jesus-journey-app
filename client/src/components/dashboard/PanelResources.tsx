import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RESOURCE_CARDS } from "@/lib/dashboardContent";
import { ResourceCardIcon } from "./icons";
import { FullDoc } from "./FullDoc";
import { FULL_DOCS } from "@/lib/fullDocs.generated";

export function PanelResources() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Resources</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Templates, guides, and support materials to use throughout every stage above.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {RESOURCE_CARDS.map((card) => (
          <Card key={card.title} data-testid={`card-resource-${card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
            <CardHeader className="pb-2">
              <span className="text-primary"><ResourceCardIcon icon={card.icon} /></span>
              <CardTitle className="text-base font-serif mt-2">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{card.body}</p>
              <Button variant="outline" size="sm" disabled title="Resource download coming soon">
                {card.ctaLabel}
              </Button>
              {card.fullDocIndex !== undefined && <FullDoc doc={FULL_DOCS[card.fullDocIndex]} label="Read the full outline" />}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
