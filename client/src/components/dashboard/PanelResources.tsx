import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RESOURCE_CARDS } from "@/lib/dashboardContent";
import { ResourceCardIcon } from "./icons";
import { FullDoc } from "./FullDoc";
import { FULL_DOCS } from "@/lib/reportGuidance";
import { JOURNEY_RESOURCES as R } from "@/lib/journeyResources";
import { ResourceLinks } from "@/components/journey/ResourceLinks";

const JOURNEY_GROUPS = [
  { title: "Prepare", items: [R.coordinatorGuide, R.orientationWorksheet, R.leadershipBriefing, R.readinessChecklist] },
  { title: "Launch", items: [R.launchKitDocx, R.launchKitPdf] },
  { title: "Collect and close", items: [R.monitoringGuide, R.closingChecklist] },
  { title: "Interpret", items: [R.debriefPrep] },
];

export function PanelResources() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Resources</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Templates, guides, and support materials to use throughout every stage above.
        </p>
      </div>
      <section className="rounded-lg border p-5 space-y-4" aria-labelledby="journey-guides-heading" data-testid="resources-journey-guides">
        <h2 id="journey-guides-heading" className="font-serif text-lg font-semibold">Survey journey guides</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {JOURNEY_GROUPS.map((g) => (
            <div key={g.title} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h3>
              <ResourceLinks items={g.items} />
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-resource-nutshell-video">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-serif">Jesus Journey in a Nutshell</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">A short film that introduces the four Goals of the Jesus Journey, for leaders and congregations before launch.</p>
            <Button variant="outline" size="sm" disabled>Video resource coming soon</Button>
          </CardContent>
        </Card>
        {RESOURCE_CARDS.map((card) => (
          <Card key={card.title} data-testid={`card-resource-${card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
            <CardHeader className="pb-2">
              <span className="text-primary"><ResourceCardIcon icon={card.icon} /></span>
              <CardTitle className="text-base font-serif mt-2">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{card.body}</p>
              {card.downloads ? (
                <div className="flex flex-col items-start gap-2">
                  {card.downloads.map((download, index) => (
                    <Button key={download.href} variant={index === 0 ? "default" : "outline"} size="sm" className="h-auto min-h-9 w-full whitespace-normal py-2 text-center" asChild>
                      <a href={download.href} download>
                        {download.label}
                      </a>
                    </Button>
                  ))}
                </div>
              ) : card.ctaHref ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={card.ctaHref} download target="_blank" rel="noopener noreferrer">
                    {card.ctaLabel}
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled title="Resource download coming soon">
                  {card.ctaLabel}
                </Button>
              )}
              {card.downloadNote && <p className="text-xs text-muted-foreground leading-relaxed">{card.downloadNote}</p>}
              {card.fullDocIndex !== undefined && <FullDoc doc={FULL_DOCS[card.fullDocIndex]} label="Read the full message" />}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
