import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RESOURCE_CARDS } from "@/lib/dashboardContent";
import { ResourceCardIcon } from "./icons";
import { FullDoc } from "./FullDoc";
import { FULL_DOCS } from "@/lib/reportGuidance";
import { JOURNEY_RESOURCES as R } from "@/lib/journeyResources";
import { ResourceLinks } from "@/components/journey/ResourceLinks";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const NUTSHELL_VIDEO_URL = "/resources/video/jesus-journey-in-a-nutshell.mp4";

const JOURNEY_GROUPS = [
  { title: "Prepare", items: [R.coordinatorGuide, R.orientationWorksheet, R.leadershipBriefing, R.readinessChecklist] },
  { title: "Launch", items: [R.launchKitDocx, R.launchKitPdf] },
  { title: "Collect and close", items: [R.monitoringGuide, R.closingChecklist] },
  { title: "Interpret", items: [R.debriefPrep] },
];

export function PanelResources() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Resources</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Templates, guides, and support materials to use throughout every stage above.
        </p>
      </div>
      <section className="rounded-lg border p-5 space-y-4" aria-labelledby="journey-guides-heading" data-testid="resources-journey-guides">
        <h2 id="journey-guides-heading" className="font-serif text-lg font-semibold">Survey journey guides</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {JOURNEY_GROUPS.map((g) => (
            <div key={g.title} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h3>
              <ResourceLinks items={g.items} />
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-resource-nutshell-video">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-serif">Jesus Journey in a Nutshell</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">Introduce Jesus Journey to your congregation with this short video. Show it during a Sunday service before launching your survey, then follow it with your church’s invitation, participant code, and survey dates.</p>
            <div className="flex flex-col items-start gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-auto min-h-9 w-full whitespace-normal py-2 text-center" data-testid="button-watch-nutshell-video">
                    Watch video
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl p-4 sm:p-6">
                  <DialogHeader>
                    <DialogTitle className="font-serif">Jesus Journey in a Nutshell</DialogTitle>
                    <DialogDescription>Captions and a written transcript are being prepared.</DialogDescription>
                  </DialogHeader>
                  <video
                    src={NUTSHELL_VIDEO_URL}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full rounded-md bg-black aspect-video"
                    data-testid="video-nutshell"
                  >
                    Your browser cannot play this video. Use the download button to save the MP4 instead.
                  </video>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" className="h-auto min-h-9 w-full whitespace-normal py-2 text-center" asChild>
                <a href={NUTSHELL_VIDEO_URL} download="Jesus-Journey-in-a-Nutshell.mp4" data-testid="link-download-nutshell-video">
                  Download video for Sunday service — MP4
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">MP4, 1080p, about 3½ minutes (21 MB). Download it ahead of time so it plays without an internet connection.</p>
            <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-nutshell-accessibility">Captions and a written transcript are being prepared.</p>
          </CardContent>
        </Card>
        {RESOURCE_CARDS.map((card) => (
          <Card key={card.title} data-testid={`card-resource-${card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
            <CardHeader className="pb-2">
              <span className="text-primary"><ResourceCardIcon icon={card.icon} /></span>
              <CardTitle className="text-base font-serif mt-2">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{card.body}</p>
              {card.downloads ? (
                <div className="flex flex-col items-start gap-2">
                  {card.downloads.map((download, index) => (
                    <Button key={download.href} variant={index === 0 ? "default" : "outline"} size="sm" className="h-auto min-h-9 w-full whitespace-normal py-2 text-center" asChild>
                      <a href={download.href} download>
                        {download.label}
                      </a>
                    </Button>
                  ))}
                </div>
              ) : card.ctaHref ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={card.ctaHref} download target="_blank" rel="noopener noreferrer">
                    {card.ctaLabel}
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled title="Resource download coming soon">
                  {card.ctaLabel}
                </Button>
              )}
              {card.downloadNote && <p className="text-xs text-muted-foreground leading-relaxed">{card.downloadNote}</p>}
              {card.fullDocIndex !== undefined && <FullDoc doc={FULL_DOCS[card.fullDocIndex]} label="Read the full message" />}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
