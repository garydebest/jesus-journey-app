import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { QuestionShell } from "@/components/QuestionShell";
import type { Demographic } from "@shared/questions";

export function DemographicQuestion({
  demo,
  value,
  onChange,
  onNext,
  onBack,
  progress,
}: {
  demo: Demographic;
  value?: string | string[];
  onChange: (v: string | string[]) => void;
  onNext: () => void;
  onBack: () => void;
  progress: number;
}) {
  const isAnswered = demo.type === "multi" ? Array.isArray(value) && value.length > 0 : typeof value === "string";

  function toggleMulti(option: string) {
    const current = Array.isArray(value) ? value : [];
    if (current.includes(option)) {
      onChange(current.filter((v) => v !== option));
    } else {
      onChange([...current, option]);
    }
  }

  return (
    <QuestionShell
      progress={progress}
      onBack={onBack}
      showBack
      footer={
        <Button onClick={onNext} disabled={!isAnswered} data-testid="button-demo-next">
          Continue
        </Button>
      }
    >
      <h2 className="text-lg font-semibold leading-snug" data-testid="text-demo-question">
        {demo.question}
      </h2>
      {demo.type === "single" ? (
        <RadioGroup
          value={typeof value === "string" ? value : undefined}
          onValueChange={(v) => onChange(v)}
          className="space-y-3"
        >
          {demo.options.map((opt) => (
            <label
              key={opt}
              htmlFor={`demo-${demo.id}-${opt}`}
              className="flex items-center gap-3 rounded-lg border border-border p-4 cursor-pointer hover-elevate"
              data-testid={`option-demo-${demo.id}-${opt}`}
            >
              <RadioGroupItem value={opt} id={`demo-${demo.id}-${opt}`} />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </RadioGroup>
      ) : (
        <div className="space-y-3">
          {demo.options.map((opt) => {
            const checked = Array.isArray(value) && value.includes(opt);
            return (
              <label
                key={opt}
                htmlFor={`demo-${demo.id}-${opt}`}
                className="flex items-center gap-3 rounded-lg border border-border p-4 cursor-pointer hover-elevate"
                data-testid={`option-demo-${demo.id}-${opt}`}
              >
                <Checkbox
                  id={`demo-${demo.id}-${opt}`}
                  checked={checked}
                  onCheckedChange={() => toggleMulti(opt)}
                />
                <span className="text-sm">{opt}</span>
              </label>
            );
          })}
        </div>
      )}
    </QuestionShell>
  );
}
