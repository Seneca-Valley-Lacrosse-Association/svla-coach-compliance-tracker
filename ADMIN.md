# SVLA Coach Compliance Tracker: Administrator Guide

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
- **Add a coach:** Coaches, then Add coach. The coach then creates an account with that same email address.
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

## Coach self-registration

After a coach confirms their email, they fill in their own profile (name, phone, team, role, and whether they have lived in PA for 10 years). This creates their roster record automatically, always as **Volunteer**. The board then opens the coach and uses **Edit coach** to set **Paid** where it applies; fingerprint requirements then apply to them. Anyone with a confirmed account can create a roster record this way, so review new names on the Coaches page. Board accounts skip this step.
