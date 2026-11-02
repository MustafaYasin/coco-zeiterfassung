-- COCO Zeit schema. Reconstructed 2026-10-27 from the live project
-- (oedgcuzjzflkizrpvpdl: pg_policies, pg_indexes, pg_constraint, pg_proc) for
-- local testing. Same version as the live migration, so it never re-runs there.

create table public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  username text not null unique check (username ~ '^[a-z0-9_-]{2,32}$'),
  display_name text not null,
  is_admin boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  note text not null default '',
  source text not null default 'app' check (source = any (array['app', 'import'])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);

create index time_entries_member_started_idx
  on public.time_entries (member_id, started_at desc);
create index time_entries_started_idx on public.time_entries (started_at desc);
create unique index time_entries_one_open_per_member
  on public.time_entries (member_id) where ended_at is null;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members
    where user_id = (select auth.uid()) and is_admin and active
  );
$$;

create function public.my_member_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.members where user_id = (select auth.uid());
$$;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger time_entries_touch before update on public.time_entries
  for each row execute function public.touch_updated_at();

alter table public.members enable row level security;
alter table public.time_entries enable row level security;

create policy members_select on public.members
  for select to authenticated using (true);
create policy members_admin_insert on public.members
  for insert to authenticated with check (public.is_admin());
create policy members_admin_update on public.members
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy members_admin_delete on public.members
  for delete to authenticated using (public.is_admin());

create policy entries_select on public.time_entries
  for select to authenticated
  using (member_id = public.my_member_id() or public.is_admin());
create policy entries_insert on public.time_entries
  for insert to authenticated
  with check (member_id = public.my_member_id() or public.is_admin());
create policy entries_update on public.time_entries
  for update to authenticated
  using (member_id = public.my_member_id() or public.is_admin())
  with check (member_id = public.my_member_id() or public.is_admin());
create policy entries_delete on public.time_entries
  for delete to authenticated
  using (member_id = public.my_member_id() or public.is_admin());

-- Live grants (information_schema.role_table_grants): the old Supabase
-- default, everything for anon, authenticated and service_role; RLS decides.
grant all on table public.members to anon, authenticated, service_role;
grant all on table public.time_entries to anon, authenticated, service_role;
