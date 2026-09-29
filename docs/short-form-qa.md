# Distant / Exploring short-form QA

## Review inventory

The release must demonstrate these user-visible behaviours before production approval:

- Opening responses 1 and 2 show 38 statements in the original order and wording.
- Opening responses 3, 4 and 5 show all 63 statements with unchanged scoring and full-report copy.
- Back navigation and a changed opening answer cannot retain omitted answers in scoring or submission.
- Every displayed scored item is required. Final self-assessment does not change the selected variant.
- Individual mode has no demographic/comment screens, network submissions, persistent report or browser storage.
- Group mode keeps all existing demographic/comment questions and submits anonymous answers only.
- Short-form group participants see the same private report after successful submission; failed submissions are retryable.
- The participant demo never submits or saves, including the new shorter branch.
- Short reports contain three Strengths and three Opportunities, no duplicate pathways, no Pathway 3, no complete-pathway chart or numbers.
- Print, restart, refresh and mobile layouts work. Refresh/restart removes the private in-memory results.
- Group results use separated cohorts, correct item agreement percentages and server-side primary/complementary suppression below five.
- Group comments are unlinked from demographics, journey stage and technical metadata; obvious identifiers are withheld.
- Full-only, mixed and short-only waves generate and verify all required PDFs before deleting raw rows.
- Invalid input, closed/unpaid waves, public-demo writes, other-church reports and unauthenticated report access are rejected.

## Functional and visual coverage

- Desktop: individual and group survey, sample short/full reports, church cohort summary, small-cohort suppression, admin debrief scope.
- Mobile at 375px: survey choices/progress/back, report print buttons, pathway sections, group summary, review navigation.
- Print: six short-form sections and closing are present; controls are hidden.
- Exploratory: change opening response after answering; force a failed group submission then retry; refresh a completed private report; short respondent with final journey 5; historical full respondent with initial journey 1.

## Automated test commands

Use a disposable PostgreSQL database named `jj_preview` on localhost only. Never use production connection details. Initialize the empty database with the existing Drizzle schema, not the incomplete legacy bootstrap helper.

```sh
npm ci --ignore-scripts
npm run check
npm run build
npx tsx script/short-form-unit-qa.ts
npx tsx script/short-form-api-qa.ts
npx tsx script/participant-demo-qa.ts
npx tsx script/dashboard-demo-qa.ts
npx tsx script/close-safety-qa.ts
JJ_QA_VARIANT=mixed npx tsx script/close-safety-qa.ts
JJ_QA_VARIANT=short npx tsx script/close-safety-qa.ts
npx tsx script/render-short-qa.ts
python server/report-engine/tests/test_cohort_privacy.py
npx tsx script/build-short-review.ts
```

The close tests emulate object storage locally and inject upload, read-back and database failures. No real payments or email are exercised.

## Results from this implementation review

All of the following passed in the isolated environment:

| Check | Result |
|---|---|
| TypeScript | `npm run check` passed |
| Production build | Passed; existing bundle-size, PostCSS and CommonJS/import-meta warnings remain non-blocking |
| Short-form logic | 15 test groups passed, covering configuration, formulas, status, ranking, input validation, historic records, cohort separation and suppression |
| Actual HTTP and PostgreSQL | 18 checks passed; correct nullable storage, exact required item sets, authorization and closed-wave guards |
| Public dashboard demo | 37 HTTP checks passed, including write denial, admin isolation and other-church ownership |
| Participant demo | Metadata, case/whitespace handling, zero demo storage calls, direct submission rejection and ordinary-wave restrictions passed |
| Report retention | Nine scenario groups passed in each of full-only, mixed and short-only mode, 27 mode/scenario combinations |
| Comments PDFs | Five tests passed, including small pools, direct identifiers, unlinked metadata and notice-only output |
| Browser completion | 15 end-to-end runs: all five initial answers in both modes, short/full participant demos, mobile individual/group, and failed-submit retry |
| Responsive review | Seven review screens at desktop and 375px, 14 viewport checks; no horizontal overflow |
| Private report lifecycle | Print controls, four-page print output, restart, refresh and full-to-short-to-full back navigation checked |
| Runtime errors | None observed in browser tests |
| PDF layout | Ten generated/printed PDFs, all pages checked for text outside page bounds; church report pages also visually inspected |
| Protected core files | Survey statements, pathway definitions/full narratives, full scoring, question definitions, database schema, close transaction and storage verification have no diff from the baseline |

Browser evidence is recorded in `qa-output/browser-results.json` and screenshots during development. `qa-output` and local database/connection settings are intentionally excluded from Git. Durable review evidence is saved in Project Files rather than shipped with the production app.

## Release status

Ready for user review, not released. The mixed-wave church PDF layout, automatic comment-screening limitation, and deliberate 38-item choice are documented in `docs/distant-exploring-implementation.md`. Production approval and post-release smoke tests remain outstanding.
