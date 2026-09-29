# Dennis's feedback: independent corrections

Prepared September 29, 2026. Implemented on `fix/dennis-independent-corrections`,
based on production commit `e6762eaec1786ca50e122451710c874eccdea5e5`.
This is a tested release candidate, not a production deployment.

## Implemented

- **Online answer scales:** Both independent and church-code flows select the
  belief/practice wording by the stable statement code. Full and short forms
  retain their existing item lists, scoring, and narratives.
- **Paper survey:** Six incorrect rating labels on pages 4–6 are corrected.
  All other text is unchanged, and untouched pages are pixel-identical.
- **Paper-entry instructions:** The Collect tab now covers the church code,
  required answers versus optional comments, 38-item routing, the five-character
  collection code, immediate printing, sealed envelopes, duplicate-code caution,
  volunteer confidentiality, and avoiding duplicate submissions.
- **Full-length group personal report:** Successful full-form submissions now
  show the existing private, print-ready report, as short-form submissions
  already did. Failed submissions never show success. No personal report is
  persisted or exposed to the church. The reserved demo remains non-saving.
- **Church report calculations:** Distant and Exploring are combined using
  counts in maturity and statement tables. Monthly-or-less attendance and
  six-or-more-years tenure pool people rather than averaging percentages.
- **Blank versus zero:** Statement cells with no valid observations are blank;
  true zero agreement remains 0, and rare positive agreement displays <1 rather
  than rounding to zero. The legend explains these distinctions.
- **Children in household:** Both report paths and new dashboard summaries use
  age bands divided by completed respondents, with duplicate selections counted
  once per person. Multi-select totals can exceed 100%. Existing mixed-report
  privacy protection remains, with checks of each age band's small complement.
- **Interpretation:** Restored Goal/Pathway table explanations, a precise 50%
  example, and a comparison-chart-specific exclusion note. Added leadership
  guidance explaining the self-assessed maturity categories.
- **Opening/closing reflection:** The standard report and new full-form
  summaries show later/same/earlier self-description, not claimed spiritual
  growth. This new display uses conservative five-person suppression, including
  small outcomes and missing-pair complements.
- **Summary alignment:** New full-form summaries show agreement percentages
  instead of presenting 1–5 averages as comparable with the PDF. Goal averages
  are equal-weight averages of four pathway percentages and also appear on the
  standard PDF summary page. Existing legacy fields are preserved for compatibility.
- **Clarity:** Goal and pathway colours align within the dashboard summary,
  swatches are larger, all chart pathway labels are shown, and mobile Goal
  Average cards use a single-column layout.

## Still on hold for Dennis

The proposed unified report structure, pooling of short/full-form statement
tables, new short-form listening section, and changes to composite-score
populations are not implemented. Existing short/full cohort separation remains.

The proposed report-wide 10/5 privacy policy is also still pending review.
This release does not claim to resolve the existing standard report's
small-subgroup suppression gap. Existing short-form protections are retained;
the narrow new reflection display has its own conservative protection.

## Existing saved reports and summaries

No historical PDF or database snapshot is rewritten. Corrected arithmetic applies
to future reports generated from available raw responses; future closure still
uses the existing verified-storage-before-purge process.

Older saved dashboard summaries retain their actual 1–5 numbers, now explicitly
labelled. Agreement percentages cannot be recovered from those averages.
Unavailable child-age counts are identified rather than invented. No database
migration, credential, hosting configuration, payment, or email change is required.

## Verification

- TypeScript check and production build passed.
- Nine focused TypeScript test groups and six focused Python tests passed.
- Fifteen short-form regression groups passed.
- Thirty-seven dashboard-demo HTTP checks and participant-demo isolation checks
  passed using mocked storage and an intentionally unusable local database URL.
- Five comment-privacy tests and existing report/projection tests passed.
- The production Python bridge generated the synthetic 38-page church PDF.
  Corrected explanations and affected-page rendering were checked.
- Sixteen browser scenario/check groups passed, covering full/short individual,
  full/short church, failed submit/retry, refresh, printing, both reserved demos,
  invalid join metadata, navigation, old/new summaries, final mobile layout,
  and all five downloadable PDF links.
- Desktop/mobile screenshots and paper/PDF visual checks were reviewed.
  No runtime errors were observed. No production participant submissions,
  database reads, wave closing, payments, email, or saved-report writes occurred.

## Release boundary

Review the private preview and synthetic report before authorizing the production
merge/deploy. The previous report-review artifact is reused; the separate
short-form and dashboard/participant-demo review artifacts are not overwritten.
