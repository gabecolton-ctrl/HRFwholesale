-- Owner & mortgage lookup (Tracerfy): owner names, mortgage, equity, phones/emails with DNC flags.
-- Every paid lookup is saved: a 30-day cache (same address = no new charge) and a monthly cap.
-- Safe to run more than once.

alter table public.leads add column if not exists property_data jsonb;

create table if not exists public.property_lookups (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  address_key text not null,
  query       jsonb not null default '{}'::jsonb,
  result      jsonb not null default '{}'::jsonb,
  credits     integer not null default 0,
  lead_id     uuid references public.leads(id) on delete set null
);

create index if not exists property_lookups_key_idx on public.property_lookups (address_key, created_at desc);
create index if not exists property_lookups_month_idx on public.property_lookups (created_at);

alter table public.property_lookups enable row level security;

drop policy if exists property_lookups_read on public.property_lookups;
create policy property_lookups_read on public.property_lookups for select to authenticated
  using (public.has_role('owner','acquisitions','va'));

drop policy if exists property_lookups_insert on public.property_lookups;
create policy property_lookups_insert on public.property_lookups for insert to authenticated
  with check (public.has_role('owner','acquisitions','va') and created_by = auth.uid());

drop policy if exists property_lookups_delete on public.property_lookups;
create policy property_lookups_delete on public.property_lookups for delete to authenticated
  using (public.has_role('owner'));

grant select, insert, delete on public.property_lookups to authenticated;
