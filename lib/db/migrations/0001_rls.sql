-- Row-level security.
--
-- The Drizzle client connects as the database owner and bypasses everything
-- below, so RLS is the SECOND line of defence — `assertVentureAccess` in
-- lib/auth.ts is the first. This layer exists so that a missing check in
-- application code is a bug rather than a data breach, and so anything reaching
-- Postgres with a user's JWT (Supabase client, PostgREST, Realtime) is confined
-- to that user's tenancy for free.
--
-- Run after `npm run db:push`.

-- ─── Membership lookup ───
--
-- SECURITY DEFINER matters here. A policy on org_members that queries
-- org_members would recurse infinitely; running the lookup as the definer
-- sidesteps RLS on that one read and breaks the cycle. search_path is pinned
-- because a SECURITY DEFINER function with a mutable search_path is a privilege
-- escalation waiting to happen.
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.org_members where user_id = auth.uid()
$$;

revoke all on function public.user_org_ids() from public;
grant execute on function public.user_org_ids() to authenticated;

create or replace function public.can_access_venture(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ventures v
    where v.id = target
      and v.org_id in (select org_id from public.org_members where user_id = auth.uid())
  )
$$;

revoke all on function public.can_access_venture(uuid) from public;
grant execute on function public.can_access_venture(uuid) to authenticated;

-- org_members.user_id references auth.users, which Drizzle doesn't model.
-- Declare the constraint here so a deleted user doesn't leave orphan memberships.
alter table public.org_members
  drop constraint if exists org_members_user_id_fkey;
alter table public.org_members
  add constraint org_members_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ─── Enable RLS ───
alter table public.orgs           enable row level security;
alter table public.org_members    enable row level security;
alter table public.ventures       enable row level security;
alter table public.facts          enable row level security;
alter table public.conversations  enable row level security;
alter table public.messages       enable row level security;
alter table public.artifacts      enable row level security;

-- Force RLS even for the table owner, so a mistake in a privileged path still
-- hits the policies.
alter table public.facts          force row level security;
alter table public.messages       force row level security;

-- ─── Policies ───

drop policy if exists orgs_member_access on public.orgs;
create policy orgs_member_access on public.orgs
  for all to authenticated
  using (id in (select public.user_org_ids()))
  with check (id in (select public.user_org_ids()));

drop policy if exists org_members_read on public.org_members;
create policy org_members_read on public.org_members
  for select to authenticated
  using (org_id in (select public.user_org_ids()));

-- Only owners and admins change membership. Without this, any member could
-- promote themselves.
drop policy if exists org_members_admin_write on public.org_members;
create policy org_members_admin_write on public.org_members
  for all to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.org_id = org_members.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.org_members m
      where m.org_id = org_members.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

drop policy if exists ventures_org_access on public.ventures;
create policy ventures_org_access on public.ventures
  for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

drop policy if exists facts_venture_access on public.facts;
create policy facts_venture_access on public.facts
  for all to authenticated
  using (public.can_access_venture(venture_id))
  with check (public.can_access_venture(venture_id));

drop policy if exists conversations_venture_access on public.conversations;
create policy conversations_venture_access on public.conversations
  for all to authenticated
  using (public.can_access_venture(venture_id))
  with check (public.can_access_venture(venture_id));

drop policy if exists artifacts_venture_access on public.artifacts;
create policy artifacts_venture_access on public.artifacts
  for all to authenticated
  using (public.can_access_venture(venture_id))
  with check (public.can_access_venture(venture_id));

-- Messages reach tenancy through their conversation.
drop policy if exists messages_conversation_access on public.messages;
create policy messages_conversation_access on public.messages
  for all to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and public.can_access_venture(c.venture_id)
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and public.can_access_venture(c.venture_id)
    )
  );

-- Supporting indexes for the policy subqueries. Without these, every policy
-- check is a sequential scan and the whole app gets slow under load.
create index if not exists org_members_user_org_idx on public.org_members (user_id, org_id);
create index if not exists ventures_org_id_idx on public.ventures (org_id);
