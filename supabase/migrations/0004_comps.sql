-- Comps puller: every paid RentCast lookup is saved here.
-- Used as a 30-day cache (same address = no new API call) and to count lookups against the monthly limit.
-- Safe to run more than once.

create table if not exists public.comp_lookups (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  address_key text not null,
  query       jsonb not null default '{}'::jsonb,
  result      jsonb not null default '{}'::jsonb,
  lead_id     uuid references public.leads(id) on delete set null
);

create index if not exists comp_lookups_key_idx on public.comp_lookups (address_key, created_at desc);
create index if not exists comp_lookups_month_idx on public.comp_lookups (created_at);

alter table public.comp_lookups enable row level security;

drop policy if exists comp_lookups_read on public.comp_lookups;
create policy comp_lookups_read on public.comp_lookups for select to authenticated
  using (public.has_role('owner','acquisitions','dispositions'));

drop policy if exists comp_lookups_insert on public.comp_lookups;
create policy comp_lookups_insert on public.comp_lookups for insert to authenticated
  with check (public.has_role('owner','acquisitions','dispositions') and created_by = auth.uid());

drop policy if exists comp_lookups_delete on public.comp_lookups;
create policy comp_lookups_delete on public.comp_lookups for delete to authenticated
  using (public.has_role('owner'));

grant select, insert, delete on public.comp_lookups to authenticated;
