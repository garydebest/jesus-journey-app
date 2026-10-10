# Database permissions verification - October 10, 2026

Operator: Gary Best Consulting. Project: myeazcgoknwuvxdalkza. This is a repository knowledge record, not full security sign-off or a claim that the separate project wiki was updated.

## Completed
- Read-only effective-permission checks covered all ten application tables and the anon, authenticated and postgres roles. All ten tables have RLS enabled. anon/authenticated have no checked SELECT, INSERT, UPDATE or DELETE access, including column-level SELECT/INSERT/UPDATE. These effective checks account for inherited and PUBLIC permissions for these roles. postgres retains the checked backend permissions.
- Approved migration secure_future_application_object_defaults_20261010 succeeded. It revoked all default table and sequence grants to anon/authenticated for objects created by postgres in public. It changed no existing objects, records, report files, credentials or deployment.
- Post-migration verification returned no remaining postgres default table/sequence grants to anon/authenticated or PUBLIC, considering public-schema and global defaults. Existing-table checks remained unchanged.
- Combined-branch GitHub checks on 7e1f922a0e2897fd1fb520823073402594e750e1 completed: build, Python audit and password/full/short/mixed regressions passed. JavaScript audit failed with nine reported package findings (five high, four moderate) in the remaining styling dependency chain. Do not mark the audit cleared or the fixes deployed.

## Remaining scope
- supabase_admin object defaults and postgres function defaults were observed but not changed; review actual application and platform use before modifying them.
- Existing sequence grants and callable functions, especially SECURITY DEFINER functions, have not been verified.
- New tables still require explicit RLS and an intentional access model; removing default grants does not enable RLS automatically.
- Backend postgres has privileged access; application authorization and live cross-church isolation remain essential and unverified by these metadata checks.
- No live functional check was performed after this defaults-only migration. Gary previously confirmed login/report downloads after the earlier existing-table migration.
- No application deployment, MFA, throttling, backup restore, monitoring activation or broad security sign-off occurred in this batch.

## Applied SQL
```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
COMMIT;
```

This SQL is an applied-migration record, not an instruction to rerun it. Any rollback needs separately approved exact grants; do not automatically restore broad public-facing permissions.
