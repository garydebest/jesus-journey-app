import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { QuestionShell } from "@/components/QuestionShell";
import { CHANGE_OPTIONS } from "@shared/questions";

export function ChangeQuestion({
  value,
  onChange,
  onNext,
  onBack,
  progress,
}: {
  value?: number;
  onChange: (v: number) => void;
  onNext: () => void;
  onBack: () => void;
  progress: number;
}) {
  return (
    <QuestionShell
      progress={progress}
      onBack={onBack}
      showBack
      footer={
        <Button onClick={onNext} disabled={value === undefined} data-testid="button-change-next">
          Continue
        </Button>
      }
    >
      <h2 className="text-lg font-semibold leading-snug" data-testid="text-change-question">
        Compared to where you were 2 years ago, is your faith and trust in God today:
      </h2>
      <RadioGroup value={value?.toString()} onValueChange={(v) => onChange(Number(v))} className="space-y-3">
        {CHANGE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            htmlFor={`change-${opt.value}`}
            className="flex items-center gap-3 rounded-lg border border-border p-4 cursor-pointer hover-elevate"
            data-testid={`option-change-${opt.value}`}
          >
            <RadioGroupItem value={opt.value.toString()} id={`change-${opt.value}`} />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </RadioGroup>
    </QuestionShell>
  );
}
