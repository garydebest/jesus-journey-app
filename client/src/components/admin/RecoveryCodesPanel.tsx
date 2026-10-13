import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Shows one-time recovery codes once, with copy and download options. */
export function RecoveryCodesPanel({ codes, onContinue, continueLabel }: { codes: string[]; onContinue: () => void; continueLabel: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Jesus Journey administrator recovery codes\nEach code works once. Keep them somewhere safe, such as a note in your password app.\n\n${codes.join("\n")}\n`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "jesus-journey-recovery-codes.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="space-y-4" data-testid="recovery-codes">
      <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm" data-testid="list-recovery-codes">
        {codes.map((c) => (
          <div key={c} className="select-all">{c}</div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        These are shown only once. Save them in your password app or print them and keep them somewhere safe. Each code works one time.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={copy} data-testid="button-copy-recovery">{copied ? "Copied" : "Copy codes"}</Button>
        <Button type="button" variant="outline" className="flex-1" onClick={download} data-testid="button-download-recovery">Download</Button>
      </div>
      <Button type="button" className="w-full" onClick={onContinue} data-testid="button-recovery-continue">{continueLabel}</Button>
    </div>
  );
}
