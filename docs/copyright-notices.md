# Copyright notices (approved October 6, 2026)

Gary approved these notices exactly:

- Website: `© 2026 Gary Best Consulting. All rights reserved.`
- Survey questionnaire, pathway descriptions and original report content: `© 2017–2026 Jesus Journey Group. All rights reserved.`

## Where the survey notice appears in this app

- Survey home (`#/`), individual intro, every question screen (via `QuestionShell`), church-participant intro, comment and completion screens, the participant privacy notice, and the results screen. Component: `client/src/components/SurveyCopyright.tsx`.
- Each placement has a discreet **Terms** link to `https://jesusjourney.life/terms`, opening in a new tab so in-memory survey answers are never lost. Hidden in print.
- The printed / saved individual report footer (print-only line under the generation date).
- Newly generated church PDFs: full report, mixed/short cohort report, Comments Report and Comments Wordcloud. Drawn in the existing footer band above the church/date line (centred on covers); `server/report-engine/copyright_notice.py`.
- `client/public/jesus-journey-paper-survey.pdf`, added by `script/add-paper-copyright.py` (all other text verified unchanged).

## Intentionally unchanged

- Saved customer and demo reports in storage are never regenerated or overwritten for this notice. Archived-report projection is unchanged.
- The admin-only Debriefing Report keeps its existing internal footer.
- Coordinator resources, small-group workbook and other journey resources were not stamped (ownership to be confirmed).

`script/stamp-sample-copyright.py` adds the notice to public sample PDFs (never customer reports). `script/copyright-preview-server.ts` runs the built client with stubbed storage for local UI QA.
