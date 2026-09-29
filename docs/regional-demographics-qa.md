# Regional demographics QA inventory

Tests use synthetic data only. No production response, payment, email, closing operation, migration, configuration change, merge or deployment is authorized.

## Functional coverage

- Voluntary questions: all nine screens have Skip, backward navigation and a selected-answer Continue. Skipping after going back removes the previous answer.
- Regional wording: CA, US, GB, other, unknown, missing and failed request; JSON display endpoint is no-store and returns only a preset.
- Multi-select: choose two backgrounds, deselect one, select Prefer not to say, select a background again. Verify children “None” exclusivity.
- Submission: skipped demographics save null; arrays encode as stable IDs in the existing text column; legacy scalar values remain accepted. Country, IP and preset are not saved.
- Reporting: 0/1/5/6/9 withheld, 10 and above reportable; all nine fields plus singles/married; true missing not converted to no-children; no missing-age insights. Complementary suppression where small residuals can be inferred.
- Boundaries: new/full/mixed reports, saved summaries, saved debrief JSON and derived prose, full church PDFs, live participation counts. No demographic-by-demographic intersections.
- Regressions: short/full survey instruments, participant demo non-saving guard, public dashboard access control, retention safeguards.

## Browser and visual coverage

Use the production client build with isolated API fixtures, never real survey codes. Complete ordinary full and short flows plus the reserved demo. Inspect gender, optional intro, ethnicity multi-selection, long UK/US labels, skip/back state and privacy notice at desktop and 375px. Capture screenshots, verify no horizontal overflow and no browser errors.

Off-happy-path checks: failed display endpoint falls back to international; Skip clears a previously answered screen; a mixed Prefer not to say payload cannot disclose ethnicity; old percentages without category counts are never treated as exact counts.

## PDF review

Generate synthetic full, mixed, all-skipped, below-threshold and threshold-boundary PDFs through production renderers. Extract text to verify omission, inspect relevant pages and ensure sparse data does not crash charts. Old church PDFs without verifiable counts have demographic pages withheld on download, leaving stored originals untouched; unrecognized layouts fail closed for review.
