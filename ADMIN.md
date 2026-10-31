# SVLA Compliance Tracker: Administrator Guide

Written so a new SVLA board member or volunteer can keep this running without the person who built it.
Contains no passwords. Account owners are listed so you know whom to ask or which account to recover.

## What it is
A private web app where coaches upload clearances and certifications and the board reviews them.
Live at **https://compliance.svlacrosse.org**.

| Piece | Where | What it does |
|---|---|---|
| Website code | GitHub: `Seneca-Valley-Lacrosse-Association/svla-coach-compliance-tracker` | The app. Every change merged to `main` deploys automatically. |
| Hosting | Vercel, team **SVLA**, project `svla-coach-compliance-tracker` | Runs the site. |
| Database + sign-in + files | Supabase project `supabase-svla-database` (created through Vercel) | Coach records, logins, uploaded certificates. |
| Web address | Cloudflare DNS for svlacrosse.org | `compliance` CNAME points to Vercel. |

## Keeping access alive (most important)
Everything is registered under the shared mailbox **it@svlacrosse.org**. Make sure at least **two board members** can
read that mailbox, and that at least two people are **owners** on each of: the GitHub organization, the Vercel team,
the Cloudflare account, and the Supabase organization (opened from Vercel, then Storage). If only one person has
access to any of these, add a second owner now.

## Getting the data out (anytime)
1. Sign in as a board member and open **Reports**.
2. Click **Download full export (Excel)**.
3. The workbook has these sheets: Coaches, Compliance Matrix, Submissions (full history with review decisions), and Requirements.

Do this at least once per season and store the file somewhere secure (it holds personal information).

Uploaded certificate files are not inside the Excel file. Each Submissions row links to its file while the app runs.
To keep copies of the files themselves, open Supabase, then Storage, then the **certificates** bucket, and download the
folders (one folder per coach). If the app is ever shut down, the files remain in that bucket.

## Everyday tasks
- **Add a coach:** Coaches, then Add coach. The coach then creates an account with that same email address, or you send them an invite (see below).
- **Add a board member (admin):** sign in as a board member, open **Board Access**, enter their email, and click Add.
  They then create an account on the sign-in page with that exact email and confirm it. They get board access automatically.
- **Remove a board member:** Board Access, then Remove next to their email. You cannot remove yourself, so the board is never left empty.
- **If nobody has board access (emergency):** in Supabase, SQL Editor, run (lowercase email):
  `insert into public.board_members (email) values ('name@example.org');`
- **A user forgot their password:** on the sign-in page they click **Forgot your password?**, enter their email, and open the link
  that arrives (in the same browser). It takes them to a page to choose a new password. Links expire after one hour.
- **Change a requirement or its link:** Requirements page (board only).
- **Set the Handbook link:** Requirements, Coach Handbook Acknowledgment, add the https link. Coaches cannot sign until it is set.

## If the person who built it is gone
- You do not need anyone to keep it running. Vercel and Supabase run on their own.
- Costs: both are on free plans at this size. Check the Vercel and Supabase billing pages once a year.
- To change how the app looks or works, a developer (or an AI coding assistant) can work from the GitHub repo.
  The `supabase/migrations` folder rebuilds the entire database from scratch.

## Rebuilding from scratch (disaster recovery)
1. Create a new Supabase project. Run the files in `supabase/migrations` in filename order in the SQL Editor.
2. Create a Vercel project from the GitHub repo and connect the new Supabase project.
3. Point `compliance.svlacrosse.org` at it (Vercel, then Settings, then Domains, then follow the DNS instructions).
4. Re-import coaches from the latest Excel export (Coaches sheet) using Add coach. Submission history cannot be re-imported
   automatically, so keep the Excel export and the certificates bucket download as your record.

## Email templates (Supabase)
Emails link to this app's own confirmation page so they work in any browser. In Supabase, Authentication, then Emails, set:
- **Reset Password** link: `https://compliance.svlacrosse.org/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
- **Confirm signup** link: `https://compliance.svlacrosse.org/auth/confirm?token_hash={{ .TokenHash }}&type=email`
Keep the sender as no-reply@mail.svlacrosse.org (Resend SMTP). If the domain ever changes, update these links.

## Security notes
- Anyone can create an account, but an account sees nothing unless its confirmed email is a board member or is on the coach roster.
- Never share the Supabase service-role key or database password. They are stored as Sensitive variables in Vercel.
- Remove board members who leave (see above) and rotate access on the shared mailbox when people change.

## Editing coaches and finding new sign-ups

