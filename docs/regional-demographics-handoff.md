# Regional demographics and privacy safeguards

Implementation on `feature/regional-demographics-privacy`, based on `master` at `a887547f83856012a48407eca9ae8aacacff6b3a`. Gary's subsequent instruction explicitly authorizes live release and supersedes the original voluntary-demographics/review-only brief: preserve previously required demographics and enforce the 10-person privacy floor. This change does not alter the 38/63 spiritual instrument, maturity/cohort threshold policies, payments, database schema, credentials, or raw-response retention transaction.

## Participant experience

- All nine church/group demographic screens remain required, as before this feature. Continue is disabled until a selection is made; there is no Skip action. Backward navigation retains answers. The API and database continue to accept historical missing answers as null, not a synthetic category: requiredness was historically a participant-UI rule, and this release does not impose new server validation that would reject older clients or data.
- Gender and relationship status keep their existing choices plus **Prefer not to say**.
- Ethnicity uses the requested multi-select question and the exact Canada, United States, United Kingdom, and International/Europe presets. Prefer not to say is exclusive. Children’s None is also exclusive.
- A public survey privacy notice is available at `/#/privacy`, linked from the church survey introduction. It explains required selections, sensitive non-disclosure choices and aggregate privacy. Paper-entry guidance requires obtaining missing answers from the respondent, never guessing or selecting non-disclosure on their behalf.
- The free independent survey still does not collect demographics. The reserved participant demo still never submits or saves answers.

## Data and regional selection

`GET /api/survey-display` reads only `CF-IPCountry`, returns `{ ethnicityPreset }`, and uses `Cache-Control: private, no-store` plus `Vary: CF-IPCountry`. CA selects Canada, US selects the United States, GB selects the United Kingdom; missing, unrecognized and every other country select International/Europe. A failed display request also leaves the client’s international default intact. A church region override is not included.

Country and raw IP are not copied into response data, reporting inputs, or analytics. The client keeps the preset only in component memory, separate from answers. This feature does not change separate hosting/proxy access-log policies. If Render is reached without the Cloudflare header, the international wording is expected; no proxy/DNS configuration was changed or assumed.

New ethnicity selections are normalized into stable IDs and encoded as a JSON string array in the existing `race_ethnicity` TEXT column. Examples: `["white","black"]`, `["south_asian"]`. Empty, skipped and ethnicity Prefer not to say save null. Legacy single-label requests remain accepted; existing rows are never rewritten. Legacy and new labels map into reporting groups at read time. Commas in labels are never treated as separators.

Mappings deliberately do not invent identity detail: legacy “Asian descent” remains Asian (unspecified), not East Asian. Arab, Middle Eastern/West Asian and Middle Eastern/North African remain distinct. Multi-select values are deduplicated per person per category; “Multiple backgrounds” is a selectable identity, not a category automatically added to every multi-selection. The reports do not treat all regional taxonomies as interchangeable census categories.

## Reporting policy

The demographic minimum is **10 respondents**, including gender, age, relationship status, children, attendance, tenure, small-group participation, volunteering, ethnicity and the derived singles-versus-married grouping. Below-threshold rows, labels, counts, bars, percentages and generated demographic findings are removed, not shown as directional results. Existing interpretive caution for groups of 10–14 remains; the separate 15-person confidence convention is not the privacy threshold.

Single-select distributions are conservatively withheld when a small present category or small undisclosed remainder could be reconstructed from totals. Multi-select categories are individually withheld below 10 or when their population complement is 1–9. Thus a category of 10 is reportable when otherwise safe, but 10 is a minimum, not a guarantee of display.

Skipped and Prefer not to say answers are not comparison categories. Missing children answers are not classified as “No children”; missing age brackets no longer generate “no respondents” opportunities. Children and ethnicity are counted once per respondent in each selected band and use all completed respondents as the percentage denominator; totals may exceed 100%. Single-select full-PDF distributions use disclosed answers, while dashboard/cohort proportions describe all completed respondents.

Outcome comparisons within a demographic category remain available at the threshold. No demographic-by-demographic intersection is added. The old compound-engagement narrative is removed because it combined fields and treated simply answering participation questions as engagement.

The policy is enforced in full and mixed summaries, the church Python PDF pipeline, debrief tables and narratives, copied executive findings, live participation breakdowns, and read-time projections. The source data and scoring are not modified.

New full-survey comments reports now use the existing mixed-wave unlabelled comments renderer. Demographic answers are not attached to individual comments; its existing five-comment pool protection and obvious-identifier handling are unchanged. The participant introduction clarifies that optional written comments can appear separately rather than promising that every kind of response is aggregate-only.

## Archived reports: deliberate review point

Saved aggregate JSON is projected on read without overwriting stored records. Counts are filtered at the API boundary, including nested `summaryJson` in wave metadata, with client-side defense in depth. Imported legacy percentage-only demographic summaries are withheld because they do not establish exact category counts.

