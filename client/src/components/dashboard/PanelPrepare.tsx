import { PREPARE_CARDS } from "@/lib/dashboardContent";
import { InfoCardView } from "./InfoCardView";

export function PanelPrepare() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Prepare</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Getting ready for the Jesus Journey Survey — the steps that make everything after this easier.
        </p>
      </div>
      <section
        className="rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-3"
        aria-labelledby="coordinator-privacy-heading"
        data-testid="coordinator-privacy-note"
      >
        <h2 id="coordinator-privacy-heading" className="font-serif text-lg font-semibold">
          Demographics and privacy
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Before inviting participants, explain how demographic answers are handled:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
          <li>
            Each church survey demographic question requires a selection. Participants may choose
            “Prefer not to say” for gender, relationship status, and ethnic or cultural background.
          </li>
          <li>
            Demographic answers are used only in aggregate church reporting. Categories with fewer
            than 10 respondents are not shown in demographic reports or written insights. Additional
            results may be withheld to protect small groups; missing answers and “Prefer not to say”
            are not comparison groups.
          </li>
          <li>
            Respect each person’s choices. When helping with paper responses, never guess a missing
            answer or choose “Prefer not to say” on someone’s behalf. Do not try to identify people
            in withheld groups.
          </li>
        </ul>
        <a
          href="#/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          data-testid="link-coordinator-privacy"
        >
          Read the survey privacy notice (opens in a new tab)
        </a>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {PREPARE_CARDS.map((card) => (
          <InfoCardView key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}
