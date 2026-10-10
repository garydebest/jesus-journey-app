# Monitoring and release status - October 10, 2026 (afternoon)

Operator: Gary Best Consulting. Status: release-ready pending Gary's approval; NOT full security sign-off.

## Verified this batch (read-only)
- PR #24 head acab793: build, type check, password/full/short/mixed regressions and Python audit pass. The only failing job was the JavaScript audit, caused solely by the nine reviewed styling-chain findings (two advisories: GHSA-vfj7-8cjw-p6xm high, GHSA-rj75-hqrm-r3gf moderate).
- Render service srv-dabh33ajnfac73an7s70: no Node "NODE_TLS_REJECT_UNAUTHORIZED ... insecure" warning and no certificate errors in app logs from 2026-09-12 to now. Gary previously confirmed DATABASE_URL has no URL options. Together these indicate nothing on Render would disable the new certificate check. Variable names could not be listed directly (no Render API key saved; connector has no env-list tool).
- Supabase project myeazcgoknwuvxdalkza: ACTIVE_HEALTHY; security advisor shows only the ten deliberate "RLS enabled, no policy" INFO notices. Organization plan is Free.
- GitHub repo is public; Dependabot alerts/updates, secret scanning and push protection are all disabled; master is unprotected.

## Changed on the branch
- script/audit-gate.mjs replaces `npm audit --audit-level=high` in the weekly/PR workflow. It prints every advisory but fails only on new high/critical ones, so scheduled failures mean something new. Negative test (removing a reviewed ID) fails as expected. Reviewed list must be re-reviewed by 2027-01-10.

## Awaiting Gary's approval
1. Merge PR #24 to master and start a manual Render deploy (auto-deploy cannot reach GitHub). Rollback: redeploy 80ff2ec. Post-deploy: app loads, login works, report download works, no TLS errors in logs.
2. Enable Dependabot alerts, Dependabot security updates, secret scanning and push protection (free for public repos; reversible).
Merging activates the Monday 15:45 UTC security workflow and Dependabot schedule; GitHub emails failures to the account that last changed the schedule.

## Known gaps after release
- Backups: Free plan has no automatic Supabase backups, and Supabase backups never include Storage objects (church-reports). Needs Pro plan or a scheduled off-site export of database and report bucket, plus a restore test.
- MFA/recovery for admin and provider accounts, login rate limiting, live cross-church download isolation tests, external uptime/heartbeat monitor, styling dependency migration.
