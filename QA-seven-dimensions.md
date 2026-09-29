# Seven Dimensions cleanup: QA and release review

This change is limited to removing the retired Seven Dimensions from reporting.
The Four Goals and Sixteen Pathways remain the reporting framework. Survey
wording, scoring, Distant/Exploring branching, schema, payment and email logic
are outside scope.

## Review inventory

- New and saved debriefing reports: no legacy headings, tables, rankings,
  narratives, appendices or derived belief/practice rollups. Verify JSON,
  React and paired/standalone PDF paths.
- Goal/pathway integrity: four goal tables with sixteen pathways, with identical
  scores, trajectories and demographic evidence compared with the base commit.
- Saved report compatibility: absent, null and empty legacy fields; immutable
  archive; idempotent display projection; stale paired models.
- Church downloads: recognized legacy process page replaced, other page
  content streams/text and metadata preserved. Clean files returned byte-for-byte.
  Unknown legacy layouts fail closed and require review.
- Access: admin JSON/PDF, church-owned PDF and public-demo PDF; reject ordinary
  church access to admin reports and cross-account church downloads.
- Preview controls: new/saved toggle in both directions; both PDF downloads;
  keyboard focus; desktop/mobile; scroll to all four goal tables and final notes.
- Off-happy-path checks: unknown PDF layout and malformed/absent legacy JSON.
- Presentation: no clipped headings or controls, no page-level horizontal
  overflow, readable stacked findings on mobile; evidence tables retain their
  own horizontal scrolling.

## Automated checks

Run from the repository root with dependencies installed. No production
credentials are needed.

```sh
npx tsx script/seven-dimensions-qa.ts
npx tsx script/seven-dimensions-api-qa.ts
npx tsx script/render-short-qa.ts
python3 -m unittest discover -s server/report-engine/tests -p 'test_seven_dimensions.py' -v
npx tsx script/paired-debriefing-qa.ts
npx tsx script/short-form-unit-qa.ts
DATABASE_URL='postgresql://unused@127.0.0.1:9/unused?sslmode=disable' npx tsx script/participant-demo-qa.ts
DATABASE_URL='postgresql://unused@127.0.0.1:9/unused?sslmode=disable' npx tsx script/dashboard-demo-qa.ts
npm run check
npm run build
npx tsx script/build-dimensions-review.ts
```

For the baseline comparison, materialize `shared/debriefing/engine.baseline.ts`
from the starting Git commit, run the first script, then remove that temporary
file. It is not part of the change.

## Implementation boundaries

- New report generation no longer invokes the legacy dimension analysis.
- Archived debriefing JSON is projected at API, React and PDF boundaries; raw
  `reportJson` is no longer duplicated in the admin response.
- Legacy source metadata remains intact. Dimension text retained in
  `script/fixtures/` is deliberately test-only, never a report/demo input.
- Generic uses of “dimension” in approved short-form prose, Scripture
  quotations and demographic cross-tab variable names are not the retired
  Seven Dimensions and are unchanged.
- The church PDF download projection adds `pypdf>=6,<7` to the Python runtime.
  It never uploads or alters stored PDFs. Unrecognized old layouts produce an
  error instead of returning a misleading partial report.
- Older copies already downloaded or shared outside the app are not changed.
- No migrations or production operations are included. Merge and live
  deployment require separate release approval.

## Verified results

- TypeScript check and production build passed.
- Projection checks passed for older/current reports, immutable archives,
  missing/null/empty legacy fields and mixed/short-only/suppressed cohorts.
- Four Goals and Sixteen Pathways, demographic evidence, maturity, engagement
  and bottleneck metrics matched the base engine on the same synthetic rows.
- Ten focused HTTP checks passed for cleaned payloads, PDF downloads,
  authorization and zero database/storage writes.
- Five Python regression tests passed, including text extraction across all
  fourteen generated PDFs and unchanged results-page content streams.
- Existing paired-renderer checks passed, including concurrent downloads and
  long escaped text.
- Fifteen short-form unit groups, participant-demo safeguards and thirty-seven
  public-dashboard HTTP checks passed.
- Twenty-seven close/retention scenarios passed against a newly created
  sandbox PostgreSQL database and local object-storage emulator: nine each for
  full, short and mixed surveys. Real Python generation was included. Simulated
  render, upload, read-back and transaction failures retained responses.
- Desktop (1440px) and mobile (390px) review passed for both report modes, all
  four goal sections, final notes, mode switching by pointer/keyboard and PDF
  downloads. No runtime errors or page-level horizontal overflow were found.
  Mobile evidence tables retain their existing internal horizontal scrolling.
- Reviewed the debriefing PDF's nineteen-page contact sheet, the first page at
  full size and the church PDF's replacement process page. No visible overlap
  or clipping was found in those checks.

The existing build still emits bundle-size, PostCSS and CommonJS import-meta
warnings; the established path fallback is retained. Dependency installation
reported one moderate npm advisory. No unrelated dependency upgrade was made.