- **Change a coach's team, role, pay status, name, phone or PA-resident flag:** open the coach from the Coaches page and use **Edit coach**. The email can't be changed (it is how the account is matched). Changing role or pay status re-evaluates which requirements apply.
- **Someone signed up but isn't on the roster:** the Coaches page shows a "Signed up, not on the roster" list (confirmed accounts only). Click **Add to roster** to set their team and role. Until then they see nothing in the app.

## Coach sign-up and board approval

After a coach confirms their email, they fill in their own profile (name, phone, team, role, and whether they have lived in PA for 10 years) and then see a "Waiting for board approval" screen. They have no access to a checklist until approved.

The board sees them under **Awaiting approval** on the Coaches page (and a banner on the Dashboard). For each person, choose **Paid** or **Volunteer** and click **Approve**; the coach is emailed that they can log in. Paid coaches must provide fingerprints. **Decline** moves them to a Declined list, where you can **Approve** later or **Delete** them manually (this also removes their sign-in account).

The approval email is sent through Resend and needs the `RESEND_API_KEY` environment variable on the Vercel project (optional `EMAIL_FROM`, default `SVLA Compliance <no-reply@mail.svlacrosse.org>`). Without the key, approval still works but no email is sent and the board is told to let the coach know.

## Deleting a coach

Open the coach's page and click **Delete coach** (board only). This permanently removes the roster record, all submissions, and the uploaded files. Export from Reports first if a copy is needed. The person's sign-in account stays; if they sign in again they are asked to complete a new profile.

## Coach logins and invites

Every coach has a **Login** status on the Coaches page: **No login** (nothing sent), **Invited** (email sent, account not set up yet) or **Active** (has an account). The header shows the totals, and the **Login** filter lists who still needs a nudge. A coach without a login is still fully tracked: the board can enter and approve their records.

- **Invite one coach:** open the coach, then **Portal access**, then **Send invite** (or **Resend invite**). They get an email with a one-time link to set a password.
- **Invite everyone at once:** on the Coaches page click **Invite all without a login** and confirm.
- **Email did not arrive:** on the coach's page click **Copy sign-in link** and send it to them yourself (text or in person). The link works once and expires, and anyone holding it can sign in as that coach, so share it privately. You never see or set their password.
- **Change password:** anyone signed in can use **Change password** in the top bar. If they forget it, **Forgot your password?** on the sign-in page still works.
- **The email must match the roster.** A login is linked to a coach by email address, so an invite only goes to the email on the roster. If a coach prefers another address, remove them and add them again with the right one before inviting.

Needs these on the Vercel project: `SUPABASE_SERVICE_ROLE_KEY` (already set, used only to create sign-in links after checking the user is on the board) and `RESEND_API_KEY` (to send the email). Without the Resend key, invites still create the link but the email is not sent, and the screen shows the link to copy instead.

## Help requests (the "Need help?" button)

Every signed-in person has a **Need help?** button in the top bar, a **Question about this?** link beside checklist items that are missing, pending, rejected or expired, and a "Still stuck? Email it@svlacrosse.org" line at the bottom of every page (and on the sign-in page, in case the form itself is what is broken). Choosing a topic and describing the problem sends a ticket:

