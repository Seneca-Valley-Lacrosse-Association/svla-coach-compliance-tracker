alter table public.coaches drop constraint if exists coaches_team_check;
alter table public.coaches add constraint coaches_team_check
  check (team in ('8U','10U','12U','14U','HS-JV','HS-Varsity','Board','Volunteer'));
