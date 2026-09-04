import { Button } from "@/components/ui/button";
import { JJLogo } from "@/lib/logo";

export function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="max-w-xl w-full text-center space-y-6">
        <div className="flex justify-center">
          <JJLogo className="h-16 w-16" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight" data-testid="text-title">
          Jesus Journey Survey
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-intro-body">
          This survey is designed to give you a picture of where you are on your spiritual journey
          as a Christian. When answering the questions, indicate how true each statement is for you
          today. Select the answer that most accurately describes your situation or beliefs.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your answers are anonymous. Takes about 10-15 minutes. At the end you'll receive a personal
          report showing your strengths and growth opportunities across 16 spiritual pathways.
        </p>
        <div className="pt-2">
          <Button size="lg" onClick={onStart} data-testid="button-start-survey">
            Begin the survey
          </Button>
        </div>
        <p className="text-xs text-muted-foreground pt-4">
          Fully anonymous &mdash; your responses are never stored. Be sure to print or save your
          report before you close this page.
        </p>
      </div>
    </div>
  );
}
