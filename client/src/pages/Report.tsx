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

// Four-goal palette — deliberately avoids red. Each hue carries a light
// association with its Goal: Trusting = steady teal, Experiencing = warm
// gold (presence/light), Reflecting = dusty sky blue (mirroring outward),
// Serving = green (growth/action).
const GOAL_COLORS: Record<string, string> = {
  "Trusting Jesus": "hsl(174 30% 38%)",
  "Experiencing Jesus": "hsl(38 62% 50%)",
  "Reflecting Jesus": "hsl(205 40% 48%)",
  "Serving Jesus": "hsl(150 30% 40%)",
};

// Band colors: Strength = green, Developing = amber, Growth opportunity =
// orange (never red). Used as solid badge fills so they stay clearly visible.
const BAND_STYLES = {
  high: { text: "Strength", bg: "hsl(150 35% 36%)", fg: "hsl(0 0% 100%)" },
  medium: { text: "Developing", bg: "hsl(38 70% 45%)", fg: "hsl(0 0% 100%)" },
  low: { text: "Growth opportunity", bg: "hsl(24 85% 48%)", fg: "hsl(0 0% 100%)" },
} as const;

function bandLabel(band: "high" | "medium" | "low") {
  return BAND_STYLES[band];
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

        {/* Opening welcome copy */}
        <section className="space-y-4" data-testid="section-report-welcome">
          <p className="text-sm font-semibold text-foreground" data-testid="text-report-thanks">
            Thanks for sharing with us your journey with Jesus!
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-report-privacy">
            Be assured that the information you submitted is collected and held anonymously — your
            identity is never recorded or shared. This report exists in your possession alone. If
            you took the survey as part of a group, nothing here will ever identify you within that
            group's results.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-report-invitation">
            Remember that our adventure of following Jesus is always an invitation! God's Spirit
            first affirms the strengths in our journey so far — those parts of us where our trust
            and character are well established. God then uses those to encourage and invite us
            forward into deeper levels of confidence and trust in other areas of our lives. In this
            way, growing in Jesus is a journey from strength to opportunity.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-report-context">
            As you read the following summary of your responses in the survey, keep in mind that it
            reflects where you are right now, within the unique circumstances that impact you at the
            present time. And it is where you are right now that the invitation of Jesus is
            powerfully present. Please also remember that the purpose of this process is not in any
            way to compare you with others or to "grade" you against a fixed standard. Our hope is
            simply to serve and encourage you toward Jesus' never ending invitation to live your life
            really and fully!
          </p>
        </section>

        {/* Chart intro copy */}
        <section className="space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-report-intro">
            For each Goal, we measure progress along four Pathways. Pathways are means through which
            your Journey of Faith can be helped to move forward. Below you'll see a chart with your
            average score for each Pathway, colored by Goal. Further down, each Pathway is broken
            into individual statements — a green square marks a statement that's a current strength,
            and an orange square marks one that's an opportunity to grow.
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
                      <Badge
                        className="border-0"
                        style={{ background: band.bg, color: band.fg }}
                        data-testid={`badge-pathway-band-${p.num}`}
                      >
                        {band.text}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed" data-testid={`text-pathway-narrative-${p.num}`}>
                    {narrative}:
                  </p>
                  <ul className="space-y-2">
                    {p.items.map((code) => {
                      const val = items[code];
                      const strong = typeof val === "number" && itemIsStrength(val);
                      const swatch = strong ? BAND_STYLES.high.bg : BAND_STYLES.low.bg;
                      return (
                        <li
                          key={code}
                          className="flex items-start gap-2.5 text-sm text-foreground"
                          data-testid={`text-item-bullet-${code}`}
                        >
                          <span
                            className="mt-1 h-2.5 w-2.5 rounded-sm shrink-0"
                            style={{ background: swatch }}
                            aria-hidden="true"
                          />
                          <span>{ITEM_BULLETS[code]}</span>
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

        {/* Where Do I Go From Here */}
        <section
          className="space-y-4 pt-6 border-t border-border"
          data-testid="section-where-from-here"
        >
          <h2 className="text-lg font-semibold" data-testid="text-where-from-here-title">
            Where Do I Go From Here?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Growing and becoming like Jesus is a partnership; we can actively work toward it because
            we are confident that God is working within us as well (Philippians 2:12-13). The Bible
            speaks about the strength and resilience of a three stranded cord (Ecclesiastes 4:12) —
            let's look at how this concept is central to a healthy process of growth.
          </p>

          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold">Strand 1: Journey with God</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Reflect on your opportunity areas and take time to talk with Jesus about where you are
              right now. Ask him about his heart and plans for you and what you can do to respond to
              him. Consider being more intentional about reading Scripture, immersing yourself more
              deeply in the Story of God. Investigate what Christians through the centuries have
              discovered about spiritual formation and how we can cooperate more fully with God.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold">Strand 2: Journey with others</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Be intentional about regularly joining with other followers of Jesus to worship, pray
              and learn together. Consider choosing a spiritual director or counsellor who could help
              you find ways of moving forward in your relationship with Jesus. Cultivate circles of
              spiritual friendship where you can share your strengths and opportunities and within
              which you can be encouraged to grow as you serve and encourage others.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold">Strand 3: Journey with the wider community of faith</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              God can give you wisdom through his followers from other times and places. Look for
              books and other resources that can encourage and direct you. Take advantage of classes,
              retreats and other intensives where you can be helped by others who have faced the same
              kinds of challenges that you do.
            </p>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Of course, these suggestions are not a formula guaranteeing spiritual advancement. They
            are more like key elements in soil — when they are all present and working together they
            create a rich medium that promotes healthy growth.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            In the weeks to come, if you have taken this survey as part of a larger group, you can
            expect that your community will be talking about connecting the communal strengths of
            your group with shared opportunities for growth. We would encourage you to engage
            actively in those conversations and in developing healthy strategies to help you all grow
            further together in your journey with Jesus.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By God's grace, as we journey together with others, our joint efforts will result in
            lives that are marked by increasing authenticity and freedom. Together, may we discover
            who God has made us to be and trust in his good plans for us!
          </p>
        </section>

        <div className="flex justify-center pt-6">
          <Button variant="outline" onClick={onRestart} data-testid="button-restart">
            Start a new sample survey
          </Button>
        </div>
      </main>
    </div>
  );
}
