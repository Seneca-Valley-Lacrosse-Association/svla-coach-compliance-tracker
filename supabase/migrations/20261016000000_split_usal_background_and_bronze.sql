-- Split "USA Lacrosse Background Screen & Bronze Certification" into two requirements.
--   usal-background : USA Lacrosse Background Screen, renewed every 2 years
--   usal-bronze     : USA Lacrosse Bronze Certification, completed once, never expires
-- Both stay youth-only for now (WPYLA League Rules, section 6), same as the combined requirement was.
--
-- Existing data: the combined requirement meant a coach had done both. Existing usal-bronze submissions are moved to
-- usal-background (keeping the certificate file, review status and 2-year expiry), and a date-only Bronze record
-- (no file, no expiry) is created for each of those coaches so nobody shows as newly non-compliant.
-- Idempotent: if usal-background already exists, nothing is changed.

do $$
begin
  if exists (select 1 from public.requirements where id = 'usal-background') then
    return;
  end if;

  -- Make room so the two requirements sit side by side (background screen, then Bronze).
  update public.requirements set sort_order = sort_order + 1 where sort_order >= 5;

  insert into public.requirements (id, sort_order, definition) values
    ('usal-background', 5, $json${
      "name": "USA Lacrosse Background Screen",
      "type": "File",
      "level": "youth",
      "active": true,
      "required": true,
      "validity": {"kind": "years", "years": 2},
      "appliesToPay": ["Paid", "Volunteer"],
      "appliesToRoles": ["Head Coach", "Coordinator", "Assistant Coach", "Volunteer Assistant"],
      "dateOnlyAllowed": true,
      "why": "WPYLA requires every youth coach to pass the USA Lacrosse background screen. It is separate from the Pennsylvania clearances and does not replace them. It must be renewed every 2 years.",
      "source": "WPYLA League Rules, section 6 (Coaches Rosters). Not required for high school coaches.",
      "help": "Log in to your USA Lacrosse account, add Coach as your involvement on your profile, and complete the background screen. It must be renewed every 2 years. Upload the confirmation and enter the completion date.",
      "helpUrl": "https://www.usalacrosse.com/coaches",
      "helpLinkLabel": "USA Lacrosse coaching"
    }$json$::jsonb);

  update public.requirements set sort_order = 6, definition = $json${
      "name": "USA Lacrosse Bronze Certification",
      "type": "File",
      "level": "youth",
      "active": true,
      "required": true,
      "validity": {"kind": "one-time"},
      "appliesToPay": ["Paid", "Volunteer"],
      "appliesToRoles": ["Head Coach", "Coordinator", "Assistant Coach", "Volunteer Assistant"],
      "dateOnlyAllowed": true,
      "why": "WPYLA requires every youth coach to complete USA Lacrosse training, and each team must have at least one Bronze-certified coach to be eligible to play. Bronze is the USA Lacrosse baseline training, including abuse prevention, concussion and cardiac care. You complete it once and it does not expire.",
      "source": "WPYLA League Rules, section 6 (Coaches Rosters). Not required for high school coaches.",
      "help": "Log in to your USA Lacrosse account and complete the free Bronze level online course. Bronze does not expire, so you only do it once. Upload the certificate or enter the completion date.",
      "helpUrl": "https://www.usalacrosse.com/coaches",
      "helpLinkLabel": "USA Lacrosse coaching"
    }$json$::jsonb
  where id = 'usal-bronze';

  -- Carry existing records over. The triggers are switched off only inside this transaction so the copied rows keep
  -- their original review status and the update is allowed to change requirement_id.
  alter table public.submissions disable trigger submissions_before_insert;
  alter table public.submissions disable trigger submissions_before_update;

  -- Bronze: one date-only record per coach, from their most recent combined submission (no file, no expiry).
  insert into public.submissions
    (coach_id, requirement_id, status, uploaded_at, completed_on, expires_on, file_path, file_name, details,
     review_comment, reviewed_on, submitted_by, reviewed_by)
  select distinct on (coach_id)
    coach_id, 'usal-bronze', status, uploaded_at, completed_on, null, null, null, '{}'::jsonb,
    review_comment, reviewed_on, submitted_by, reviewed_by
  from public.submissions
  where requirement_id = 'usal-bronze'
  order by coach_id, completed_on desc, created_at desc;

  -- Background screen: move the original rows (certificate files and 2-year expiry stay as they were). The new
  -- Bronze records above have no expiry, so the expiry date tells the two groups apart.
  update public.submissions
  set requirement_id = 'usal-background'
  where requirement_id = 'usal-bronze' and expires_on is not null;

  alter table public.submissions enable trigger submissions_before_insert;
  alter table public.submissions enable trigger submissions_before_update;
end $$;
