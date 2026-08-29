import { useState } from "react";
import { Intro } from "./Intro";
import { MaturityQuestion } from "./MaturityQuestion";
import { ItemQuestion } from "./ItemQuestion";
import { ChangeQuestion } from "./ChangeQuestion";
import { DemographicQuestion } from "./DemographicQuestion";
import { Report } from "./Report";
import { SURVEY_ITEMS } from "@shared/surveyItems";
import { DEMOGRAPHICS, MATURITY_OPTIONS_PRE, MATURITY_OPTIONS_POST } from "@shared/questions";
import { emptyState, TOTAL_STEPS, TOTAL_ITEM_STEPS, TOTAL_DEMO_STEPS, type SurveyState } from "@/lib/surveyState";

type Screen =
  | "intro"
  | "pre-maturity"
  | `item-${number}`
  | "post-maturity"
  | "change"
  | `demo-${number}`
  | "report";

export function SurveyFlow() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [state, setState] = useState<SurveyState>(emptyState());

  function restart() {
    setState(emptyState());
    setScreen("intro");
  }

  function progressFor(screen: Screen): number {
    if (screen === "intro") return 0;
    if (screen === "pre-maturity") return (1 / TOTAL_STEPS) * 100;
    if (screen.startsWith("item-")) {
      const idx = Number(screen.split("-")[1]);
      return ((2 + idx) / TOTAL_STEPS) * 100;
    }
    if (screen === "post-maturity") return ((2 + TOTAL_ITEM_STEPS) / TOTAL_STEPS) * 100;
    if (screen === "change") return ((3 + TOTAL_ITEM_STEPS) / TOTAL_STEPS) * 100;
    if (screen.startsWith("demo-")) {
      const idx = Number(screen.split("-")[1]);
      return ((4 + TOTAL_ITEM_STEPS + idx) / TOTAL_STEPS) * 100;
    }
    return 100;
  }

  if (screen === "intro") {
    return <Intro onStart={() => setScreen("pre-maturity")} />;
  }

  if (screen === "pre-maturity") {
    return (
      <MaturityQuestion
        title="Which of the following statements best describes where you are now in your faith journey with God?"
        options={MATURITY_OPTIONS_PRE}
        value={state.preMaturity}
        onChange={(v) => setState((s) => ({ ...s, preMaturity: v }))}
        onNext={() => setScreen("item-0")}
        progress={progressFor(screen)}
        testIdPrefix="pre-maturity"
      />
    );
  }

  if (screen.startsWith("item-")) {
    const idx = Number(screen.split("-")[1]);
    const item = SURVEY_ITEMS[idx];
    return (
      <ItemQuestion
        text={item.text}
        value={state.items[item.code]}
        onChange={(v) => setState((s) => ({ ...s, items: { ...s.items, [item.code]: v } }))}
        onNext={() => {
          if (idx + 1 < SURVEY_ITEMS.length) setScreen(`item-${idx + 1}`);
          else setScreen("post-maturity");
        }}
        onBack={() => {
          if (idx === 0) setScreen("pre-maturity");
          else setScreen(`item-${idx - 1}`);
        }}
        progress={progressFor(screen)}
        itemNumber={idx + 1}
        totalItems={SURVEY_ITEMS.length}
      />
    );
  }

  if (screen === "post-maturity") {
    return (
      <MaturityQuestion
        title="After answering the above questions, how would you now describe where you are in your faith journey toward God?"
        options={MATURITY_OPTIONS_POST}
        value={state.postMaturity}
        onChange={(v) => setState((s) => ({ ...s, postMaturity: v }))}
        onNext={() => setScreen("change")}
        onBack={() => setScreen(`item-${SURVEY_ITEMS.length - 1}`)}
        showBack
        progress={progressFor(screen)}
        testIdPrefix="post-maturity"
      />
    );
  }

  if (screen === "change") {
    return (
      <ChangeQuestion
        value={state.change}
        onChange={(v) => setState((s) => ({ ...s, change: v }))}
        onNext={() => setScreen("demo-0")}
        onBack={() => setScreen("post-maturity")}
        progress={progressFor(screen)}
      />
    );
  }

  if (screen.startsWith("demo-")) {
    const idx = Number(screen.split("-")[1]);
    const demo = DEMOGRAPHICS[idx];
    return (
      <DemographicQuestion
        demo={demo}
        value={state.demographics[demo.id]}
        onChange={(v) => setState((s) => ({ ...s, demographics: { ...s.demographics, [demo.id]: v } }))}
        onNext={() => {
          if (idx + 1 < DEMOGRAPHICS.length) setScreen(`demo-${idx + 1}`);
          else setScreen("report");
        }}
        onBack={() => {
          if (idx === 0) setScreen("change");
          else setScreen(`demo-${idx - 1}`);
        }}
        progress={progressFor(screen)}
      />
    );
  }

  return (
    <Report
      items={state.items}
      preMaturity={state.preMaturity}
      postMaturity={state.postMaturity}
      change={state.change}
      onRestart={restart}
    />
  );
}
