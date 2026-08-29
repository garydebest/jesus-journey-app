import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JJLogo } from "@/lib/logo";
import { PATHWAYS, ITEM_BULLETS, GOALS } from "@shared/pathways";
import { computePathwayScores, computeGoalScores, itemIsStrength, type ItemResponses } from "@shared/scoring";
import { MATURITY_LABELS } from "@shared/questions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

const GOAL_COLORS: Record<string, string> = {
  "Trusting Jesus": "hsl(174 30% 38%)",
  "Experiencing Jesus": "hsl(1 68% 61%)",
  "Expressing Jesus": "hsl(41 40% 45%)",
  "Serving Jesus": "hsl(159 31% 45%)",
};

function bandLabel(band: "high" | "medium" | "low") {
  if (band === "high") return { text: "Strength", cls: "bg-primary text-primary-foreground" };
  if (band === "low") return { text: "Growth opportunity", cls: "bg-accent text-accent-foreground" };
  return { text: "Developing", cls: "bg-secondary text-secondary-foreground" };
}

export function Report({
  items,
  preMaturity,
  postMaturity,
  change,
  onRestart,
}: {
  items: ItemResponses;
  preMaturity?: number;
  postMaturity?: number;
  change?: number;
  onRestart: () => void;
}) {
  const pathwayScores = computePathwayScores(items);
  const goalScores = computeGoalScores(pathwayScores);

  const chartData = pathwayScores.map((p) => ({
    name: `P${p.num}`,
    fullName: p.name,
    score: p.score,
    goal: p.goal,
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center gap-3">
          <JJLogo className="h-8 w-8" />
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-report-title">
              My Faith Journey — Individual Report
            </h1>
            <p className="text-xs text-muted-foreground">Prototype preview — sample data only</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {/* Maturity summary */}
        {(preMaturity || postMaturity || change) && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="section-maturity-summary">
            {preMaturity && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Before the survey</p>
                <p className="text-sm font-semibold mt-1" data-testid="text-pre-maturity">
                  {MATURITY_LABELS[preMaturity]}
                </p>
              </div>
            )}
            {postMaturity && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">After reflection</p>
                <p className="text-sm font-semibold mt-1" data-testid="text-post-maturity">
                  {MATURITY_LABELS[postMaturity]}
                </p>
              </div>
            )}
            {change && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Compared to 2 years ago
                </p>
                <p className="text-sm font-semibold mt-1" data-testid="text-change-summary">
                  {["", "Growing significantly", "Growing a little", "About the same", "Fading somewhat", "Fading a lot"][change]}
                </p>
              </div>
            )}
          </section>
        )}

        {/* Intro copy */}
        <section className="space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-report-intro">
            For each Goal, we measure progress along four Pathways. Pathways are means through which
            your Journey of Faith can be helped to move forward. Below you'll see a chart with your
            average score for each Pathway. Scores in green are considered your strengths. Scores in
            orange are areas where you have an opportunity to grow.
          </p>
        </section>

        {/* Chart */}
        <section data-testid="section-pathway-chart">
          <h2 className="text-base font-semibold mb-4">Your 16 Pathways</h2>
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={36}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <ReferenceLine x={3.5} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={16}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={GOAL_COLORS[d.goal]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {GOALS.map((g) => (
              <div key={g} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: GOAL_COLORS[g] }} />
                {g}
              </div>
            ))}
          </div>
        </section>

        {/* Goal summary */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="section-goal-summary">
          {GOALS.map((g) => (
            <div key={g} className="rounded-lg border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground leading-tight">{g}</p>
              <p className="text-lg font-semibold tabular-nums mt-1" data-testid={`text-goal-score-${g.split(" ")[0].toLowerCase()}`}>
                {goalScores[g]?.toFixed(2)}
              </p>
            </div>
          ))}
        </section>

        {/* Pathway detail cards, grouped by goal */}
        {GOALS.map((goal) => (
          <section key={goal} className="space-y-4" data-testid={`section-goal-${goal.split(" ")[0].toLowerCase()}`}>
            <h2 className="text-base font-semibold pt-2 border-t border-border">
              {goal.toUpperCase()}
            </h2>
            {PATHWAYS.filter((p) => p.goal === goal).map((p) => {
              const scoreEntry = pathwayScores.find((s) => s.num === p.num)!;
              const band = bandLabel(scoreEntry.band);
              const narrative = p.narrative[scoreEntry.band];
              return (
                <article
                  key={p.num}
                  className="rounded-lg border border-border p-5 space-y-3"
                  data-testid={`card-pathway-${p.num}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Pathway {p.num}</p>
                      <h3 className="text-sm font-semibold" data-testid={`text-pathway-name-${p.num}`}>
                        {p.name}
                      </h3>
                      <p className="text-xs text-muted-foreground italic mt-0.5">{p.tagline}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-semibold tabular-nums" data-testid={`text-pathway-score-${p.num}`}>
                        {scoreEntry.score.toFixed(2)}
                      </p>
                      <Badge className={band.cls} data-testid={`badge-pathway-band-${p.num}`}>
                        {band.text}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed" data-testid={`text-pathway-narrative-${p.num}`}>
                    {narrative}:
                  </p>
                  <ul className="space-y-1.5">
                    {p.items.map((code) => {
                      const val = items[code];
                      const strong = typeof val === "number" && itemIsStrength(val);
                      return (
                        <li
                          key={code}
                          className={`text-sm pl-3 border-l-2 ${strong ? "border-primary text-foreground" : "border-accent text-foreground"}`}
                          data-testid={`text-item-bullet-${code}`}
                        >
                          {ITEM_BULLETS[code]}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-xs text-muted-foreground">{p.scripture}</p>
                </article>
              );
            })}
          </section>
        ))}

        <div className="flex justify-center pt-6">
          <Button variant="outline" onClick={onRestart} data-testid="button-restart">
            Start a new sample survey
          </Button>
        </div>
      </main>
    </div>
  );
}
