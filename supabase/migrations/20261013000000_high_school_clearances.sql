-- High school (Seneca Valley) clearance rules. REVIEW BEFORE APPLYING: this edits live requirement rows.
-- Source: Seneca Valley athletic office email (Oct 13, 2026) and the district Employee Clearance Application directions.

-- 1. Clearance instructions: add the high school path (Act 34 / Act 151 / Act 114).
update public.requirements set definition = definition || jsonb_build_object('help', definition->>'help' || $note$ High school coaches: apply as a Seneca Valley employee (reason: employment, purpose: Employee Governed by Public School Code) and send the certificate to the district, as the Seneca Valley athletic office instructs. New coaches only; clearances on file from last season stay valid for five years of continuous service.$note$)
  where id in ('pa-child-abuse','pa-state-police','fbi-fingerprint');

-- 2. Concussion and cardiac: NFHS courses satisfy both the district and SVLA, so point everyone to NFHS Learn.
update public.requirements set definition = definition || $json${"help": "Take one NFHS Learn concussion course: 'Concussion in Sports' or 'Sport Safety - Play Safely!' (free). It must be retaken every school year. Upload the completion certificate. A printed certificate is not required.", "helpUrl": "https://www.nfhslearn.com/", "helpLinkLabel": "NFHS Learn (search Concussion in Sports)"}$json$::jsonb
  where id = 'concussion';
update public.requirements set definition = definition || $json${"help": "Take one NFHS Learn cardiac course: 'Sudden Cardiac Arrest' or 'Sport Safety - Play Safely!' (free). It must be retaken every school year. Upload the completion certificate. A printed certificate is not required.", "helpUrl": "https://www.nfhslearn.com/courses/sudden-cardiac-arrest", "helpLinkLabel": "NFHS Learn courses"}$json$::jsonb
  where id = 'sudden-cardiac';

-- 3. New high school requirement: head coach attends a PIAA Rules Interpretation Meeting (District 7).
insert into public.requirements (id, sort_order, definition) values
  ('piaa-rules-meeting', 11, $json${"name": "PIAA Rules Interpretation Meeting", "type": "File", "appliesToRoles": ["Head Coach"], "appliesToPay": ["Paid", "Volunteer"], "validity": {"kind": "school-year"}, "required": true, "active": true, "dateOnlyAllowed": true, "level": "high-school", "why": "PIAA requires each high school head coach to attend a rules interpretation meeting every year so games are coached to the current rules.", "source": "PIAA, through the Seneca Valley athletic office. Seneca Valley is in District 7.", "sourceUrl": "https://www.piaa.org/", "help": "Find a District 7 meeting on the PIAA website (Rules Meetings), attend, and upload proof of attendance or enter the date you attended.", "helpUrl": "https://www.piaa.org/", "helpLinkLabel": "PIAA rules meetings"}$json$::jsonb)
on conflict (id) do nothing;
