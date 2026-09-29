# Dennis corrections: QA inventory

Use synthetic data only. No live submissions, wave closings, payments, email,
production database reads, or saved-report regeneration.

## Functional and visual coverage

- Belief and practice scales: check all 63 codes and both 38-item branches;
  browser transition 18 to 19 and back; desktop/mobile prompt and options.
- Individual full and short survey: complete normal controls, confirm report,
  restart/refresh destroys transient answers.
- Group full and short survey: mock only local HTTP responses, complete required
  demographics, test rejected submission/retry, show print-ready private report
  only after success, exactly one successful submit.
- Reserved demo: complete without POST and without generating a personal report.
- Paper form: compare word inventory and unchanged pages, render page 4 and 6;
  keys corrected, church questions and personal code remain.
- Guidance: open/close the real document controls, review volunteer privacy,
  join-code route, optional comments and immediate print instruction.
- Summary: new agreement percentages versus clearly labelled historical 1–5
  averages; null and zero; children bands total above 100%; desktop/mobile.
- Reports: Distant/Exploring pooling; unequal and absent category weights;
  denominator and blank-versus-zero cases; restored explanatory text and
  same-session reflection; inspect changed PDF pages for overflow.
- Scope: mixed/full cohort separation and thresholds remain; child age-band
  arithmetic only changes the combined demographic calculation. Previously
  saved reports and existing preview debriefing tabs remain available.

## Off-happy-path checks

- Missing metadata and failed group submission never reveal a success report.
- Rare positive agreement does not become a displayed zero in the statement table.
- Older summaries have no synthetic conversion from 1–5 averages to percentages.
- Five-person reflection protection includes small complements and missing pairs.
- Branch change and back navigation do not use short-form display numbering to
  choose scale wording.