- It is saved with an ID like **SVLA-0001** and emailed to **it@svlacrosse.org** (reply-to is the coach, so replying answers them directly). The coach gets a confirmation email with the ID.
- **Board members: Help Requests** in the left menu lists every ticket, unresolved first. Set the status to **Open**, **In progress** or **Resolved**, and add an internal note (coaches never see notes).
- **Bug / Issue** is internal. Choose it when the problem is a real defect in the app: it emails IT once with the description and page details (but not the coach's name or email). The coach keeps seeing the ticket as "In Progress".
- Tickets hold names and clearance questions. Do not share them outside the board, and do not ask coaches to put Social Security numbers or documents in a ticket.
- The ticket table is tiny (about 1 to 2 KB per ticket). Nothing needs to be cleaned up.
- Uses the same `RESEND_API_KEY` as the other emails. If the key is missing, tickets still save, and the person is told to email IT directly.

**Where tickets go:** the `ticket_routing` table maps each topic to an email address. Today every topic and the bug alert go to it@svlacrosse.org. When a clearance coordinator is added, run (in the Supabase SQL Editor) for the topics you want re-routed:
`update public.ticket_routing set route_to = 'coordinator@example.org' where route_key in ('clearance_status','upload');`
(Backlog: an admin screen to manage this instead of SQL.)

## Roles & access (view-only roles for coaches who supervise others)

The board sees everything. **Roles & Access** in the left menu lets the board give a coach a limited, read-only role without making them a board member.

- **Roles today:** Program Lead (for example the high school head coach) and Age-Group Coordinator. Both see only the teams you assign.
- **What a role can see:** status and expiration dates for the coaches on their teams, plus (if you switch it on) contact info and paid/volunteer status. Uploaded documents, certificate numbers, review comments, tickets and account details are board-only and cannot be delegated.
- **Give someone a role:** Roles & Access, "Give someone a role": choose the coach's email, the role, and the teams they supervise, then Add role. They sign in as usual and see a **Team Compliance** page next to My Checklist.
- **Change what a role sees:** use the dropdowns in the "What each role can see" grid. Changes apply the next time that person loads the app.
- **Take a role away:** Roles & Access, "People with a role", Remove. They go back to seeing only their own record.
- **Preview as someone (check a role works):** Roles & Access, "Preview as" next to a person, or "Preview as someone" to pick any coach. You see exactly what that person would see, under an amber banner that says whose view it is. It is read-only: you stay signed in as yourself and nothing changes. Click **Exit preview** in the banner to leave. Each preview start is logged as `preview_start` in `access_audit`. Their own checklist is not part of the preview.
- **Audit trail:** every change is written to the `access_audit` table (who, when, what).
- **How it is enforced:** in the database, not just the menu. Limited roles have no direct access to the coach, submission or file tables. They read through the `staff_roster()` and `staff_compliance_status()` functions, which filter by team and by the views granted. Preview uses board-only `preview_*` functions that run the same code for another email, so the preview cannot drift from the real thing.
- **Emergency:** if the grid ever locks someone out, board members are unaffected (board access does not depend on roles). To remove a role manually: `delete from public.staff_access where email = 'name@example.org';`

## Archiving, deleting, and correcting dates

- **Archive a coach:** open the coach, choose "Archive or delete", then "Archive coach". The record is hidden from the roster and dashboard and their login stops working, but every submission and file is kept. Use "Show archived coaches" on the Coaches page to find them, then "Restore or delete" > "Restore coach".
- **Permanently delete:** a second option in the same dialog. It warns that all files will be deleted and offers a ZIP backup of the coach's files and the full Excel export first. You must type the coach's name to confirm.
- **Correct a date:** on a coach's checklist, a board member can choose "Edit dates". The expiration is recalculated from the requirement's rules, and each correction is logged (who, when, old and new dates, reason). The log appears under "Date corrections" and in the Excel export.

## Keeping the free Supabase project awake

`vercel.json` runs `/api/keepalive` every 5 days. It makes a small read against the database using the `CRON_SECRET` environment variable (Vercel > Settings > Environment Variables). If the secret is rotated, Vercel picks up the new value on the next deployment. A paid Supabase plan makes this unnecessary.

## Annual coaching survey (Coach Surveys page)

Replaces the Grasshopper coaching survey. Board only: no other role can see answers.

- **Questions tab:** the question bank. Add, reword, reorder, hide or delete questions; choose the answer type,
  whether it is required, and whether it only appears after a particular earlier answer. `{season}` and
  `{next_season}` in a question are filled in from each survey's season labels. Name, email, team, role and
  USA Lacrosse Bronze status come from the tracker, so coaches are not asked for them.
- **Schedule a survey:** pick the send date, due date, optional "stop accepting" date, the teams it goes to and the
  reminder settings. The dialog lists exactly which emails a coach who never responds would receive.
- **What happens automatically:** a daily job (`/api/cron/surveys`, Vercel cron about 9:20 a.m. Eastern) opens the
  survey on its send date, copies the current question bank into it (later edits never change a sent survey),
  emails everyone, sends reminders to people who have not submitted, adds coaches who join the roster while it is
  open, and closes it after the "stop accepting" date. Nobody gets more than one survey email a day.
- **Send now / Send reminder now** do the same thing immediately for one survey.
- **Board summary tab:** write "What coaches told us" and "Items for follow-up". `- ` starts a bullet and
  `**text**` is bold. Both sections print in the PDF report.
- **Exports:** "Board report (PDF)" is the formatted summary for board meetings; "Excel" has every answer.
- Tables: `survey_questions`, `survey_cycles`, `survey_assignments` (migration `20261031000000_coach_surveys.sql`).
  Coaches only reach their own survey through `my_open_surveys()` and `save_my_survey()`.
- The PDF fonts in `public/fonts` are Lato and Noto Serif (SIL Open Font License).
