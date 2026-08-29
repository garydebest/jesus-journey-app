import { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { JJLogo } from "@/lib/logo";

export function QuestionShell({
  progress,
  onBack,
  showBack,
  children,
  footer,
}: {
  progress: number; // 0-100
  onBack?: () => void;
  showBack?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto w-full px-4 py-3 flex items-center gap-3">
          <JJLogo className="h-6 w-6 shrink-0" />
          <Progress value={progress} className="h-2 flex-1" data-testid="progress-survey" />
          <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>
      </header>
      <main className="flex-1 px-4 py-10">
        <div className="max-w-2xl mx-auto w-full space-y-6">
          {showBack && onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-back"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          )}
          {children}
        </div>
      </main>
      {footer && (
        <footer className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border">
          <div className="max-w-2xl mx-auto w-full px-4 py-4 flex justify-end gap-3">{footer}</div>
        </footer>
      )}
    </div>
  );
}
