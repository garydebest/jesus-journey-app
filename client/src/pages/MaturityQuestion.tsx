import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { QuestionShell } from "@/components/QuestionShell";

interface Option {
  value: number;
  label: string;
}

export function MaturityQuestion({
  title,
  options,
  value,
  onChange,
  onNext,
  onBack,
  showBack,
  progress,
  testIdPrefix,
}: {
  title: string;
  options: Option[];
  value?: number;
  onChange: (v: number) => void;
  onNext: () => void;
  onBack?: () => void;
  showBack?: boolean;
  progress: number;
  testIdPrefix: string;
}) {
  return (
    <QuestionShell
      progress={progress}
      onBack={onBack}
      showBack={showBack}
      footer={
        <Button onClick={onNext} disabled={value === undefined} data-testid={`button-${testIdPrefix}-next`}>
          Continue
        </Button>
      }
    >
      <h2 className="text-lg font-semibold leading-snug" data-testid={`text-${testIdPrefix}-question`}>
        {title}
      </h2>
      <RadioGroup
        value={value?.toString()}
        onValueChange={(v) => onChange(Number(v))}
        className="space-y-3"
      >
        {options.map((opt) => (
          <label
            key={opt.value}
            htmlFor={`${testIdPrefix}-${opt.value}`}
            className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover-elevate"
            data-testid={`option-${testIdPrefix}-${opt.value}`}
          >
            <RadioGroupItem value={opt.value.toString()} id={`${testIdPrefix}-${opt.value}`} className="mt-0.5" />
            <span className="text-sm leading-relaxed">{opt.label}</span>
          </label>
        ))}
      </RadioGroup>
    </QuestionShell>
  );
}
