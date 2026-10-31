-- =====================================================================
-- Annual coaching survey. Additive only: no existing table, policy or
-- function is changed.
--
--   survey_questions    the board's editable question bank
--   survey_cycles       one survey round: dates, audience, reminder
--                       settings, the question snapshot taken when it
--                       opens, and the board-written summary
--   survey_assignments  one row per coach per round: who it went to,
--                       email/reminder bookkeeping, and their answers
--
-- Board members read and write all three tables directly (RLS below).
-- Coaches never touch the tables: they read and save their own survey
-- only through my_open_surveys() and save_my_survey(). The daily send /
-- reminder job runs on the server with the service-role key.
-- Results are board only; no limited role can be granted this view yet.
-- =====================================================================

create table public.survey_questions (
  id          uuid primary key default gen_random_uuid(),
  sort_order  integer not null default 100,
  key         text not null unique check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label       text not null check (char_length(btrim(label)) between 1 and 500),
  help        text not null default '' check (char_length(help) <= 1000),
  kind        text not null check (kind in ('short_text','long_text','yes_no','single_choice','multi_choice','number')),
  options     jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 30),
  required    boolean not null default false,
  -- Only show this question when an earlier question's answer is one of these values: {"key": "...", "values": ["..."]}
  show_if     jsonb check (show_if is null or (jsonb_typeof(show_if) = 'object' and show_if ? 'key' and show_if ? 'values')),
  -- Fill the answer in from the tracker when the coach opens the survey ('team' = their roster team).
  prefill     text check (prefill in ('team')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.survey_cycles (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null check (char_length(btrim(title)) between 1 and 150),
  season_label           text not null check (char_length(btrim(season_label)) between 1 and 40),
  next_season_label      text not null check (char_length(btrim(next_season_label)) between 1 and 40),
  intro                  text not null default '' check (char_length(intro) <= 2000),
  send_on                date not null,
  due_on                 date not null,
  close_on               date,
  audience_teams         text[] not null check (cardinality(audience_teams) >= 1),
  -- Reminder settings. 0 for reminder_every_days turns regular reminders off.
  reminder_every_days    integer not null default 4 check (reminder_every_days between 0 and 30),
  remind_day_before_due  boolean not null default true,
  remind_after_due       boolean not null default true,
  after_due_days         integer not null default 7 check (after_due_days between 0 and 60),
  max_reminders          integer not null default 4 check (max_reminders between 0 and 20),
  status                 text not null default 'scheduled' check (status in ('scheduled','open','closed')),
  -- Copied from the question bank when the round opens, so later edits never change past rounds.
  questions              jsonb check (questions is null or jsonb_typeof(questions) = 'array'),
  summary_themes         text not null default '' check (char_length(summary_themes) <= 20000),
  summary_follow_up      text not null default '' check (char_length(summary_follow_up) <= 20000),
  summary_updated_at     timestamptz,
  summary_updated_by     text,
  is_historical          boolean not null default false,
  opened_at              timestamptz,
  closed_at              timestamptz,
  created_by             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (due_on >= send_on),
  check (close_on is null or close_on >= due_on)
);

create table public.survey_assignments (
  id               uuid primary key default gen_random_uuid(),
  cycle_id         uuid not null references public.survey_cycles(id) on delete cascade,
  coach_id         uuid references public.coaches(id) on delete set null,
  coach_name       text not null check (char_length(coach_name) <= 120),
  coach_email      text not null check (coach_email = lower(coach_email) and char_length(coach_email) <= 254),
  team             text not null default '' check (char_length(team) <= 40),
  -- Tracker details at the time the survey went out: role, pay, certification status.
  profile          jsonb not null default '{}'::jsonb check (octet_length(profile::text) <= 4000),
  answers          jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 100000),
  invited_at       timestamptz,
  invite_failed    boolean not null default false,
  reminders_sent   integer not null default 0,
  last_emailed_on  date,
  started_at       timestamptz,
  submitted_at     timestamptz,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create unique index survey_assignments_cycle_email_key on public.survey_assignments (cycle_id, coach_email);
create index survey_assignments_coach_idx on public.survey_assignments (coach_id);
create index survey_assignments_email_idx on public.survey_assignments (coach_email);
create index survey_cycles_status_idx on public.survey_cycles (status);

alter table public.survey_questions enable row level security;
alter table public.survey_cycles enable row level security;
alter table public.survey_assignments enable row level security;
revoke all on public.survey_questions, public.survey_cycles, public.survey_assignments from anon, authenticated;
grant select, insert, update, delete on public.survey_questions, public.survey_cycles, public.survey_assignments to authenticated;

create policy survey_questions_board on public.survey_questions for all to authenticated
  using ((select private.is_board())) with check ((select private.is_board()));
create policy survey_cycles_board on public.survey_cycles for all to authenticated
  using ((select private.is_board())) with check ((select private.is_board()));
create policy survey_assignments_board on public.survey_assignments for all to authenticated
  using ((select private.is_board())) with check ((select private.is_board()));

-- ---------------------------------------------------------------- coach access
-- The signed-in person's surveys that are open right now (matched by confirmed email).
create or replace function public.my_open_surveys()
returns table (
  assignment_id uuid, cycle_id uuid, title text, season_label text, next_season_label text, intro text,
  due_on date, close_on date, questions jsonb, answers jsonb, profile jsonb, team text, coach_name text,
  submitted_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select a.id, c.id, c.title, c.season_label, c.next_season_label, c.intro, c.due_on, c.close_on,
         coalesce(c.questions, '[]'::jsonb), a.answers, a.profile, a.team, a.coach_name, a.submitted_at, a.updated_at
  from public.survey_assignments a
  join public.survey_cycles c on c.id = a.cycle_id
  where a.coach_email = private.confirmed_email()
    and c.status = 'open'
    and (c.close_on is null or c.close_on >= (now() at time zone 'America/New_York')::date)
  order by c.due_on
$$;

-- Save (and optionally submit) the signed-in person's own answers. Answers stay editable until the round closes.
-- The API route validates answers against the question snapshot before calling this.
create or replace function public.save_my_survey(p_assignment uuid, p_answers jsonb, p_submit boolean default false)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := private.confirmed_email();
  v_row   public.survey_assignments;
  v_cycle public.survey_cycles;
begin
  if v_email is null then
    raise exception 'Please sign in again.' using errcode = 'P0001';
  end if;
  select * into v_row from public.survey_assignments where id = p_assignment for update;
  if not found or v_row.coach_email <> v_email then
    raise exception 'This survey was not sent to you.' using errcode = 'P0001';
  end if;
  select * into v_cycle from public.survey_cycles where id = v_row.cycle_id;
  if v_cycle.status <> 'open' or (v_cycle.close_on is not null and v_cycle.close_on < (now() at time zone 'America/New_York')::date) then
    raise exception 'This survey is closed. Contact the board if you still want to respond.' using errcode = 'P0001';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text) > 100000 then
    raise exception 'Your answers are too long to save.' using errcode = 'P0001';
  end if;
  update public.survey_assignments
     set answers = p_answers,
         started_at = coalesce(started_at, now()),
         submitted_at = case when p_submit then coalesce(submitted_at, now()) else submitted_at end,
         updated_at = now()
   where id = p_assignment
   returning submitted_at into v_row.submitted_at;
  return v_row.submitted_at;
end $$;

revoke all on function public.my_open_surveys(), public.save_my_survey(uuid, jsonb, boolean) from public, anon;
grant execute on function public.my_open_surveys(), public.save_my_survey(uuid, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------- access matrix
-- Listed on the Roles & Access page as board only.
insert into public.app_views (key, label, description, max_level, sort_order) values
  ('coach_surveys', 'Coaching surveys', 'Annual coaching survey answers, summaries and reports. Board only.', 'none', 100)
on conflict (key) do nothing;
insert into public.role_view_access (role_key, view_key, level)
select r.key, 'coach_surveys', 'none' from public.app_roles r
on conflict do nothing;

-- ---------------------------------------------------------------- default questions
insert into public.survey_questions (sort_order, key, label, help, kind, options, required, show_if, prefill) values
  (10,  'teams_coached', 'Team(s) you coached in the {season} season', 'Filled in from your tracker profile. Correct it if it is wrong or incomplete.', 'short_text', '[]', true, null, 'team'),
  (20,  'years_experience', 'Years of lacrosse coaching experience', 'Total years, including outside SVLA.', 'number', '[]', true, null, null),
  (30,  'cert_above_bronze', 'Do you hold a USA Lacrosse coaching certification above Bronze?', 'Your Bronze certification is already tracked in your checklist.', 'single_choice', '["No, Bronze is my highest","Silver","Gold"]', false, null, null),
  (40,  'returning', 'Are you interested in coaching for SVLA in the {next_season} season?', '', 'single_choice', '["Yes","No","Unsure"]', true, null, null),
  (50,  'next_teams', 'Which team(s) would you like to coach?', 'Choose all that apply.', 'multi_choice', '["8U","10U","12U Platinum","12U Silver","14U Platinum","14U Silver","HS JV","HS Varsity","Wherever I''m needed"]', true, '{"key":"returning","values":["Yes","Unsure"]}', null),
  (60,  'not_returning_note', 'Is there anything we should know about your decision?', 'Optional.', 'short_text', '[]', false, '{"key":"returning","values":["No"]}', null),
  (70,  'fall_ball', 'Are you interested in Fall Ball coaching (September–October)?', '', 'yes_no', '[]', true, null, null),
  (80,  'outside_experience', 'Lacrosse coaching experience outside SVLA (programs and dates)', 'Optional.', 'long_text', '[]', false, null, null),
  (90,  'clinics', 'Coaching clinics attended in the last twelve months', 'Optional. Include online courses.', 'long_text', '[]', false, null, null),
  (100, 'did_well', 'What do you think you, as a coach, did well in the {season} season?', '', 'long_text', '[]', true, null, null),
  (110, 'improve', 'What could you have done better in {season}, and how do you plan to address it for {next_season}?', '', 'long_text', '[]', true, null, null),
  (120, 'successes', 'Coaching or team successes in the {season} season', '', 'long_text', '[]', true, null, null),
  (130, 'disappointments', 'Coaching or team disappointments in the {season} season', '', 'long_text', '[]', true, null, null),
  (140, 'support', 'What can SVLA do to assist you in improving as a coach?', '', 'long_text', '[]', true, null, null),
  (150, 'mentor', 'Would you be willing to mentor a newer coach?', '', 'yes_no', '[]', true, null, null),
  (160, 'clinic_interest', 'Would you attend an SVLA coaches'' clinic if one were offered?', '', 'yes_no', '[]', true, null, null),
  (170, 'anything_else', 'Anything else you would like the board to know?', 'Optional.', 'long_text', '[]', false, null, null);