Archived debrief narratives without machine-readable category/count provenance are withheld instead of guessing their sample size from prose. New demographic findings carry that provenance. Retained pathway and spiritual analyses remain separate.

Old church PDFs do not contain the exact denominators needed to validate every demographic result. For the recognized 38-page layout, download-time copies replace demographic pages 7–9, 11–12 and 15–16 with an explanation. The stored original is unchanged; other result-page content streams are retained. Unrecognized older layouts fail closed for review rather than returning potentially identifying data. New policy-compliant PDFs carry `jj-demographics-n10-v1` metadata and are not redacted again. This does not recall files already downloaded.

This archival presentation change is a deliberate privacy tradeoff in the approved release. Historical demographics cannot necessarily be regenerated because the privacy design already purged raw responses after verified report storage.

## QA commands and results

Pre-release checks use synthetic fixtures and local resources. No real response is submitted, no wave is closed, and no payment/email or production database write is made. Post-release verification uses the reserved non-saving participant demo and public read-only resources.

| Command/check | Result |
| --- | --- |
| `npm run check` | Passed |
| `npm run build` | Passed; existing bundle-size, PostCSS, annotation and CommonJS/import.meta warnings remain |
| `npx tsx script/regional-demographics-qa.ts` | 16 groups passed, covering country presets, null/legacy/multi-select storage definitions, all nine categories and derived comparisons at n=0/1/5/6/9/10/11/20, missingness, complements, and non-mutating archive projections |
| `npx tsx script/regional-demographics-api-qa.ts` | 18 HTTP/persistence-boundary checks passed; real Express routes and save function with a synthetic transaction adapter, no reachable PostgreSQL |
| `npx tsx script/short-form-unit-qa.ts` | 15 groups passed |
| `npx tsx script/dennis-corrections-qa.ts` | 9 groups passed; demographic privacy expectations updated from earlier thresholds |
| `DATABASE_URL='postgresql://unused@127.0.0.1:9/unused?sslmode=disable' npx tsx script/participant-demo-qa.ts` | Passed, including zero demo storage calls |
| Same local-only DATABASE_URL with `npx tsx script/dashboard-demo-qa.ts` | 37 HTTP checks passed |
| `npx tsx script/seven-dimensions-qa.ts` | Saved/current JSON, paired/standalone PDFs and archival projection checks passed |
| `npx tsx script/seven-dimensions-api-qa.ts` | 10 protected-route/PDF HTTP checks passed |
| `npx tsx script/render-short-qa.ts` | Mixed, short-only and small-cohort church/debrief/comment PDF scenarios passed |
| `python3 script/render-dennis-qa.py` | 38-page production-bridge synthetic PDF and explanation checks passed |
| `python3 -m unittest discover -s server/report-engine/tests -p 'test_*.py'` | 24 tests passed, including 8 new demographic cases, 5 comment-privacy tests, 6 Dennis regressions and 5 archived-report/framework tests |
| Playwright `runBrowserQa(browser)` from `script/regional-demographics-browser-qa.mjs` against the local production bundle | Four complete flows passed: Canada/full desktop; US/short mobile; UK/short reserved demo mobile; failed-display International/full desktop. Required selections on all nine screens, backward retention, non-disclosure exclusivity, and no location persistence passed. Zero page errors or horizontal overflow. The reserved demo sent no POST; other requests were intercepted fixtures only. |
| Desktop/mobile screenshots and synthetic PDF pages | Required controls and privacy wording reviewed alongside existing threshold and withheld-state layouts |
| `git diff --check` | Passed |

Run the focused core suite with `npm run test:demographics`. The Python PDF suite needs the existing report-engine requirements installed. For the browser suite, serve `dist/public` locally and call the exported `runBrowserQa` with a Playwright Chromium browser; the test intercepts every API request. Reuse the same browser harness for screenshots.

## Release boundary and limitations

- No migration is required. Historical response rows, stored reports and retention logic remain unchanged.
- Production PostgreSQL and actual Cloudflare-to-Render forwarding were not exercised. HTTP storage assertions use a mocked transaction boundary, not a live database integration test.
- Existing archived comments PDFs are not rewritten or recalled. This package is not a claim of complete anonymization or legal compliance; regional legal review and any wider comments-policy changes remain separate.
- The downloaded paper questionnaire is unchanged; operational entry guidance preserves required demographics, but redesigned regional paper forms are a separate deliverable.
- Render tracks `master`, with pull-request previews disabled. Release uses the existing service; no proxy, DNS, marketing-site or service-setting changes are included.
- The 10-person floor is retained for all demographic topics, including sensitive items, rather than weakening protection on the other topics. No new demographic cross-tabulation is added.
- Deployment IDs, final commit and live-check results will be recorded in the release record after verification.
