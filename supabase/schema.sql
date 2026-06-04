-- One JSON document per user. Run this in the Supabase SQL editor.
create table if not exists public.app_data (
  owner      uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

create policy "app_data: owner can select" on public.app_data
  for select using (auth.uid() = owner);
create policy "app_data: owner can insert" on public.app_data
  for insert with check (auth.uid() = owner);
create policy "app_data: owner can update" on public.app_data
  for update using (auth.uid() = owner) with check (auth.uid() = owner);
