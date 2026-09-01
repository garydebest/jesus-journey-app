import { ACT_STEPS } from "@/lib/dashboardContent";
import { FullDoc } from "./FullDoc";
import { FULL_DOCS } from "@/lib/fullDocs.generated";

export function PanelAct() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Act</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fostering positive change after the survey — from a first read of the report to a strategic plan.
        </p>
      </div>
      <ol className="space-y-6">
        {ACT_STEPS.map((step) => (
          <li key={step.number} className="flex gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-base font-semibold text-primary-foreground">
              {step.number}
            </div>
            <div className="flex-1 space-y-2 border-b pb-6 last:border-b-0 last:pb-0">
              <h2 className="font-serif text-lg font-semibold">{step.title}</h2>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{step.meta}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              <FullDoc doc={FULL_DOCS[step.fullDocIndex]} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
