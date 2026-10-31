-- Test runs for the coaching survey: a survey can go only to a short list of email addresses
-- (for example the board member checking the emails and form) instead of whole teams.
-- Additive: existing surveys keep their team audience and test_emails stays null.
alter table public.survey_cycles add column if not exists test_emails text[];
alter table public.survey_cycles drop constraint if exists survey_cycles_audience_teams_check;
alter table public.survey_cycles add constraint survey_cycles_audience_check check (
  (test_emails is not null and cardinality(test_emails) between 1 and 10)
  or cardinality(audience_teams) >= 1
);
