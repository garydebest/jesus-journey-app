import { PREPARE_CARDS } from "@/lib/dashboardContent";
import { InfoCardView } from "./InfoCardView";

export function PanelPrepare() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Prepare</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Getting ready for the Jesus Journey Survey — the steps that make everything after this easier.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PREPARE_CARDS.map((card) => (
          <InfoCardView key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}
