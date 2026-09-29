# Distant / Exploring: implementation and release review

The short-form branch is implemented for review on `feature/distant-exploring-short-form`, based on production commit `59b60e94e3c9164fbf19902d0994235b1896fff8`. This work is not a production release. No production data, schema, credentials, payments, email settings, or deployment settings were changed.

- **Draft pull request:** [Distant/Exploring: 38-item short survey and private reports](https://github.com/garydebest/jesus-journey-app/pull/1)
- **Implementation commit:** `8448add272581964c049a7d341425c3573c6eed0`

## Confirmed instrument

- **Opening response:** 1 or 2 selects the short form. The final self-assessment never changes the variant.
- **Question count:** 38 retained statements, 25 omitted statements, versus 63 in the full form.
- **Explicit decision:** The original pasted survey marked K-3, K-4 and K-5 as omitted, producing 35 questions. The later approved specification retained them. On September 28, Gary explicitly chose “Keep 38 questions,” preserving the five-item Pathway 1 formula. The earlier references to 47 were incorrect.
- **Measurement:** 15 pathways; Pathway 3 has no score; Pathways 4, 5 and 15 are single-item measures. Complete-pathway means use only retained answers and round to two decimals.
- **Private report:** Three highest Strengths, then three lowest remaining Opportunities, with lower pathway number breaking ties. Thirty approved narrative paragraphs were imported verbatim from the approval thread. Current pathway names, taglines, Scripture references, retained statement wording and existing opening/closing copy are reused.

## Implementation

| Area | Implementation |
|---|---|
| Canonical short form | `shared/shortFormConfig.json`; 38-item list and every pathway formula |
| Scoring and variant helpers | `shared/shortForm.ts`; complete-only scoring, omission status, selection, historic-row classification |
| Individual and group flows | Dynamic question sequence/progress; existing final questions; demographics/comments only in group mode |
| Individual feedback | `ShortReportSections.tsx` plus a conditional branch in `Report.tsx`; no sixteen-pathway chart, numeric scores or Pathway 3 on short reports |
| Group completion | A successfully submitted short response opens the private report in memory; existing full-group completion is preserved |
| Input validation | `shared/submission.ts`; all retained items required, integers 1–5, omitted/unknown item codes rejected before storage |
| Group aggregation | `shared/cohortReporting.ts`; version-separated item agreement percentages, privacy-filtered before serialization |
| Church PDF | `cohort_report.py` renders separated cohorts for mixed/short-only waves; existing full-only PDF path remains unchanged |
| Admin debrief | Analytical engine runs on eligible full responses only, with an explicit scope note; short results appear separately as item percentages |
| Privacy during collection | Live gender/age tables are withheld if a nonempty cell is below five; no false zeroes are displayed |
| Retention | Existing transaction, PDF upload/read-back verification, rollback and raw-response deletion ordering are unchanged |

## Storage and historical compatibility

No new database columns or migration are required. Existing initial-journey and nullable item columns encode the variant and omission status; scores continue to be computed rather than persisted. Independent surveys remain entirely in React memory and never create a respondent or response row.

For stored group responses, a complete 63-item row remains a full-form observation even if its opening response was 1 or 2, because earlier releases did not branch. A short observation requires initial response 1/2, all 38 valid retained answers, and null omitted fields. Other patterns are excluded as incomplete/unrecognized. Closed reports are not regenerated or rewritten.

New mixed-wave snapshots contain a versioned cohort-report object. Legacy average fields are empty, preventing an old consumer from presenting a full-cohort score as an unlabelled church-wide average. Full-only snapshots retain their existing shape and calculations.

## Privacy rules

- Cohort results and counts are withheld below five respondents. When subtracting a larger cohort from the overall total could reveal a small cohort, both cohort results are withheld.
- A demographic/journey distribution is withheld in full if a populated category, or its missing-response complement, is below five. Suppression takes place before output, not just in CSS.
- Mixed-wave comments are flattened, sorted independently of submission order, and never labelled with journey stage, gender, other demographics, respondent IDs or timestamps.
- Comments with obvious direct identifiers are withheld. At least five usable comment authors are required before any verbatim feedback is displayed. If none can be safely displayed, a confidentiality notice is saved as the comments PDF so closing can still verify that required report.
- Automated screening cannot guarantee anonymity in free-form prose. Recognizable roles, events or circumstances may remain; church leaders must handle the comments report confidentially.
- The admin debrief remains behind its existing admin authorization boundary. No new participant-level endpoint or report retrieval token was added.

## Visible differences to review

The short individual report is new and intentionally focused on six pathways. The existing full individual report wording and full scoring definitions have not been rewritten.

For a wave containing short responses, the church report now uses clearly separated item-percentage tables with privacy-protected profiles instead of forcing incompatible measurements into the old church-wide charts. This mixed-wave layout uses the established report fonts and palette but is a visible report-format change to review before release. Full-only waves continue to use the existing church PDF and summary format.

The new group short report is shown only after a successful anonymous submission. The non-saving participant demo still clears its practice answers at completion instead of creating a report or database record.

## Deployment boundary

The [GitHub repository](https://github.com/garydebest/jesus-journey-app) had no Actions workflows or repository webhooks when checked. The [Render service](https://dashboard.render.com/web/srv-dabh33ajnfac73an7s70) deploys on commits to `master`; pull-request previews are disabled. The review build is separate from both the production entry point and the existing dashboard/participant preview artifacts.

Release requires explicit approval, then a fresh comparison with `master` to detect concurrent work, a reviewed merge, a controlled Render deployment, and live smoke tests using only reserved demos or explicitly authorized test fixtures. This branch must not be treated as authority to modify production before that approval.

## Test evidence

See `docs/short-form-qa.md` for the reusable inventory and commands. Testing uses synthetic responses, a throwaway localhost PostgreSQL database, and a localhost object-storage emulator. No real payment or email delivery was tested.

The deployed private preview also passed a complete 38-question group flow, proxy API submission, private six-pathway report and return to review home. The preview backend is `script/short-review-server.ts` on port 5000 and validates/discards practice submissions; it imports no production storage, payment or email services.
