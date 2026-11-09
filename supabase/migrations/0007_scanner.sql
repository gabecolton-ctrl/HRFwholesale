-- Deal Scanner: scans on-market (MLS) listings in your cities every week, scores them, and lists the best ones.
-- Safe to run more than once.

create table if not exists public.scan_markets (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  city           text not null,
  state          text not null,
  active         boolean not null default true,
  price_min      integer not null default 60000,
  price_max      integer not null default 350000,
  min_beds       integer not null default 2,
  last_scanned_at timestamptz,
  last_count     integer,
  last_qualified integer,
  last_error     text,
  unique (city, state)
);

create table if not exists public.scan_runs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  market_id   uuid references public.scan_markets(id) on delete set null,
  requests    integer not null default 0,
  listings    integer not null default 0,
  qualified   integer not null default 0,
  error       text
);
create index if not exists scan_runs_month_idx on public.scan_runs (created_at);

create table if not exists public.scan_listings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  market_id     uuid references public.scan_markets(id) on delete cascade,
  rentcast_id   text not null unique,
  address       text not null,
  city          text,
  state         text,
  zip           text,
  price         integer,
  first_price   integer,
  price_drops   integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  beds          numeric,
  baths         numeric,
  sqft          integer,
  year_built    integer,
  listing_type  text,
  days_on_market integer,
  listed_date   date,
  relisted      boolean not null default false,
  hoa_fee       numeric,
  mls_number    text,
  agent         jsonb,
  office        jsonb,
  zip_ppsf      numeric,
  est_arv       integer,
  est_repairs   integer,
  est_mao       integer,
  score         integer not null default 0,
  flags         text[] not null default '{}',
  qualified     boolean not null default false,
  status        text not null default 'new' check (status in ('new','lead','dismissed','gone')),
  lead_id       uuid references public.leads(id) on delete set null,
  address_key   text generated always as (public.address_key(address, zip)) stored
);
create index if not exists scan_listings_q_idx on public.scan_listings (qualified, status, score desc);
create index if not exists scan_listings_market_idx on public.scan_listings (market_id);

alter table public.scan_markets enable row level security;
alter table public.scan_runs enable row level security;
alter table public.scan_listings enable row level security;

drop policy if exists markets_read on public.scan_markets;
create policy markets_read on public.scan_markets for select to authenticated using (public.has_role('owner','acquisitions','va'));
drop policy if exists markets_owner on public.scan_markets;
create policy markets_owner on public.scan_markets for all to authenticated using (public.has_role('owner')) with check (public.has_role('owner'));

drop policy if exists runs_read on public.scan_runs;
create policy runs_read on public.scan_runs for select to authenticated using (public.has_role('owner','acquisitions','dispositions','va'));
drop policy if exists runs_insert on public.scan_runs;
create policy runs_insert on public.scan_runs for insert to authenticated with check (public.has_role('owner'));

drop policy if exists listings_read on public.scan_listings;
create policy listings_read on public.scan_listings for select to authenticated using (public.has_role('owner','acquisitions','va'));
drop policy if exists listings_owner_write on public.scan_listings;
create policy listings_owner_write on public.scan_listings for insert to authenticated with check (public.has_role('owner'));
drop policy if exists listings_update on public.scan_listings;
create policy listings_update on public.scan_listings for update to authenticated
  using (public.has_role('owner','acquisitions','va')) with check (public.has_role('owner','acquisitions','va'));

grant select, insert, update, delete on public.scan_markets to authenticated;
grant select, insert on public.scan_runs to authenticated;
grant select, insert, update on public.scan_listings to authenticated;

-- Starter markets: Dallas–Fort Worth.
insert into public.scan_markets (city, state) values
  ('Dallas','TX'), ('Fort Worth','TX'), ('Arlington','TX'), ('Garland','TX'), ('Mesquite','TX'), ('Grand Prairie','TX')
on conflict (city, state) do nothing;
