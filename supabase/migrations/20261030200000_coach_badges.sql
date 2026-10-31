-- Coach badges: every coach gets a private random token that goes in the badge QR code.
-- The public verify page looks a coach up by token only. It never takes a coach id or a name.

alter table public.coaches add column if not exists verify_token text;
update public.coaches
  set verify_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
  where verify_token is null;
alter table public.coaches alter column verify_token set default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
alter table public.coaches alter column verify_token set not null;
create unique index if not exists coaches_verify_token_key on public.coaches (verify_token);

-- Board only: issue a new token for a lost badge. The old QR code stops working immediately.
create or replace function public.reissue_badge_token(p_coach_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_board() then raise exception 'Board access is required.' using errcode = 'P0001'; end if;
  update public.coaches
    set verify_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    where id = p_coach_id;
  if not found then raise exception 'Coach not found.' using errcode = 'P0001'; end if;
end $$;
revoke all on function public.reissue_badge_token(uuid) from public, anon;
grant execute on function public.reissue_badge_token(uuid) to authenticated;

-- Public: what the badge QR code shows. Returns only the fields needed to work out clearance status
-- (no email, phone, documents, notes or review comments). Null for an unknown token or an inactive coach.
create or replace function public.verify_badge(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c public.coaches;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 then return null; end if;
  select * into c from public.coaches x
    where x.verify_token = p_token and x.status = 'approved' and x.archived_at is null;
  if not found then return null; end if;
  return jsonb_build_object(
    'coach', jsonb_build_object('name', c.name, 'team', c.team, 'role', c.role, 'pay', c.pay,
      'paResident10Years', c.pa_resident_10_years, 'alsoCoachesYouth', c.also_coaches_youth),
    'requirements', (select coalesce(jsonb_agg(r.definition || jsonb_build_object('id', r.id, 'order', r.sort_order) order by r.sort_order), '[]'::jsonb)
                     from public.requirements r),
    'submissions', (select coalesce(jsonb_agg(jsonb_build_object(
        'requirementId', s.requirement_id, 'status', s.status,
        'uploadedOn', s.uploaded_at, 'completedOn', s.completed_on, 'expiresOn', s.expires_on,
        'obtainedAs', s.details->>'obtainedAs', 'fbiMethod', s.details->>'fbiMethod',
        'membershipNumber', s.details->>'membershipNumber')), '[]'::jsonb)
                    from public.submissions s where s.coach_id = c.id)
  );
end $$;
revoke all on function public.verify_badge(text) from public;
grant execute on function public.verify_badge(text) to anon, authenticated;
