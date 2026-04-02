alter table public.employees
  add column if not exists work_location text check (work_location in ('Onshore', 'Offshore')),
  add column if not exists job_title text,
  add column if not exists last_active text;

create index if not exists employees_work_location_idx
  on public.employees (work_location);
