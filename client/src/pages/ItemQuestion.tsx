import { Button } from "@/components/ui/button";
import { QuestionShell } from "@/components/QuestionShell";
import { SCALE_LABELS } from "@shared/questions";
import { cn } from "@/lib/utils";

export function ItemQuestion({
  text,
  value,
  onChange,
  onNext,
  onBack,
  progress,
  itemNumber,
  totalItems,
}: {
  text: string;
  value?: number;
  onChange: (v: number) => void;
  onNext: () => void;
  onBack: () => void;
  progress: number;
  itemNumber: number;
  totalItems: number;
}) {
  return (
    <QuestionShell
      progress={progress}
      onBack={onBack}
      showBack
      footer={
        <Button onClick={onNext} disabled={value === undefined} data-testid="button-item-next">
          Continue
        </Button>
      }
    >
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide" data-testid="text-item-counter">
          Statement {itemNumber} of {totalItems}
        </p>
        <p className="text-xs text-muted-foreground">How often do you believe this to be true?</p>
      </div>
      <h2 className="text-lg font-semibold leading-snug" data-testid="text-item-statement">
        {text}
      </h2>
      <div className="grid gap-2">
        {SCALE_LABELS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            data-testid={`option-scale-${opt.value}`}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover-elevate",
              value === opt.value
                ? "border-primary bg-primary/10"
                : "border-border"
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                value === opt.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
              )}
            >
              {opt.value}
            </span>
            <span className="text-sm leading-snug">{opt.label}</span>
          </button>
        ))}
      </div>
    </QuestionShell>
  );
}
