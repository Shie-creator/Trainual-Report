# Trainual Completion Dashboard

Production-ready internal dashboard for Nao Medical to track Trainual completion by employee and by manager using real uploaded data stored in Supabase.

## Stack

- Next.js 16 App Router with TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Postgres
- Supabase Storage for original uploaded files
- Recharts for interactive analytics
- Vercel-ready deployment structure

## What this app does

- Authenticated users can log in with Supabase email magic links.
- Admin users can upload:
  - a Trainual completion CSV
  - a manager mapping CSV
- Imports are validated, previewed, mapped, normalized, stored, and logged.
- Dashboard data is loaded live from Supabase.
- KPI cards, filters, charts, and the employee table stay in sync.
- Clicking a manager bar filters the dashboard.
- Manager detail pages show team-specific performance.
- Filtered employee results can be exported to CSV.
- When there is no imported data, the app shows empty states instead of demo records.

## Project location

This app lives in:

`/Users/shie/Documents/Trainual Report/trainual-completion-dashboard`

## Local setup

1. Install Node.js 20+.
2. Copy `.env.local.example` to `.env.local`.
3. Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL`
4. Install dependencies:

```bash
npm install
```

5. Run the app:

```bash
npm run dev
```

6. Run checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Environment variables

See [.env.local.example](/Users/shie/Documents/Trainual Report/trainual-completion-dashboard/.env.local.example).

Required values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Example local site URL:

- `http://localhost:3000`

Example Vercel site URL:

- `https://your-project.vercel.app`

## Supabase setup

1. Create a new Supabase project.
2. Open SQL Editor.
3. Run the migration in [202604020001_initial_schema.sql](/Users/shie/Documents/Trainual Report/trainual-completion-dashboard/supabase/migrations/202604020001_initial_schema.sql).
4. In Authentication:
   - enable Email auth
   - keep magic link / OTP email sign-in enabled
5. Add your app URL and local URL to the Supabase redirect allow list:
   - `http://localhost:3000/auth/callback`
   - `https://your-vercel-domain/auth/callback`

## Database model

Tables:

- `managers`
- `employees`
- `trainual_completions`
- `imports`
- `profiles`

Relationships:

- `employees.manager_id -> managers.id`
- `trainual_completions.employee_id -> employees.id`
- `profiles.id -> auth.users.id`

Storage:

- bucket: `trainual-imports`

## Auth setup

The login page sends a Supabase magic link to the user’s email address.

On first successful login:

- the app creates a `profiles` row with role `member`

## Admin role setup

To grant import access, update the user’s profile role in Supabase:

```sql
update public.profiles
set role = 'admin'
where id = 'AUTH_USER_UUID';
```

Only admin users can:

- access `/admin/imports`
- upload raw files to Supabase Storage
- write imported data into tables

Authenticated users can:

- log in
- read dashboard data

## Row Level Security

RLS is enabled in the migration.

Policies included:

- authenticated users can read dashboard tables
- users can read their own profile
- admins can write managers, employees, completions, imports
- admins can upload and read files in the `trainual-imports` bucket

## Import flow

Page:

- `/admin/imports`

Flow:

1. Admin uploads the Trainual completion CSV and manager mapping CSV.
2. The client parses each file locally for preview.
3. The admin reviews suggested column mappings.
4. The app validates required columns and duplicate keys.
5. On confirm:
   - original files are uploaded to Supabase Storage
   - managers are upserted
   - employees are inserted or updated
   - completion snapshots are upserted by `employee_id + snapshot_date`
   - import log rows are created
6. Dashboard pages update from the stored Supabase data.

## Expected file formats

### Completion CSV

The current import supports flexible header mapping for fields such as:

- employee name
- employee email
- employee external ID
- job title
- completion percentage
- completed modules
- total modules
- remaining modules
- snapshot date
- manager name
- department

Observed Trainual file used during implementation:

- `Name`
- `Email`
- `Job title`
- `Completion score`
- `Groups`
- `Reports to`
- `Birthday`
- `Start date`
- `Last active`

### Manager mapping CSV

The current manager report parser handles the grouped HR export format used in:

- `EmployeeInformation-ActiveEmployeesperManager_1775059397419.csv`

It flattens the grouped manager report into preview rows with:

- employee name
- role
- status
- employment length
- hourly pay
- pay type
- employee EIN
- manager name

It also supports flexible mapping from those flattened headers to canonical fields.

## Matching assumptions

Employee matching uses this order:

1. `employee_external_id`
2. `employee_email`
3. normalized `employee_name`

Manager matching uses this order:

1. `manager_email`
2. normalized `manager_name`

Assumptions made for the uploaded files you provided:

- the completion CSV does not include module counts in the current sample, so those fields remain nullable
- the completion CSV does not include a dedicated snapshot date column in the current sample, so the app falls back to the report date found in the filename when possible
- department is derived from the Trainual `Groups` column when a group ends with `Department`
- the HR manager mapping sample does not include manager email or employee email columns, so those remain nullable unless provided in a different upload

## Dashboard behavior

Page:

- `/dashboard`

Features:

- KPI cards
  - overall completion rate
  - total employees
  - marked Complete
  - marked Needs Attention
  - average completion by manager
- Filters
  - manager
  - department
  - status
  - completion band
  - snapshot date
- Interactive charts
  - average by manager
  - team mix by manager
- Employee table
  - search
  - sort
  - pagination
  - CSV export

Interactivity details:

- all filters update cards, charts, and table together
- clicking a manager bar filters the dashboard
- clearing filters restores the full current dataset
- if no snapshot is selected, the dashboard shows the latest snapshot per employee
- if a snapshot date is selected, the dashboard pivots to that historical date

Status thresholds:

- `100%` = `Complete`
- `80% to 99%` = `Nearly Complete`
- `Below 80%` = `Needs Attention`

The app does not use the term “At Risk”.

## Manager detail page

Route:

- `/manager/[id]`

Features:

- manager name
- team average completion
- team size
- count by status band
- manager-scoped interactive table and charts

## Empty-state-first behavior

The app does not depend on seeded demo records.

If the database has no imports yet:

- dashboard pages show empty states
- admin import history shows no imports yet

## GitHub push steps

Inside the project directory:

```bash
git init
git add .
git commit -m "Build Trainual Completion Dashboard"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Vercel deployment steps

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Add these environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL`
4. Set `NEXT_PUBLIC_SITE_URL` to your deployed Vercel URL.
5. Deploy.
6. In Supabase Auth settings, add the deployed callback URL:
   - `https://your-domain/auth/callback`

## Troubleshooting

### Login works but admin page redirects away

- confirm the signed-in user has a `profiles` row
- confirm `profiles.role = 'admin'`

### Imports fail immediately

- confirm both CSV files were selected
- confirm required column mappings are set
- confirm the user is an admin
- confirm the migration created the `trainual-imports` bucket and RLS policies

### Imported data looks duplicated

- completion snapshots upsert by `employee_id + snapshot_date`
- if the file name changes but represents the same snapshot, confirm the mapped or inferred date is correct
- employee matching falls back to name if no ID/email exists, so inconsistent naming between source systems can create separate employees

### Dashboard is empty after deploy

- confirm imports completed successfully in `/admin/imports`
- confirm the logged-in user is authenticated
- confirm Supabase environment variables are set in Vercel

### Build issues

- this repo is configured to use `next build --webpack` for stable production builds

## Notes

- The app uses the Nao Medical light-theme brand direction with navy, mint, seafoam, and powder accents based on the uploaded brand workbook.
- No fake seed data is required for runtime.
- The original import files are stored in Supabase Storage and the dashboard renders from normalized Supabase tables.
