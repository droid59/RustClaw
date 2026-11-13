-- One Piece Memory Trainer — initial schema
-- Run in Supabase SQL editor or with `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------- Profiles (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_pro boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  subscription_status text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Memory palace ----------
create table if not exists public.paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.loci (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path_id uuid not null references public.paths (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  position int not null default 0
);
create index if not exists loci_path_idx on public.loci (path_id, position);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path_id uuid not null references public.paths (id) on delete cascade,
  locus_id uuid not null references public.loci (id) on delete cascade,
  card jsonb not null,
  image text not null default '',
  srs jsonb not null,
  stats jsonb not null default '{"correct":0,"wrong":0,"streak":0}',
  created_at timestamptz not null default now()
);
create index if not exists assignments_user_idx on public.assignments (user_id);

create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  assignment_id uuid references public.assignments (id) on delete set null,
  locus_id uuid,
  grade smallint not null check (grade between 0 and 3),
  mode text not null,
  at timestamptz not null default now()
);
create index if not exists review_logs_user_idx on public.review_logs (user_id, at desc);

-- ---------- Row level security ----------
alter table public.profiles enable row level security;
alter table public.paths enable row level security;
alter table public.loci enable row level security;
alter table public.assignments enable row level security;
alter table public.user_cards enable row level security;
alter table public.review_logs enable row level security;

-- Users can read (not write) their own profile; is_pro is only changed by the Stripe webhook (service role).
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array['paths','loci','assignments','user_cards','review_logs'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------- Free-tier limits enforced in the database ----------
create or replace function public.enforce_plan_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pro boolean;
  n int;
begin
  select coalesce(is_pro, false) into pro from public.profiles where id = new.user_id;
  if coalesce(pro, false) then return new; end if;
  if tg_table_name = 'paths' then
    select count(*) into n from public.paths where user_id = new.user_id;
    if n >= 1 then raise exception 'FREE_LIMIT_PATHS: Free plan includes 1 memory path' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'assignments' then
    select count(*) into n from public.assignments where user_id = new.user_id;
    if n >= 20 then raise exception 'FREE_LIMIT_CARDS: Free plan includes 20 cards' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;

drop trigger if exists paths_limit on public.paths;
create trigger paths_limit before insert on public.paths for each row execute function public.enforce_plan_limits();
drop trigger if exists assignments_limit on public.assignments;
create trigger assignments_limit before insert on public.assignments for each row execute function public.enforce_plan_limits();

-- ---------- Storage bucket for uploaded card images ----------
insert into storage.buckets (id, name, public) values ('card-uploads', 'card-uploads', true)
  on conflict (id) do nothing;

drop policy if exists "upload own folder" on storage.objects;
create policy "upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'card-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "delete own folder" on storage.objects;
create policy "delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'card-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "read card uploads" on storage.objects;
create policy "read card uploads" on storage.objects for select using (bucket_id = 'card-uploads');
