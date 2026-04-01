alter table public.managers enable row level security;
alter table public.employees enable row level security;
alter table public.trainual_completions enable row level security;
alter table public.imports enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Anon can read managers" on public.managers;
create policy "Anon can read managers"
on public.managers
for select
to anon
using (true);

drop policy if exists "Anon can write managers" on public.managers;
create policy "Anon can write managers"
on public.managers
for all
to anon
using (true)
with check (true);

drop policy if exists "Anon can read employees" on public.employees;
create policy "Anon can read employees"
on public.employees
for select
to anon
using (true);

drop policy if exists "Anon can write employees" on public.employees;
create policy "Anon can write employees"
on public.employees
for all
to anon
using (true)
with check (true);

drop policy if exists "Anon can read completions" on public.trainual_completions;
create policy "Anon can read completions"
on public.trainual_completions
for select
to anon
using (true);

drop policy if exists "Anon can write completions" on public.trainual_completions;
create policy "Anon can write completions"
on public.trainual_completions
for all
to anon
using (true)
with check (true);

drop policy if exists "Anon can read imports" on public.imports;
create policy "Anon can read imports"
on public.imports
for select
to anon
using (true);

drop policy if exists "Anon can write imports" on public.imports;
create policy "Anon can write imports"
on public.imports
for all
to anon
using (true)
with check (true);

drop policy if exists "Anon can read profiles" on public.profiles;
create policy "Anon can read profiles"
on public.profiles
for select
to anon
using (true);

drop policy if exists "Anon can upload import files" on storage.objects;
create policy "Anon can upload import files"
on storage.objects
for insert
to anon
with check (bucket_id = 'trainual-imports');

drop policy if exists "Anon can read import files" on storage.objects;
create policy "Anon can read import files"
on storage.objects
for select
to anon
using (bucket_id = 'trainual-imports');
