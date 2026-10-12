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
