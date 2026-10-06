# Comments Wordcloud

A two-page companion PDF to the Comments Report, available to every church with a saved Comments Report (paid surveys and the public Grace demo).

## Where it appears

- Church dashboard, Your Reports: **Comments Wordcloud (PDF)** sits after **Comments Report (PDF)** and opens in a new tab through the same 10-minute view link as the other reports (`/api/waves/:id/pdf-link?kind=wordcloud`).
- Direct download: `GET /api/waves/:id/comments-wordcloud.pdf` (church auth; allow-listed for the public demo wave only).
- Admin overview: **Wordcloud PDF** beside **Comments PDF** (`GET /api/admin/waves/:id/comments-wordcloud.pdf`).
- The button is enabled whenever the wave has a Comments Report.

## How it is produced

- Source: the saved Comments Report PDF only (`server/report-engine/comments_wordcloud.py`). Those comments have already passed the comment-privacy rules (obvious identifiers withheld, five-comment pool), so the cloud cannot show anything the church cannot already read. No comment text leaves the server.
- Built on first request and cached in the `church-reports` bucket as `<waveId>-wordcloud-v1.pdf` (`server/wordcloud.ts`). No database column and no change to the survey-close transaction. Bump `WORDCLOUD_ENGINE_VERSION` (and `ENGINE_VERSION` in Python) when theme rules change so cached clouds regenerate.
- Reads both Comments Report layouts the app has produced (original grouped layout with gender tags, current unlabelled layout). Church name and date come from the Comments Report footer.

## Theme rules

- Curated survey-context lexicon maps wording to themes (for example "ask blunt questions without judging" -> Safe space for questions). Standalone background words (church, pastor, God, Jesus, faith, ministry, the church's own name) are never shown alone.
- Counted once per comment; size shows how many comments mention a theme, not importance.
- Colours: rust = requests, blue = experiences or struggles, teal = appreciation, grey = other recurring words. A few themes switch to an appreciation label only when the same (or the immediately following, non-request) sentence says it is already helping, e.g. "Prayer support received" vs "Learning to pray".
- Fewer than five comments: the PDF says there are not enough comments; no themes are shown. Up to 48 themes are shown; appreciation themes are never dropped by the cap. Surveys with 100+ comments drop themes mentioned only once (`min_count = n // 50`).
- Page 2 lists every theme with its comment count and explains the method. No CSV is produced.

## Tests

- `python3 -m unittest server/report-engine/tests/test_comments_wordcloud.py`
- `SAMPLE_COMMENTS_PDF=<comments.pdf> npx tsx script/comments-wordcloud-qa.ts`
- `script/dashboard-demo-qa.ts` covers demo scope for the new route.
