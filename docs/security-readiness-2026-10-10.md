# Security readiness - October 10, 2026

Status: implementation started on an isolated branch; NOT security sign-off.
Operator: Gary Best Consulting.
Baseline: 80ff2ec1240c255a1a4b1ccfc299919f7784f8ad.
Production deployment observed: dep-db4t00id0e5s73dctjig.

## Verified observations
- Live Supabase advisor: eight public tables have RLS enabled without policies; church_email_events and church_password_resets have RLS disabled. Effective grants remain unverified.
- Live church-reports storage bucket has public=false. Storage policies and deployed cross-church download tests remain unverified.
- Current authentication source has a default administrator credential when ADMIN_KEY is absent. Remove this fallback for production after confirming configuration, without recording credential values.
- The October 7 dependency findings are historical; rerun audits before reporting current counts.

## Safety boundaries
- Work on security/readiness-2026-10-10; no direct production-branch changes.
- No production credentials in CI; no real survey responses, payments, bookings or emails for tests.
- Preserve survey wording, scoring, pricing, tax, client journey and stored reports.
- Preserve verified-report-before-raw-deletion behaviour. Never automatically close or purge surveys.
- Every external write requires approval of exact arguments.
- Record changes and results in the project knowledge wiki when accessible; this document is a repository record, not a claim that the wiki was updated.

## Required release evidence
- [ ] TypeScript check and application build pass.
- [ ] JavaScript and Python vulnerabilities assessed and relevant fixes tested.
- [ ] Individual anonymous survey and church submission flows pass.
- [ ] Church and administrator login, logout, reset expiry/single-use and session revocation pass.
- [ ] Correct-church downloads work; anonymous and wrong-church requests fail for summaries, PDFs, comments, wordclouds and debriefing material.
- [ ] Demo remains read-only and existing sample reports unchanged.
- [ ] Synthetic full report generation and failed-storage retention tests pass.
- [ ] Pricing, checkout tax and signed payment notifications retain correct behaviour without real charges.
- [ ] Calendly signatures, booking state, email scheduling and reminders pass with isolated fixtures.
- [ ] Mobile layout, video, resources and dashboards pass.
- [ ] Database permissions and TLS certificate verification reviewed before changing RLS.
- [ ] Backup coverage includes database and report objects; isolated restore tested; retention documented.
- [ ] Administrator credential exposure resolved; MFA and recovery confirmed.
- [ ] Rate limits, no-store caching, production errors and security headers tested.
- [ ] Rollback deployment identified; database/config rollback assessed separately.
- [ ] Approved deployment verified live, with no sensitive test writes.

## Automation scope
This initial workflow performs build/type checks and JavaScript/Python dependency audits. It does not yet test full application behaviour, perform a penetration test, fix vulnerabilities, enable repository security settings or configure email alerts. The Python audit resolves requirement ranges rather than proving production's installed package versions. Scheduled runs and Dependabot configuration require default-branch publication; confirm actual executions and notifications before declaring monitoring active. Weekly schedule is Monday 15:45 UTC. Add external uptime and missed-job heartbeat monitoring separately. No automatic merge or deployment.
