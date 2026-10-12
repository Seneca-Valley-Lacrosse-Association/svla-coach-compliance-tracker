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
- **Add a board member:** in Supabase, SQL Editor, run (lowercase email):
  `insert into public.board_members (email) values ('name@example.org');`
- **Remove a board member:** `delete from public.board_members where email = 'name@example.org';`
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

## Security notes
- Anyone can create an account, but an account sees nothing unless its confirmed email is a board member or is on the coach roster.
- Never share the Supabase service-role key or database password. They are stored as Sensitive variables in Vercel.
- Remove board members who leave (see above) and rotate access on the shared mailbox when people change.
