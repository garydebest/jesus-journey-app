// Private side-by-side review of the two individual-report layouts. Sample answers only; nothing is submitted or saved.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Report } from "./pages/Report";
import { SURVEY_ITEMS } from "@shared/surveyItems";
import "./index.css";

// A varied sample person: a few clear strengths, a few clear growth areas, the rest in between.
const answers = Object.fromEntries(SURVEY_ITEMS.map((item, i) => [item.code, [4, 5, 3, 4, 2, 3, 5, 4, 3, 2, 4, 3][i % 12]]));

function ReviewPage() {
  const [view, setView] = useState<"current" | "new">("new");
  const tab = (key: "current" | "new", label: string) => (
    <button onClick={() => { setView(key); window.scrollTo(0, 0); }} aria-pressed={view === key}
      className={`rounded-md px-3 py-1.5 text-sm font-medium border ${view === key ? "bg-[#356a65] text-white border-[#356a65]" : "bg-white text-[#28403d] border-[#c9d6d4]"}`}>
      {label}
    </button>
  );
  return <>
    <div className="sticky top-0 z-50 border-b border-[#c9d6d4] bg-[#eef3f2] px-4 py-3 print:hidden">
      <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-3">
        <p className="text-sm text-[#28403d] flex-1 min-w-[240px]"><strong>Private review.</strong> Sample answers for one full-survey participant. Not the live survey.</p>
        {tab("current", "Current report (live)")}
        {tab("new", "New option: top three first")}
      </div>
    </div>
    <Report key={view} items={answers} preMaturity={4} postMaturity={4} change={2} summaryFirst={view === "new"} onRestart={() => window.scrollTo(0, 0)} />
  </>;
}
createRoot(document.getElementById("root")!).render(<ReviewPage />);
