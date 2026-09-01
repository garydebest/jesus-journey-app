import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import type { WaveAggregateSummary } from "@shared/aggregate";

const GOAL_COLORS: Record<string, string> = {
  "Trusting Jesus": "hsl(200 45% 42%)",
  "Experiencing Jesus": "hsl(38 62% 50%)",
  "Reflecting Jesus": "hsl(265 30% 52%)",
  "Serving Jesus": "hsl(140 35% 38%)",
};

const BAND_STYLES = {
  high: { text: "Strength", bg: "hsl(150 35% 36%)" },
  medium: { text: "Developing", bg: "hsl(38 70% 45%)" },
  low: { text: "Growth opportunity", bg: "hsl(24 85% 48%)" },
} as const;

function formatKey(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
}

export function WaveReportView({ summary, churchName }: { summary: WaveAggregateSummary; churchName: string }) {
  const chartData = summary.pathwayAverages.map((p) => ({
    name: `P${p.num}`,
    fullName: p.name,
    score: p.score,
    goal: p.goal,
  }));

  return (
    <div className="space-y-6" data-testid="report-view">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold" data-testid="text-respondent-count">{summary.respondentCount}</div>
            <div className="text-xs text-muted-foreground">Respondents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">{summary.averageMaturity.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Average maturity self-rating (1–5)</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Maturity distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {summary.maturityDistribution.map((m) => (
            <div key={m.level} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-muted-foreground">{m.label}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${m.pct}%` }} />
              </div>
              <span className="w-16 text-right tabular-nums">{m.pct}%</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Goal averages</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {Object.entries(summary.goalAverages).map(([goal, score]) => (
            <div key={goal} className="flex items-center justify-between text-sm p-3 rounded-md border border-border">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: GOAL_COLORS[goal] ?? "hsl(0 0% 50%)" }} />
                {goal}
              </span>
              <span className="font-mono tabular-nums">{score.toFixed(2)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Pathway averages</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={28} />
              <Bar dataKey="score" radius={[0, 3, 3, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={GOAL_COLORS[entry.goal] ?? "hsl(0 0% 50%)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1">
            {summary.pathwayAverages.map((p) => {
              const style = BAND_STYLES[p.band];
              return (
                <div key={p.num} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">P{p.num} · {p.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono tabular-nums">{p.score.toFixed(2)}</span>
                    <Badge style={{ backgroundColor: style.bg, color: "white" }} className="border-0">{style.text}</Badge>
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Demographics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-xs">
          {Object.entries(summary.demographics).map(([key, counts]) => (
            <div key={key}>
              <div className="font-medium mb-1">{formatKey(key)}</div>
              {Object.entries(counts).length === 0 ? (
                <div className="text-muted-foreground">No data</div>
              ) : (
                Object.entries(counts).map(([label, count]) => (
                  <div key={label} className="flex justify-between text-muted-foreground">
                    <span>{label}</span>
                    <span>{count}</span>
                  </div>
                ))
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
