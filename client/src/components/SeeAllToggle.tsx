import { Button } from "@/components/ui/button";

export function SeeAllToggle({ open, onToggle, controls }: { open: boolean; onToggle: () => void; controls: string }) {
  return (
    <div className="flex justify-center print:hidden">
      <Button variant="outline" onClick={onToggle} aria-expanded={open} aria-controls={controls} data-testid="button-see-all-results">
        {open ? "Hide full results" : "See all results"}
      </Button>
    </div>
  );
}
