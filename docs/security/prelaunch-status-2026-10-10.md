# Prelaunch security status

Gary requested leaving styling dependencies unchanged and prioritizing database and administrator protections.

This batch prepares production-only rejection of absent/blank/default administrator keys and tests before committing to the isolated security branch. Existing configured keys are not changed. It does NOT rotate the previously documented credential, add MFA, rate-limit login, or deploy.

The SQL file is REVIEW ONLY. Render's database role is unverified; table ownership does not identify it. Do not apply the migration based on an assumption. Inspect PUBLIC, inherited and column grants too. Save rollback grants and verify backend access before executing any approved migration.

Open release blockers: verify administrator credential rotation and recovery; privileged-account MFA; database backend identity and permission repair; login abuse controls; sensitive caching/security headers; deployed cross-church/download tests; backup and retention verification; alert/monitoring activation. Existing isolated regressions do not constitute full browser, live payment or penetration testing.

No production deployment or database write is authorized by this branch-only batch. Keep report-before-deletion behaviour intact. Record consequential changes in the project knowledge wiki when its write interface is available; this repository note does not claim the wiki was updated.
