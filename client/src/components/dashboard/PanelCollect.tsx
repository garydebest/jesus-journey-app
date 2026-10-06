import { COLLECT_CARDS } from "@/lib/dashboardContent";
import { InfoCardView } from "./InfoCardView";
import { JOURNEY_RESOURCES, CLOSING_CHECKLIST } from "@/lib/journeyResources";
import { ResourceLinks, Checklist } from "@/components/journey/ResourceLinks";

export function PanelCollect() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Collect</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How to launch, promote, and monitor your survey while it's live. For the live console itself, see the{" "}
          <strong className="text-foreground">Your Reports</strong> tab.
        </p>
      </div>
      <section className="rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-3" aria-labelledby="launch-kit-heading" data-testid="collect-launch-kit">
        <h2 id="launch-kit-heading" className="font-serif text-lg font-semibold">Launch and reminder materials</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">Sunday announcements for two weeks before, one week before and launch day; the participant invitation email; and mid-survey and final-week reminders. Use the editable version to add your church code, link and dates.</p>
        <ResourceLinks items={[JOURNEY_RESOURCES.launchKitDocx, JOURNEY_RESOURCES.launchKitPdf, JOURNEY_RESOURCES.monitoringGuide]} />
        <p className="text-xs text-muted-foreground">The promo slideshow, join-code slide and sample invitation email are in Resources.</p>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {COLLECT_CARDS.map((card) => (
          <InfoCardView key={card.title} card={card} />
        ))}
      </div>
      <section id="closing-checklist" tabIndex={-1} className="rounded-lg border p-5 space-y-3 scroll-mt-24 focus:outline-none" aria-labelledby="closing-checklist-heading" data-testid="collect-closing-checklist">
        <h2 id="closing-checklist-heading" className="font-serif text-lg font-semibold">Ready to close your survey?</h2>
        <p className="text-sm text-muted-foreground">Before closing, confirm:</p>
        <Checklist id="closing-check" items={CLOSING_CHECKLIST} label="Closing checklist" />
        <p className="text-sm rounded-md bg-muted/50 px-3 py-2">Closing your survey ends response collection and begins report generation. Close only when your leaders are ready to receive and work with the results.</p>
        <ResourceLinks items={[JOURNEY_RESOURCES.closingChecklist]} />
      </section>
    </div>
  );
}
