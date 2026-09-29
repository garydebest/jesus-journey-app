import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { QuestionShell } from "@/components/QuestionShell";
import type { Demographic } from "@shared/questions";
import { toggleExclusive } from "@shared/demographicPolicy";

export function DemographicQuestion({
  demo,
  value,
  onChange,
  onNext,
  onSkip,
  onBack,
  progress,
  showIntroNote,
}: {
  demo: Demographic;
  value?: string | string[];
  onChange: (v: string | string[]) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
  progress: number;
  showIntroNote?: boolean;
}) {
  const isAnswered = demo.type === "multi" ? Array.isArray(value) && value.length > 0 : typeof value === "string";

  function toggleMulti(option: string) {
    const current = Array.isArray(value) ? value : [];
    onChange(toggleExclusive(current, option, demo.id === "children" ? "None" : undefined));
  }

  return (
    <QuestionShell
      progress={progress}
      onBack={onBack}
      showBack
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" onClick={onSkip} data-testid="button-demo-skip">Skip this question</Button>
        <Button onClick={onNext} disabled={!isAnswered} data-testid="button-demo-next">
          Continue
        </Button>
        </div>
      }
    >
      {showIntroNote && (
        <p
          className="text-sm text-muted-foreground leading-relaxed rounded-lg bg-muted border border-border p-4"
          data-testid="text-demo-intro-note"
        >
          These questions are voluntary. You may skip any question, including ethnic or cultural
          background, without affecting your personal report. Answers are used only in aggregate
          church reporting. Categories with fewer than 10 respondents are not shown, and skipped
          answers and “Prefer not to say” are excluded from comparisons.
        </p>
      )}
      <h2 className="text-lg font-semibold leading-snug" data-testid="text-demo-question">
        {demo.question}
      </h2>
      <p className="text-sm text-muted-foreground">Optional. You can skip this question.</p>
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
