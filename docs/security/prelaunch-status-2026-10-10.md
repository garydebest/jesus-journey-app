# Prelaunch security status - October 10, 2026

Operator: Gary Best Consulting. Status: work in progress, NOT full security sign-off.

## Verified production changes
- Gary rotated ADMIN_KEY directly in Render and saved the replacement in Apple Passwords. No secret value is recorded here. Gary confirmed the new login succeeds and the old password is rejected.
- Render deployment dep-db50pcjbc2fs73dtlt80 finished 2026-10-10 10:02:10 UTC, serving unchanged production code 80ff2ec1240c255a1a4b1ccfc299919f7784f8ad.
- Gary supplied the non-secret pooled database username postgres.myeazcgoknwuvxdalkza, identifying the postgres backend role. Earlier metadata showed postgres owns all ten application tables and has BYPASSRLS.
- Approved Supabase migration secure_application_table_api_permissions_20261010 succeeded on project myeazcgoknwuvxdalkza around 10:11 UTC. RLS enabled on church_email_events and church_password_resets; all table privileges revoked from anon and authenticated on the ten application tables. No records or report objects changed.
- Post-migration advisor reports ten INFO notices for RLS enabled without policies and no RLS-disabled errors. Deny-by-default is deliberate for server-only access; do not add permissive policies just to clear notices.
- Gary confirmed login and report downloads work after migration. Brief immediate Render error-log check was empty; that is not a complete functional or intrusion test.

## Tested but not yet deployed
- Dependency lockfile repair 63c04d565cffa83be23cf5e3040740e392ea9424 updates nodemailer, proxy-addr, qs and source-map-js without forced upgrades or package.json changes. Build/type checks and password/full/short/mixed retention tests passed in the repair job. Audit decreased from 13 findings including one critical to nine findings: five high and four moderate, no critical.
- Administrator fallback fix 4f271345130f40c2ada0db224848f18b7a600467 rejects absent, blank or known default credentials in production. Build, direct fail-closed assertions and isolated password/session tests passed. It does not implement MFA or login throttling.
- Styling dependency migration deferred at Gary's request. Remaining braces and selector-parser findings are provisionally build-time based on inspected configs; compiled/runtime reachability verification remains outstanding. Do not silently suppress these findings.
- This documentation commit retriggers combined-branch checks. Do not treat historical individual-job checks as a substitute for the current combined revision.

## Still open
- Review PUBLIC/inherited/column privileges and prevent unsafe permissions on newly created tables.
- Privileged-account MFA/recovery, login abuse controls, sensitive caching/security headers and production error handling.
- Live cross-church isolation and all private downloads; full mobile/browser, payment/tax, booking and email regression scope beyond existing synthetic suites.
- Backup coverage for database and report objects, isolated restore, temporary-file and backup retention, comments privacy.
- Monitoring alert destination, external uptime/heartbeat setup, repository security settings and actual scheduled executions. Proposed workflows are not proof that monitoring is active.
- Approved deployment and live checks of the tested code fixes; maintain a rollback path. Do not roll back the rotated credential to the exposed value.

## Records and safety
No passwords, reset tokens or full connection strings belong in project records. Keep report-before-deletion behaviour intact. The SQL proposal file is an archival reference to the applied migration, not an instruction to execute it again. The project knowledge wiki was not updated because its write interface is unavailable in this session; this is the durable repository record.
