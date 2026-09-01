import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INTERPRET_CARDS, INTERPRET_CALLOUT } from "@/lib/dashboardContent";
import { InfoCardView } from "./InfoCardView";

export function PanelInterpret() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Interpret</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Understand your two reports — the Church Report's numbers, and the Comments Report's words.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {INTERPRET_CARDS.map((card) => (
          <InfoCardView key={card.title} card={card} />
        ))}
      </div>
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-serif">{INTERPRET_CALLOUT.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{INTERPRET_CALLOUT.body}</p>
        </CardContent>
      </Card>
    </div>
  );
}
