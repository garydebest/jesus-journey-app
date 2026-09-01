import { COLLECT_CARDS } from "@/lib/dashboardContent";
import { InfoCardView } from "./InfoCardView";

export function PanelCollect() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Collect</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How to launch, promote, and monitor your survey while it's live. For the live console itself, see the{" "}
          <strong className="text-foreground">Your Surveys</strong> tab.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {COLLECT_CARDS.map((card) => (
          <InfoCardView key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}
