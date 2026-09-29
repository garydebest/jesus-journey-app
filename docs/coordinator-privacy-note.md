# Coordinator privacy note

Gary approved adding a short coordinator note to the church dashboard's Prepare section and releasing it live. This is a presentation-only follow-up to the regional demographic privacy release.

## Scope

The note appears beneath the Prepare introduction and before the existing preparation cards. It explains required demographic selections, the three Prefer not to say choices, aggregate-only demographic reporting, the 10-person reporting floor, additional suppression, and careful handling of paper answers. It links to the existing public privacy notice in a separate tab, leaving Prepare open.

No survey requirements, privacy thresholds, scoring, API, storage, database schema, retention, credentials or hosting settings change. The same Prepare component serves church coordinators and the public dashboard demo.

## QA inventory

- Verify all note wording against the released required-demographics policy.
- Check placement and readability at 1280px desktop and 375px mobile.
- Follow the privacy link, confirm the correct page opens separately, and verify Prepare remains open.
- Switch to Collect and back, ensuring the note appears only in Prepare.
- Confirm existing preparation cards remain.
- Block all non-GET/HEAD requests during browser checks.
- Run TypeScript checking, production build, demographic tests and dashboard-demo route/access regressions.

## Test commands

- `npm run check`
- `npm run build`
- `npm run test:demographics`
- `DATABASE_URL='postgresql://unused@127.0.0.1:9/unused?sslmode=disable' npx tsx script/dashboard-demo-qa.ts`
- Playwright `runCoordinatorPrivacyQa(browser, "http://127.0.0.1:5000", out)` from `script/coordinator-privacy-qa.mjs`, with isolated API fixtures and production client files.
- After release: the same helper against `https://myjesusjourney.life`, with `live=true`, public read-only demo only.
- `git diff --check`

## Pre-release results

TypeScript checking and production build passed. The demographic suite passed 16 TypeScript policy groups, 18 HTTP/persistence-boundary checks and 8 Python privacy tests; dashboard-demo regression testing passed all 37 HTTP/access checks. `git diff --check` passed.

The browser helper passed at both 1280px and 375px against the production bundle. All copy assertions, existing-card checks, Prepare/Collect navigation and the separate-tab privacy link passed, with zero browser errors, write attempts or horizontal overflow. Screenshots were inspected at both sizes. Existing bundle-size, PostCSS, Zod annotation and CommonJS import.meta warnings remain unchanged.

Deployment identity and live results are recorded in the pull request and Project release record after verification. No production participant submission, report generation, wave close, email or payment is used for verification.
