# Inspection reporting repair - October 10, 2026

Gary Best Consulting. Job 114266505025 on commit 3e9091518478246bd9a51a9c9978172e1023443b failed in Publish bounded metadata to PR 24 with HttpError: Resource not accessible by integration, as shown in Gary's screenshot. Report JSON existed and was present in the rejected comment request; this was not evidence of a build or evidence-generation failure.

Repair: add pull-requests: write to the isolated javascript-reachability workflow alongside existing issues: write and contents: read, matching the reporting permissions used by other successful PR-reporting jobs. Do not grant contents write, add a personal token, or alter repository-wide settings.

The workflow-file push triggers a new inspection. Repair success remains pending until the job posts its report successfully. If permission is still denied, inspect effective token permissions and policy before making further changes. No application, styling, credential, production database, merge or deployment changes. The separate project knowledge wiki has not been updated by this repository record.
