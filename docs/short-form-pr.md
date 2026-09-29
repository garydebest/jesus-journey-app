## Summary

Implements the approved Distant/Exploring short form on a separate review branch. Initial journey answers 1/2 receive 38 scored items; 3/4/5 retain the full 63-item survey.

- Adds 15-pathway complete-only short scoring and three Strengths / three Opportunities.
- Imports the 30 approved short-form narratives verbatim and preserves existing full-survey wording.
- Keeps anonymous individual responses/report state in memory only.
- Adds the private short report after successful group submission.
- Separates short/full church results with primary and complementary suppression below five.
- Adds mixed-wave PDFs, unlinked comment handling, and full-only scope for admin analytical findings.
- Preserves existing full-only reporting and the report-save verification transaction.
- Adds isolated QA and a separate private-review entry, not a production route.

## Deliberate decisions and review notes

The owner explicitly chose 38 questions, including K-3/K-4/K-5, after the original 35-item draft discrepancy was identified. No database migration or new identifying participant data is introduced. Historical complete 63-item records remain full observations.

Mixed-wave church PDFs use separated item tables rather than blended legacy charts; this visible layout requires owner review. Automated comment screening withholds obvious direct identifiers but cannot guarantee anonymity of contextual prose.

## Validation

- TypeScript and production build passed.
- 15 short-form unit groups, 18 real HTTP/local PostgreSQL checks, 37 public dashboard demo checks, participant-demo safeguards.
- Report retention: 9 scenario groups each for full-only, mixed and short-only waves.
- 5 comments PDF tests.
- 15 browser completion runs, 14 desktop/mobile viewport checks, no observed runtime errors.
- Generated church/comments/admin PDFs and printed individual report checked.

## Deployment boundary

Draft only. Do not merge or deploy without separate owner approval.

Production Render tracks `master` with commit auto-deploy enabled; PR previews are disabled. GitHub reported no Actions workflows or repository webhooks. No production data, credentials, schema, payment/email configuration or live deployment settings were changed.

Implementation and repeatable QA details: `docs/distant-exploring-implementation.md` and `docs/short-form-qa.md`.
