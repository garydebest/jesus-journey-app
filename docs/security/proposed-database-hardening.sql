-- REVIEW ONLY: do not execute until the Render database role is verified.
-- No record deletion. PostgreSQL owners and BYPASSRLS roles retain their access.
-- Application access must be verified before and after application.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.church_email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_password_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE
  public.churches, public.survey_waves, public.survey_timeline_phases,
  public.respondents, public.responses, public.aggregate_snapshots,
  public.legacy_snapshots, public.debriefing_reports,
  public.church_email_events, public.church_password_resets
FROM anon, authenticated;
COMMIT;
-- Follow-up: inspect effective PUBLIC/inherited/column permissions, verify API
-- denial and legitimate backend flows, and prevent unsafe grants on new tables.
