# Supabase database

Migrations in `migrations/` are applied in filename order and already applied to the `supabase-svla-database`
project. They create the tables, Row Level Security policies, the private `certificates` storage bucket, the
default requirements, and the first board member (`it@svlacrosse.org`).

## Access model
- Only signed-in users with a **confirmed** email can read anything. Anonymous visitors get nothing.
- Board members (rows in `board_members`) see and manage everything.
- A coach sees only their own roster row and submissions, matched by confirmed email.
- Submissions are validated and expiry dates are computed in the database, not trusted from the browser.

## Add a board member
```sql
insert into public.board_members (email) values ('name@example.org');  -- lowercase
```

## Add a coach
Use the app's "Add coach" screen as a board member. The coach then signs up with that same email.

## Help requests
`tickets` and `ticket_routing` are closed to the browser (RLS on, no policies). The app reaches them only through the
functions `submit_ticket`, `my_tickets`, `admin_tickets`, `admin_open_ticket_count` and `admin_update_ticket`, which check
who is calling. Coaches see only their own tickets; the internal `bug_issue` status is shown to them as In Progress.

## In-progress tracking
`progress` holds "I have started this" markers (start date, optional follow-up date, optional short note). It is
read-only from the browser (coach sees their own, board sees all); writes go through `mark_in_progress` and
`clear_in_progress`, which allow the coach or any board member. A marker never counts toward "Cleared to Coach" and
is removed automatically when a document is submitted for that requirement. Do not put clearance numbers in notes.
Migration: `20261015000600_in_progress.sql` (additive; no existing data is changed).
