import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FileText } from "lucide-react";
import { useState } from "react";
import type { FullDoc as FullDocData } from "@/lib/fullDocs.generated";

// Renders one "Read the full document" expandable block, matching the
// approved mockup's full-doc pattern but using shadcn Collapsible instead of
// raw <details>/.doc-body CSS.
export function FullDoc({ doc, label = "Read the full document" }: { doc: FullDocData; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-2 text-left text-sm font-medium text-primary hover-elevate"
          data-testid={`button-fulldoc-${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {label}: {doc.title}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          className="doc-body mt-3 max-w-none rounded-md bg-muted/40 p-4 text-sm leading-relaxed [&_h4]:font-serif [&_h4]:font-semibold [&_h4]:text-base [&_h4]:mt-4 [&_h4]:mb-2 [&_h4:first-child]:mt-0 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_ol]:space-y-1 [&_li]:leading-relaxed [&_strong]:font-semibold [&_.doc-source]:mt-3 [&_.doc-source]:text-xs [&_.doc-source]:italic [&_.doc-source]:text-muted-foreground [&_.doc-logo-header]:flex [&_.doc-logo-header]:flex-col [&_.doc-logo-header]:items-center [&_.doc-logo-header]:gap-1.5 [&_.doc-logo-header]:mb-4 [&_.doc-logo-header]:pb-3 [&_.doc-logo-header]:border-b [&_.doc-logo-header]:border-border [&_.doc-logo-header_img]:w-16 [&_.doc-logo-header_img]:h-auto [&_.doc-eyebrow]:text-xs [&_.doc-eyebrow]:font-semibold [&_.doc-eyebrow]:uppercase [&_.doc-eyebrow]:tracking-wide [&_.doc-eyebrow]:text-muted-foreground [&_.doc-note]:my-2 [&_.doc-note]:px-3 [&_.doc-note]:py-2 [&_.doc-note]:bg-background [&_.doc-note]:border [&_.doc-note]:border-border [&_.doc-note]:border-l-[3px] [&_.doc-note]:border-l-primary [&_.doc-note]:rounded-md [&_.doc-note]:text-xs [&_.doc-note]:italic [&_.doc-note]:text-muted-foreground [&_.doc-note_strong]:not-italic [&_.doc-note_strong]:text-primary"
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
