import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { DebriefingReportView } from "./components/DebriefingReportView";
import { DennisCorrectionsReview } from "./components/DennisCorrectionsReview";
import saved from "../../script/fixtures/saved-projection.json";
import current from "../../server/report-engine/debriefing/sample_fixture.json";
import type { DebriefingReport } from "@shared/debriefing/types";
import "./index.css";

function Review() {
  const [mode, setMode] = useState<"current" | "saved" | "corrections">("corrections");
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-muted/40">
      <div className="max-w-6xl mx-auto px-5 py-8 space-y-4">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary">Jesus Journey · Private review</p>
        <h1 className="text-xl font-semibold">Four Goals and Sixteen Pathways</h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">Survey and report corrections using synthetic data only. The existing debriefing review remains available. Nothing here changes the live site or stored reports.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sample report">
          {(["corrections", "current", "saved"] as const).map(v => <button key={v} onClick={() => setMode(v)} aria-pressed={mode === v}
            className={`rounded-md px-4 py-2 text-sm border ${mode === v ? "bg-primary text-primary-foreground" : "bg-background"}`}>
            {v === "corrections" ? "Dennis's corrections" : v === "current" ? "New debriefing report" : "Older saved report"}
          </button>)}
        </div>
        {mode !== "corrections" && <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
          <a className="underline text-primary underline-offset-4" href={`./samples/${mode}-debrief.pdf`} download>Download this debriefing PDF</a>
          <a className="underline text-primary underline-offset-4" href="./samples/saved-church.pdf" download>Download updated church PDF</a>
        </div>}
      </div>
    </header>
    <main className="max-w-6xl mx-auto px-5 py-8">
      {mode === "corrections" ? <DennisCorrectionsReview /> : <>
        <p className="mb-6 text-sm text-muted-foreground">{mode === "current" ? "New analysis: legacy metrics are no longer generated." : "Saved analysis: legacy content is omitted at display time; the archive is unchanged."}</p>
        <DebriefingReportView report={(mode === "current" ? current : saved) as unknown as DebriefingReport} />
      </>}
    </main>
  </div>;
}
createRoot(document.getElementById("root")!).render(<Review />);
