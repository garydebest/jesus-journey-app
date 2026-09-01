import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { JJLogo } from "@/lib/logo";
import { MaturityQuestion } from "./MaturityQuestion";
import { ItemQuestion } from "./ItemQuestion";
import { ChangeQuestion } from "./ChangeQuestion";
import { DemographicQuestion } from "./DemographicQuestion";
import { SURVEY_ITEMS } from "@shared/surveyItems";
import { DEMOGRAPHICS, MATURITY_OPTIONS_PRE, MATURITY_OPTIONS_POST } from "@shared/questions";
import { emptyState, TOTAL_STEPS, TOTAL_ITEM_STEPS, type SurveyState } from "@/lib/surveyState";
import { apiRequest } from "@/lib/queryClient";

type Screen =
  | "loading"
  | "not-found"
  | "intro"
  | "pre-maturity"
  | `item-${number}`
  | "post-maturity"
  | "change"
  | `demo-${number}`
  | "comment"
  | "submitting"
  | "done";

export function JoinSurveyFlow() {
  const [, params] = useRoute("/join/:code");
  const [, setLocation] = useLocation();
  const code = params?.code ?? "";

  const [screen, setScreen] = useState<Screen>("loading");
  const [state, setState] = useState<SurveyState>(emptyState());
  const [comment, setComment] = useState("");
  const [meta, setMeta] = useState<{ waveLabel: string; churchName: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkCode() {
      try {
        const res = await apiRequest("GET", `/api/join/${encodeURIComponent(code)}`);
        const json = await res.json();
        if (!cancelled) {
          setMeta({ waveLabel: json.waveLabel, churchName: json.churchName });
          setScreen("intro");
        }
      } catch (err) {
        if (!cancelled) setScreen("not-found");
      }
    }
    if (code) checkCode();
    return () => {
      cancelled = true;
    };
  }, [code]);

  function progressFor(s: Screen): number {
    const total = TOTAL_STEPS + 1; // + comment step
    if (s === "intro" || s === "loading" || s === "not-found") return 0;
    if (s === "pre-maturity") return (1 / total) * 100;
    if (s.startsWith("item-")) {
      const idx = Number(s.split("-")[1]);
      return ((2 + idx) / total) * 100;
    }
    if (s === "post-maturity") return ((2 + TOTAL_ITEM_STEPS) / total) * 100;
    if (s === "change") return ((3 + TOTAL_ITEM_STEPS) / total) * 100;
    if (s.startsWith("demo-")) {
      const idx = Number(s.split("-")[1]);
      return ((4 + TOTAL_ITEM_STEPS + idx) / total) * 100;
    }
    if (s === "comment") return ((4 + TOTAL_ITEM_STEPS + DEMOGRAPHICS.length) / total) * 100;
    return 100;
  }

  async function handleFinalSubmit() {
    setScreen("submitting");
    setSubmitError(null);
    try {
      const items: Record<string, number> = {};
      for (const item of SURVEY_ITEMS) {
        if (typeof state.items[item.code] === "number") items[item.code] = state.items[item.code];
      }
      await apiRequest("POST", "/api/responses", {
        joinCode: code,
        items,
        journeyPre: state.preMaturity,
        journeyPost: state.postMaturity,
        spiritualChange: state.change,
        demographics: {
          gender: state.demographics.gender as string | undefined,
          age: state.demographics.age as string | undefined,
          relationship: state.demographics.relationship as string | undefined,
          attendance: state.demographics.attendance as string | undefined,
          tenure: state.demographics.tenure as string | undefined,
          smallgroup: state.demographics.smallgroup as string | undefined,
          volunteer: state.demographics.volunteer as string | undefined,
          children: state.demographics.children as string[] | undefined,
          ethnicity: state.demographics.ethnicity as string | undefined,
        },
        comment: comment || undefined,
      });
      setScreen("done");
    } catch (err: any) {
      setSubmitError("We couldn't submit your response. Please try again.");
      setScreen("comment");
    }
  }

  if (screen === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">Loading survey...</div>;
  }

  if (screen === "not-found") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="max-w-md text-center space-y-4">
          <JJLogo className="h-12 w-20 mx-auto" />
          <h1 className="text-lg font-semibold">Survey not found</h1>
          <p className="text-sm text-muted-foreground">
            We couldn't find an active survey for the code "{code}". Please double-check the code with your church, or
            it may have already closed.
          </p>
          <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-back-home">
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  if (screen === "intro") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
        <div className="max-w-xl w-full text-center space-y-6">
          <div className="flex justify-center"><JJLogo className="h-16 w-16" /></div>
          <h1 className="text-xl font-semibold tracking-tight" data-testid="text-join-title">
            {meta?.churchName} — {meta?.waveLabel}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This survey gives you and your church a picture of where your community is on its spiritual journey.
            Answer honestly — your responses are anonymous and only combined, aggregate results are ever shared with
            your church leadership.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Takes about 10-15 minutes.
          </p>
          <div className="pt-2">
            <Button size="lg" onClick={() => setScreen("pre-maturity")} data-testid="button-start-join-survey">
              Begin the survey
            </Button>
          </div>
        </div>
      </div>
    );
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
        key={item.code}
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
        key={demo.id}
        demo={demo}
        value={state.demographics[demo.id]}
        onChange={(v) => setState((s) => ({ ...s, demographics: { ...s.demographics, [demo.id]: v } }))}
        onNext={() => {
          if (idx + 1 < DEMOGRAPHICS.length) setScreen(`demo-${idx + 1}`);
          else setScreen("comment");
        }}
        onBack={() => {
          if (idx === 0) setScreen("change");
          else setScreen(`demo-${idx - 1}`);
        }}
        progress={progressFor(screen)}
        showIntroNote={idx === 0}
      />
    );
  }

  if (screen === "comment" || screen === "submitting") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
        <div className="max-w-xl w-full space-y-6">
          <h2 className="text-lg font-semibold leading-snug" data-testid="text-comment-question">
            Any comments you'd like to share with your church leadership? (optional, kept confidential)
          </h2>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Your thoughts..."
            rows={5}
            data-testid="input-comment"
          />
          {submitError && <p className="text-sm text-destructive" data-testid="text-submit-error">{submitError}</p>}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setScreen(`demo-${DEMOGRAPHICS.length - 1}`)} disabled={screen === "submitting"}>
              Back
            </Button>
            <Button onClick={handleFinalSubmit} disabled={screen === "submitting"} data-testid="button-submit-survey">
              {screen === "submitting" ? "Submitting..." : "Submit my response"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="max-w-xl w-full text-center space-y-6">
        <div className="flex justify-center"><JJLogo className="h-16 w-16" /></div>
        <h1 className="text-xl font-semibold tracking-tight" data-testid="text-thank-you">Thank you</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your response has been recorded anonymously as part of {meta?.churchName}'s {meta?.waveLabel}. Your church
          will receive a combined, aggregate report once the survey closes — individual answers are never shared.
        </p>
      </div>
    </div>
  );
}
