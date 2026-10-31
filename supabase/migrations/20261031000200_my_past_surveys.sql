-- Coaches can read (never change) their own answers to past surveys: closed or imported rounds, not test runs.
-- Matched to the signed-in person by confirmed email, either on the survey record itself or through the
-- roster coach it is linked to (so an imported survey answered from a different address still shows).
create or replace function public.my_past_surveys()
returns table (
  assignment_id uuid, title text, season_label text, next_season_label text,
  questions jsonb, answers jsonb, team text, submitted_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select a.id, c.title, c.season_label, c.next_season_label, coalesce(c.questions, '[]'::jsonb), a.answers, a.team, a.submitted_at
  from public.survey_assignments a
  join public.survey_cycles c on c.id = a.cycle_id
  where a.submitted_at is not null
    and c.test_emails is null
    and (c.status = 'closed' or c.is_historical)
    and (
      a.coach_email = private.confirmed_email()
      or a.coach_id in (select co.id from public.coaches co where lower(co.email) = private.confirmed_email())
    )
  order by c.send_on desc
$$;
revoke all on function public.my_past_surveys() from public, anon;
grant execute on function public.my_past_surveys() to authenticated;
