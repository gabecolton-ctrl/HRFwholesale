-- Distress leads: county/state lists (Tracerfy) and city code-violation feeds (open data).
-- Everything lands in one inbox (distress_signals); you pick which become leads.
-- Safe to run more than once.

-- City open-data feeds (Socrata portals like dallasopendata.com).
create table if not exists public.signal_feeds (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null,
  city           text not null,
  state          text not null,
  domain         text not null,             -- e.g. www.dallasopendata.com
  dataset_id     text not null,             -- e.g. d7e7-envw
  keywords       text[] not null default '{}', -- only keep rows whose type matches one of these
  field_address  text,                      -- auto-detected if blank
  field_type     text,
  field_date     text,
  field_zip      text,
  field_id       text,
  active         boolean not null default true,
  last_pulled_at timestamptz,
  last_count     integer,
  last_error     text,
  unique (domain, dataset_id)
);

-- Tracerfy list builds.
create table if not exists public.lead_lists (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  name            text not null,
  strategy        text not null,
  geography       jsonb not null,
  filters         jsonb not null default '{}'::jsonb,
  requested_count integer not null,
  tracerfy_id     text,
  status          text not null default 'pending' check (status in ('pending','processing','completed','imported','failed')),
  credits         integer not null default 0,
  rows_imported   integer not null default 0,
  error           text
);

-- The inbox.
create table if not exists public.distress_signals (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  source       text not null check (source in ('feed','list')),
  feed_id      uuid references public.signal_feeds(id) on delete cascade,
  list_id      uuid references public.lead_lists(id) on delete cascade,
  source_id    text not null,               -- feed record id, or address for lists
  signal_type  text not null,
  address      text not null,
  city         text,
  state        text,
  zip          text,
  reported_at  timestamptz,
  property_data jsonb,                      -- filled for list rows (owner, phones, mortgage)
  raw          jsonb,
  status       text not null default 'new' check (status in ('new','lead','dismissed')),
  lead_id      uuid references public.leads(id) on delete set null,
  address_key  text generated always as (public.address_key(address, zip)) stored
);

-- Plain (non-partial) unique indexes so inserts can skip duplicates; NULLs never collide.
create unique index if not exists distress_feed_uniq on public.distress_signals (feed_id, source_id);
create unique index if not exists distress_list_uniq on public.distress_signals (list_id, source_id);
create index if not exists distress_status_idx on public.distress_signals (status, created_at desc);
create index if not exists distress_key_idx on public.distress_signals (address_key);

alter table public.signal_feeds enable row level security;
alter table public.lead_lists enable row level security;
alter table public.distress_signals enable row level security;

drop policy if exists feeds_read on public.signal_feeds;
create policy feeds_read on public.signal_feeds for select to authenticated
  using (public.has_role('owner','acquisitions','va'));
drop policy if exists feeds_owner on public.signal_feeds;
create policy feeds_owner on public.signal_feeds for all to authenticated
  using (public.has_role('owner')) with check (public.has_role('owner'));

drop policy if exists lists_read on public.lead_lists;
create policy lists_read on public.lead_lists for select to authenticated
  using (public.has_role('owner','acquisitions'));
drop policy if exists lists_insert on public.lead_lists;
create policy lists_insert on public.lead_lists for insert to authenticated
  with check (public.has_role('owner','acquisitions') and created_by = auth.uid());
drop policy if exists lists_update on public.lead_lists;
create policy lists_update on public.lead_lists for update to authenticated
  using (public.has_role('owner','acquisitions')) with check (public.has_role('owner','acquisitions'));

drop policy if exists signals_read on public.distress_signals;
create policy signals_read on public.distress_signals for select to authenticated
  using (public.has_role('owner','acquisitions','va'));
drop policy if exists signals_insert on public.distress_signals;
create policy signals_insert on public.distress_signals for insert to authenticated
  with check (public.has_role('owner','acquisitions'));
drop policy if exists signals_update on public.distress_signals;
create policy signals_update on public.distress_signals for update to authenticated
  using (public.has_role('owner','acquisitions','va')) with check (public.has_role('owner','acquisitions','va'));
drop policy if exists signals_delete on public.distress_signals;
create policy signals_delete on public.distress_signals for delete to authenticated
  using (public.has_role('owner'));

grant select, insert, update, delete on public.signal_feeds to authenticated;
grant select, insert, update on public.lead_lists to authenticated;
grant select, insert, update, delete on public.distress_signals to authenticated;

-- Dallas starter feed: 311 service requests filtered to code-compliance problems that point to neglected houses.
insert into public.signal_feeds (name, city, state, domain, dataset_id, keywords)
values ('Dallas code complaints (311)', 'Dallas', 'TX', 'www.dallasopendata.com', 'd7e7-envw',
        array['high weeds','weed','vacant','open and vacant','structure','junk','litter','dangerous','substandard','unsecure','boarded','trash','illegal dumping','rodent'])
on conflict (domain, dataset_id) do nothing;
