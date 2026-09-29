// Synthetic, isolated review. No connector calls or database access.
import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch, Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "./ui/tooltip";
import { WaveReportView } from "./WaveReportView";
import { FullDoc } from "./dashboard/FullDoc";
import { FULL_DOCS } from "@/lib/reportGuidance";
import { SurveyFlow } from "@/pages/SurveyFlow";
import { JoinSurveyFlow } from "@/pages/JoinSurveyFlow";
import { ItemQuestion } from "@/pages/ItemQuestion";
import { SURVEY_ITEMS } from "@shared/surveyItems";
import { computeWaveAggregate } from "@shared/aggregate";
import { makeSyntheticResponse } from "../../../script/syntheticShortForm";

const rows = Array.from({ length: 60 }, (_, i) => ({
  ...makeSyntheticResponse(false, i),
  journeyPre: 3,
  journeyPost: i < 15 ? 4 : i < 45 ? 3 : 2,
  childrenInHousehold: JSON.stringify(i < 20 ? ["None"] : i < 40
    ? ["0-2 year old(s)", "3-5 year old(s)"] : ["6-10 year old(s)", "11-18 year old(s)"]),
}));
const summary = computeWaveAggregate(rows);
const legacy = { ...summary, agreement: undefined, children: undefined, reflection: undefined };

function ScaleReview() {
  const [index, setIndex] = useState(17);
  const [value, setValue] = useState<number>();
  const item = SURVEY_ITEMS[index];
  return <><div className="px-4 pt-4 text-center text-sm text-muted-foreground">Statement 18 is a belief; continue to statement 19 to see the practice scale.</div>
    <ItemQuestion code={item.code} text={item.text} value={value} onChange={setValue}
      itemNumber={index + 1} totalItems={63} progress={(index + 1) / 63 * 100}
      onNext={() => { setIndex(Math.min(62, index + 1)); setValue(undefined); }}
      onBack={() => { setIndex(Math.max(0, index - 1)); setValue(undefined); }} /></>;
}
export function DennisCorrectionsReview() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router hook={useHashLocation}>
    <nav className="flex flex-wrap gap-x-5 gap-y-3 text-sm mb-6" aria-label="Correction examples">
      {[[ "/", "Summary"], ["/legacy", "Older summary"], ["/scale", "Answer wording"],
        ["/guidance", "Volunteer and leader guidance"], ["/survey", "Individual survey"],
        ["/join/GRACEDEMO", "Non-saving church demo"]].map(([href, label]) =>
        <Link key={href} href={href} className="underline underline-offset-4">{label}</Link>)}
      <a className="underline underline-offset-4" href="./samples/dennis-church.pdf" target="_blank" rel="noreferrer">Corrected church PDF</a>
      <a className="underline underline-offset-4" href="./samples/paper-survey.pdf" target="_blank" rel="noreferrer">Corrected paper survey</a>
    </nav>
    <p className="mb-6 text-sm text-muted-foreground">Synthetic examples only. The short-form report layout and pending privacy-threshold decisions have not been changed.</p>
    <Switch>
      <Route path="/scale" component={ScaleReview} />
      <Route path="/guidance">{() => <><FullDoc doc={FULL_DOCS[6]} /><FullDoc doc={FULL_DOCS[7]} /></>}</Route>
      <Route path="/survey" component={SurveyFlow} />
      <Route path="/join/:code" component={JoinSurveyFlow} />
      <Route path="/legacy">{() => <WaveReportView summary={legacy} churchName="Synthetic review church" />}</Route>
      <Route>{() => <WaveReportView summary={summary} churchName="Synthetic review church" />}</Route>
    </Switch>
  </Router></TooltipProvider></QueryClientProvider>;
}
