import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JourneyResource } from "@/lib/journeyResources";

export function ResourceLinks({ items }: { items: JourneyResource[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((r) => (
        <Button key={r.href} variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal py-2 text-left" asChild>
          <a href={r.href} download data-testid={`download-${r.href.split("/").pop()}`}>
            <Download className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />{r.label} ({r.format})
          </a>
        </Button>
      ))}
    </div>
  );
}

export function Checklist({ id, items, label }: { id: string; items: string[]; label: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{label}</legend>
      {items.map((item, i) => (
        <label key={i} htmlFor={`${id}-${i}`} className="flex items-start gap-3 text-sm leading-relaxed cursor-pointer">
          <input id={`${id}-${i}`} type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
          <span>{item}</span>
        </label>
      ))}
      <p className="text-xs text-muted-foreground pt-1">This checklist is for your team’s planning and is not saved.</p>
    </fieldset>
  );
}
