create extension if not exists pgcrypto;

create table if not exists public.managers (
  id uuid primary key default gen_random_uuid(),
  manager_name text not null,
  manager_email text,
  department text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists managers_manager_name_key
  on public.managers (manager_name);

create unique index if not exists managers_manager_email_key
  on public.managers (manager_email)
  where manager_email is not null;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  employee_email text,
  employee_external_id text,
  department text,
  manager_id uuid references public.managers (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists employees_employee_external_id_key
  on public.employees (employee_external_id)
  where employee_external_id is not null;

create unique index if not exists employees_employee_email_key
  on public.employees (employee_email)
  where employee_email is not null;

create index if not exists employees_employee_name_idx
  on public.employees (lower(employee_name));

create table if not exists public.trainual_completions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  completion_percentage numeric(5,2) not null check (completion_percentage >= 0 and completion_percentage <= 100),
  total_modules integer,
  completed_modules integer,
  remaining_modules integer,
  snapshot_date date,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists trainual_completions_employee_snapshot_key
  on public.trainual_completions (employee_id, snapshot_date) nulls not distinct;

create index if not exists trainual_completions_snapshot_date_idx
  on public.trainual_completions (snapshot_date desc);

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  import_type text not null check (import_type in ('completion', 'manager_mapping')),
  imported_at timestamptz not null default timezone('utc', now()),
  row_count integer not null default 0,
  status text not null check (status in ('pending', 'success', 'warning', 'failed')),
  notes text,
  storage_path text
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists managers_set_updated_at on public.managers;
create trigger managers_set_updated_at
before update on public.managers
for each row execute procedure public.handle_updated_at();

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row execute procedure public.handle_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.handle_updated_at();

insert into storage.buckets (id, name, public)
values ('trainual-imports', 'trainual-imports', false)
on conflict (id) do nothing;

alter table public.managers enable row level security;
alter table public.employees enable row level security;
alter table public.trainual_completions enable row level security;
alter table public.imports enable row level security;
alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "Authenticated users can read managers" on public.managers;
create policy "Authenticated users can read managers"
on public.managers
for select
to authenticated
using (true);

drop policy if exists "Admins can write managers" on public.managers;
create policy "Admins can write managers"
on public.managers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated users can read employees" on public.employees;
create policy "Authenticated users can read employees"
on public.employees
for select
to authenticated
using (true);

drop policy if exists "Admins can write employees" on public.employees;
create policy "Admins can write employees"
on public.employees
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated users can read completions" on public.trainual_completions;
create policy "Authenticated users can read completions"
on public.trainual_completions
for select
to authenticated
using (true);

drop policy if exists "Admins can write completions" on public.trainual_completions;
create policy "Admins can write completions"
on public.trainual_completions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated users can read imports" on public.imports;
create policy "Authenticated users can read imports"
on public.imports
for select
to authenticated
using (true);

drop policy if exists "Admins can write imports" on public.imports;
create policy "Admins can write imports"
on public.imports
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can upload import files" on storage.objects;
create policy "Admins can upload import files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trainual-imports'
  and public.is_admin()
);

drop policy if exists "Admins can read import files" on storage.objects;
create policy "Admins can read import files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'trainual-imports'
  and public.is_admin()
);
