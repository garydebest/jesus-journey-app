import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PlusSquare, Clock, Send, FileStack, CheckCircle2, CreditCard } from "lucide-react";

export interface WaveWithMeta {
  id: string;
  label: string;
  joinCode: string;
  status: string;
  paymentStatus?: string;
  minSampleSize: number;
  opensAt: string | null;
  closesAt: string | null;
  closedAt?: string | null;
  responseCount?: number;
  snapshot?: { respondentCount: number; summaryJson: string; reportPdfPath?: string | null } | null;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return null;
  }
}

interface Props {
  waves: WaveWithMeta[];
  loading: boolean;
  error: string | null;
  closeError: string | null;
  downloadError: string | null;
  closingId: string | null;
  downloadingId: string | null;
  onStartNew: () => void;
  onGoToPrepare: () => void;
  onClose: (waveId: string) => void;
  onDownloadReport: (wave: WaveWithMeta) => void;
  onViewReport: (wave: WaveWithMeta) => void;
  onAbandonPending?: (waveId: string) => void;
}

export function PanelYourSurveys({
  waves, loading, error, closeError, downloadError, closingId, downloadingId,
  onStartNew, onGoToPrepare, onClose, onDownloadReport, onViewReport, onAbandonPending,
}: Props) {
  const current = waves[0] ?? null;
  const state: "none" | "pending_payment" | "live" | "closed" = !current
    ? "none"
    : current.status === "closed"
      ? "closed"
      : current.status === "pending_payment"
        ? "pending_payment"
        : "live";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Your Surveys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start a new survey, watch responses come in, and download your reports once you're ready to close.
        </p>
      </div>

      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-serif">Before you begin</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Please carefully read all the guiding materials in the <strong className="text-foreground">Prepare</strong>,{" "}
            <strong className="text-foreground">Collect</strong>, <strong className="text-foreground">Interpret</strong>, and{" "}
            <strong className="text-foreground">Act</strong> tabs on this dashboard before launching your survey. They are
            essential to successfully completing the survey and getting the most out of your results.
          </p>
        </CardContent>
      </Card>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {closeError && <Alert variant="destructive"><AlertDescription>{closeError}</AlertDescription></Alert>}
      {downloadError && <Alert variant="destructive"><AlertDescription>{downloadError}</AlertDescription></Alert>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : state === "none" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2" data-testid="card-start-survey">
            <CardHeader className="pb-2">
              <span className="text-primary"><PlusSquare className="h-5 w-5" /></span>
              <CardTitle className="text-base font-serif mt-2">Start your survey</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Each survey is a one-time purchase for your church — there's no subscription. When you're ready, you'll
                choose a start and end date, set your minimum response goal, and complete checkout before the survey opens.
              </p>
              <Button onClick={onStartNew} data-testid="button-start-new-survey">Start a new survey</Button>
            </CardContent>
          </Card>
          <Card data-testid="card-not-sure">
            <CardHeader className="pb-2">
              <span className="text-primary"><Clock className="h-5 w-5" /></span>
              <CardTitle className="text-base font-serif mt-2">Not sure where to start?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The <strong className="text-foreground">Prepare</strong> tab walks through how to introduce the survey to
                your leaders and congregation before you launch.
              </p>
              <button className="text-sm text-primary underline underline-offset-2 mt-2" onClick={onGoToPrepare}>Go to Prepare →</button>
            </CardContent>
          </Card>
        </div>
      ) : state === "pending_payment" && current ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2" data-testid="card-pending-payment">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <span className="text-primary"><CreditCard className="h-5 w-5" /></span>
                <CardTitle className="text-base font-serif">{current.label}</CardTitle>
                <Badge variant="secondary" data-testid="badge-status-pending-payment">Payment pending</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                This survey isn't live yet — checkout wasn't completed. Finish payment to open it to your congregation,
                or start over with a new survey.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={onStartNew} data-testid="button-retry-payment">
                  Start a new survey
                </Button>
                {onAbandonPending && (
                  <Button size="sm" variant="outline" onClick={() => onAbandonPending(current.id)} data-testid="button-abandon-pending">
                    Discard this one
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : state === "live" && current ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2" data-testid="card-live-wave">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-serif">{current.label}</CardTitle>
                  <Badge data-testid="badge-status-live">Live</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {fmtDate(current.opensAt) ? `Opened ${fmtDate(current.opensAt)}` : "Not yet opened"}
                  {fmtDate(current.closesAt) ? ` · Closes ${fmtDate(current.closesAt)}` : ""}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Join code: <span className="font-mono tracking-wider">{current.joinCode}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="font-serif text-2xl font-semibold tabular-nums" data-testid="text-response-count">
                    {current.responseCount ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Responses</div>
                </div>
                <div>
                  <div className="font-serif text-2xl font-semibold tabular-nums">{current.minSampleSize}</div>
                  <div className="text-xs text-muted-foreground">Minimum needed</div>
                </div>
                <div>
                  <div className="font-serif text-2xl font-semibold tabular-nums">
                    {Math.min(100, Math.round(((current.responseCount ?? 0) / Math.max(1, current.minSampleSize)) * 100))}%
                  </div>
                  <div className="text-xs text-muted-foreground">Of minimum</div>
                </div>
              </div>
              <Progress value={Math.min(100, ((current.responseCount ?? 0) / Math.max(1, current.minSampleSize)) * 100)} />
              <p className="text-xs text-muted-foreground">
                {(current.responseCount ?? 0) >= current.minSampleSize
                  ? "You've reached your minimum — the survey can be closed whenever you're ready, or left open to reach more of the congregation."
                  : `${current.minSampleSize - (current.responseCount ?? 0)} more response${current.minSampleSize - (current.responseCount ?? 0) === 1 ? "" : "s"} needed before you can close and generate reports.`}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" size="sm" disabled title="Coming soon">
                  <Send className="mr-1.5 h-3.5 w-3.5" /> Send reminder
                </Button>
                <Button
                  size="sm"
                  disabled={(current.responseCount ?? 0) < current.minSampleSize || closingId === current.id}
                  onClick={() => onClose(current.id)}
                  data-testid="button-close-survey"
                >
                  {closingId === current.id ? "Closing..." : "Close survey & run reports"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card data-testid="card-reminder-info">
              <CardHeader className="pb-2">
                <span className="text-primary"><Send className="h-5 w-5" /></span>
                <CardTitle className="text-base font-serif mt-2">What "Send reminder" does</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sends a one-time nudge to everyone who has <strong className="text-foreground">not yet responded</strong> —
                  a short email/text reminding them the survey is open and takes about 10–15 minutes. People who already
                  completed it are not contacted.
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-one-at-a-time">
              <CardHeader className="pb-2">
                <span className="text-primary"><FileStack className="h-5 w-5" /></span>
                <CardTitle className="text-base font-serif mt-2">One survey at a time</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A church can only run one survey at a time. Once this one closes and your reports are ready, you'll see
                  the option to start another whenever you're ready to purchase and launch it again.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : current ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-closed-wave">
              <CardHeader className="pb-2">
                <span className="text-primary"><CheckCircle2 className="h-5 w-5" /></span>
                <CardTitle className="text-base font-serif mt-2">{current.label} — closed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {fmtDate(current.closedAt) ? `Closed ${fmtDate(current.closedAt)} · ` : ""}
                  {current.snapshot?.respondentCount ?? current.responseCount ?? 0} responses
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onViewReport(current)} data-testid="button-view-report">
                    View report summary
                  </Button>
                  {current.snapshot?.reportPdfPath ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDownloadReport(current)}
                      disabled={downloadingId === current.id}
                      data-testid="button-download-church-report"
                    >
                      {downloadingId === current.id ? "Preparing..." : "Download Church Report (PDF)"}
                    </Button>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">Full PDF not available for this survey</span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-make-sense">
              <CardHeader className="pb-2">
                <span className="text-primary"><Clock className="h-5 w-5" /></span>
                <CardTitle className="text-base font-serif mt-2">Make sense of your results</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Head to the <strong className="text-foreground">Interpret</strong> and{" "}
                  <strong className="text-foreground">Act</strong> tabs for guidance on reading your report and turning it
                  into next steps with your leaders.
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Ready to run this again? Each survey is a separate purchase —{" "}
            <button className="text-primary underline underline-offset-2" onClick={onStartNew} data-testid="button-start-again">
              start a new survey
            </button>{" "}
            whenever you're ready, even if that's next year.
          </p>
        </div>
      ) : null}
    </div>
  );
}
