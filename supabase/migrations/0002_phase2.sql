-- =====================================================================
-- H.R.F Assets LLC — Phase 2
-- Buyer portal listings, disclosure acknowledgments, buyer offers,
-- deal alerts, Deal Analyzer settings, KPI dashboard.
--
-- Run AFTER 0001_phase1.sql. Safe to run more than once.
--
-- Buyers never get direct access to the deals table (it holds contract
-- price and your fee). They read listings only through the portal_*
-- functions below, which return buyer-safe columns, and the full street
-- address only after that buyer has acknowledged the disclosure.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Listing fields on deals
-- ---------------------------------------------------------------------
alter table public.deals add column if not exists list_price  numeric(12,2);   -- price shown to buyers
alter table public.deals add column if not exists photo_paths text[] not null default '{}';
alter table public.deals add column if not exists comps       jsonb  not null default '[]';
-- comps: [{ "address": "...", "sold_price": 210000, "sold_date": "2026-08-01",
--           "beds": 3, "baths": 2, "sqft": 1450, "distance": "0.3 mi" }]

-- One-click unsubscribe from deal alerts (no login needed)
alter table public.cash_buyers add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
create unique index if not exists buyers_unsub_idx on public.cash_buyers (unsubscribe_token);

-- Saved Deal Analyzer result on a lead
alter table public.leads add column if not exists analysis jsonb;

-- ---------------------------------------------------------------------
-- Settings (one row) — Deal Analyzer defaults
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id                 smallint primary key default 1 check (id = 1),
  default_mao_pct    numeric(5,2) not null default 70,
  default_fee        numeric(12,2) not null default 10000,
  rehab_turnkey_sqft numeric(8,2) not null default 5,
  rehab_light_sqft   numeric(8,2) not null default 20,
  rehab_medium_sqft  numeric(8,2) not null default 37.5,
  rehab_heavy_sqft   numeric(8,2) not null default 55,
  updated_at         timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- Monthly targets (playbook / workbook "Monthly Targets")
create table if not exists public.monthly_targets (
  month       date primary key check (extract(day from month) = 1),
  outreach    integer,
  contracts   integer,
  closings    integer,
  revenue     numeric(12,2)
);

-- Marketing spend by lead source (for cost per contract)
create table if not exists public.marketing_spend (
  id          uuid primary key default gen_random_uuid(),
  month       date not null check (extract(day from month) = 1),
  lead_source text not null,
  amount      numeric(12,2) not null check (amount >= 0),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (month, lead_source)
);

-- ---------------------------------------------------------------------
-- Buyer disclosure acknowledgments (proof the buyer saw the notice)
-- ---------------------------------------------------------------------
create table if not exists public.deal_acknowledgments (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  deal_id         uuid not null references public.deals(id) on delete cascade,
  buyer_id        uuid not null references public.cash_buyers(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  disclosure_text text not null,
  ip_address      text,
  user_agent      text,
  unique (deal_id, user_id)
);

-- ---------------------------------------------------------------------
-- Buyer interest / offers
-- ---------------------------------------------------------------------
create table if not exists public.deal_offers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  buyer_id    uuid not null references public.cash_buyers(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  kind        text not null check (kind in ('interest','offer')),
  amount      numeric(12,2) check (amount is null or amount > 0),
  close_by    date,
  message     text check (length(message) <= 2000),
  status      text not null default 'New' check (status in ('New','Reviewed','Accepted','Declined')),
  constraint offer_has_amount check (kind <> 'offer' or amount is not null)
);
create index if not exists offers_deal_idx on public.deal_offers (deal_id, created_at desc);

-- ---------------------------------------------------------------------
-- Deal alert log (one email per buyer per deal, ever)
-- ---------------------------------------------------------------------
create table if not exists public.deal_alerts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  buyer_id    uuid not null references public.cash_buyers(id) on delete cascade,
  email       text not null,
  status      text not null check (status in ('sent','failed','skipped')),
  error       text,
  unique (deal_id, buyer_id)
);

-- ---------------------------------------------------------------------
-- Row Level Security for the new tables
-- ---------------------------------------------------------------------
alter table public.app_settings         enable row level security;
alter table public.monthly_targets      enable row level security;
alter table public.marketing_spend      enable row level security;
alter table public.deal_acknowledgments enable row level security;
alter table public.deal_offers          enable row level security;
alter table public.deal_alerts          enable row level security;

revoke all on public.app_settings, public.monthly_targets, public.marketing_spend,
              public.deal_acknowledgments, public.deal_offers, public.deal_alerts from anon;

drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select to authenticated
  using (public.has_role('owner','acquisitions','dispositions','va'));
drop policy if exists settings_write on public.app_settings;
create policy settings_write on public.app_settings for update to authenticated
  using (public.has_role('owner')) with check (public.has_role('owner'));

drop policy if exists targets_owner on public.monthly_targets;
create policy targets_owner on public.monthly_targets for all to authenticated
  using (public.has_role('owner')) with check (public.has_role('owner'));

drop policy if exists spend_owner on public.marketing_spend;
create policy spend_owner on public.marketing_spend for all to authenticated
  using (public.has_role('owner')) with check (public.has_role('owner'));

-- Staff who can see the deal can see its acknowledgments, offers and alerts.
drop policy if exists acks_staff on public.deal_acknowledgments;
create policy acks_staff on public.deal_acknowledgments for select to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_id) or user_id = auth.uid());

drop policy if exists offers_read on public.deal_offers;
create policy offers_read on public.deal_offers for select to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_id) or user_id = auth.uid());
drop policy if exists offers_staff_update on public.deal_offers;
create policy offers_staff_update on public.deal_offers for update to authenticated
  using (public.has_role('owner','dispositions')) with check (public.has_role('owner','dispositions'));
drop policy if exists offers_owner_delete on public.deal_offers;
create policy offers_owner_delete on public.deal_offers for delete to authenticated
  using (public.has_role('owner'));

drop policy if exists alerts_staff on public.deal_alerts;
create policy alerts_staff on public.deal_alerts for select to authenticated
  using (public.has_role('owner','dispositions'));

-- ---------------------------------------------------------------------
-- Buyer portal: buyer-safe reads (no contract price, fee, seller, notes)
-- ---------------------------------------------------------------------
create or replace function public.current_buyer_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select b.id from public.cash_buyers b
  where b.user_id = auth.uid() and public.has_role('buyer') and b.status = 'Active'
$$;

drop function if exists public.portal_deals();
create or replace function public.portal_deals()
returns table (
  id uuid, status text, area text, city text, zip text, property_type text,
  beds numeric, baths numeric, sqft integer, year_built integer,
  arv numeric, repair_estimate numeric, rehab_level text, list_price numeric,
  closing_date date, description text, photo_paths text[], comps jsonb,
  published_at timestamptz, acknowledged boolean, address text
)
language sql stable security definer set search_path = '' as $$
  select d.id,
         case when d.status in ('Under contract','Marketing') then 'Available' else 'Pending' end,
         d.area, d.city, d.zip, d.property_type, d.beds, d.baths, d.sqft, d.year_built,
         d.arv, d.repair_estimate, d.rehab_level,
         coalesce(d.list_price, d.assignment_price) as list_price,
         d.closing_date, d.description, d.photo_paths, d.comps, d.published_at,
         (a.id is not null) as acknowledged,
         case when a.id is not null then d.address end as address
  from public.deals d
  left join public.deal_acknowledgments a on a.deal_id = d.id and a.user_id = auth.uid()
  where public.current_buyer_id() is not null
    and d.published_to_portal
    and d.status in ('Under contract','Marketing','Buyer assigned','Clear to close')
  order by d.published_at desc nulls last
$$;

create or replace function public.acknowledge_deal(p_deal_id uuid, p_disclosure text, p_ip text default null, p_user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_buyer uuid;
begin
  v_buyer := public.current_buyer_id();
  if v_buyer is null then raise exception 'Only active registered buyers can view deals'; end if;
  if not exists (select 1 from public.deals where id = p_deal_id and published_to_portal) then
    raise exception 'This deal is no longer available';
  end if;
  insert into public.deal_acknowledgments (deal_id, buyer_id, user_id, disclosure_text, ip_address, user_agent)
  values (p_deal_id, v_buyer, auth.uid(), p_disclosure, p_ip, left(p_user_agent, 500))
  on conflict (deal_id, user_id) do nothing;
end $$;

create or replace function public.submit_deal_interest(
  p_deal_id uuid, p_kind text, p_amount numeric default null, p_close_by date default null, p_message text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_buyer uuid; v_id uuid;
begin
  v_buyer := public.current_buyer_id();
  if v_buyer is null then raise exception 'Only active registered buyers can submit interest'; end if;
  if not exists (select 1 from public.deals where id = p_deal_id and published_to_portal
                 and status in ('Under contract','Marketing')) then
    raise exception 'This deal is no longer accepting offers';
  end if;
  if not exists (select 1 from public.deal_acknowledgments where deal_id = p_deal_id and user_id = auth.uid()) then
    raise exception 'Please acknowledge the disclosure first';
  end if;
  if (select count(*) from public.deal_offers where deal_id = p_deal_id and user_id = auth.uid()
      and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many submissions on this deal. Please call us.';
  end if;
  insert into public.deal_offers (deal_id, buyer_id, user_id, kind, amount, close_by, message)
  values (p_deal_id, v_buyer, auth.uid(), p_kind, p_amount, p_close_by, nullif(trim(p_message), ''))
  returning id into v_id;
  return v_id;
end $$;

drop function if exists public.portal_my_offers();
create or replace function public.portal_my_offers()
returns table (id uuid, created_at timestamptz, deal_id uuid, area text, kind text, amount numeric, close_by date, status text)
language sql stable security definer set search_path = '' as $$
  select o.id, o.created_at, o.deal_id, coalesce(d.area, d.city), o.kind, o.amount, o.close_by, o.status
  from public.deal_offers o join public.deals d on d.id = o.deal_id
  where o.user_id = auth.uid() and public.current_buyer_id() is not null
  order by o.created_at desc
$$;

revoke execute on function public.portal_deals(), public.portal_my_offers(),
  public.acknowledge_deal(uuid, text, text, text),
  public.submit_deal_interest(uuid, text, numeric, date, text) from public, anon;
grant execute on function public.portal_deals(), public.portal_my_offers(),
  public.acknowledge_deal(uuid, text, text, text),
  public.submit_deal_interest(uuid, text, numeric, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- Which buyers match a deal (used by alerts; server-only)
-- ---------------------------------------------------------------------
drop function if exists public.matching_buyers(uuid);
create or replace function public.matching_buyers(p_deal_id uuid)
returns table (buyer_id uuid, name text, email text, tier text, unsubscribe_token uuid, already_alerted boolean)
language sql stable security definer set search_path = '' as $$
  with d as (
    select dd.*, coalesce(dd.list_price, dd.assignment_price, dd.contract_price) as price
    from public.deals dd where dd.id = p_deal_id
  )
  select b.id, b.name, b.email, b.tier, b.unsubscribe_token,
         exists (select 1 from public.deal_alerts x where x.deal_id = d.id and x.buyer_id = b.id and x.status = 'sent')
  from public.cash_buyers b, d
  where b.status = 'Active' and b.email_alerts and coalesce(b.email, '') <> ''
    and (cardinality(b.areas) = 0 or exists (
          select 1 from unnest(b.areas) a
          where lower(trim(a)) in (lower(coalesce(d.zip,'')), lower(coalesce(d.city,'')), lower(coalesce(d.area,'')))
             or (length(trim(a)) >= 4 and lower(coalesce(d.area,'') || ' ' || coalesce(d.city,'')) like '%' || lower(trim(a)) || '%')))
    and (d.price is null or ((b.price_min is null or d.price >= b.price_min) and (b.price_max is null or d.price <= b.price_max)))
    and (cardinality(b.rehab_levels) = 0 or d.rehab_level is null or d.rehab_level = any(b.rehab_levels))
    and (cardinality(b.property_types) = 0 or d.property_type is null or d.property_type = any(b.property_types))
  order by b.tier, b.deals_closed desc, b.name
$$;
revoke execute on function public.matching_buyers(uuid) from public, anon, authenticated;
grant execute on function public.matching_buyers(uuid) to service_role;

-- ---------------------------------------------------------------------
-- Dashboard (owner page; RLS still applies to the underlying rows)
-- ---------------------------------------------------------------------
create or replace function public.dashboard_weeks(p_weeks int default 8)
returns table (week_start date, outreach bigint, conversations bigint, appointments bigint,
               offers bigint, contracts bigint, closings bigint, revenue numeric)
language sql stable security invoker set search_path = '' as $$
  with w as (
    select (date_trunc('week', now() at time zone 'America/Chicago') - make_interval(weeks => n))::date as ws
    from generate_series(0, greatest(p_weeks, 1) - 1) n
  ),
  act as (
    select (a.created_at at time zone 'America/Chicago')::date as day, a.kind, a.reached, a.outcome
    from public.lead_activities a
    where a.created_at >= now() - make_interval(weeks => greatest(p_weeks, 1) + 1)
  )
  select w.ws,
    (select count(*) from act where day >= w.ws and day < w.ws + 7 and kind in ('call','text','email','voicemail','door','letter')),
    (select count(*) from act where day >= w.ws and day < w.ws + 7 and reached),
    (select count(*) from act where day >= w.ws and day < w.ws + 7
       and (kind = 'appointment' or (kind = 'status' and outcome like '%→ Appointment set'))),
    (select count(*) from act where day >= w.ws and day < w.ws + 7
       and (kind = 'offer' or (kind = 'status' and outcome like '%→ Offer made'))),
    (select count(*) from public.deals d where d.contract_signed_date >= w.ws and d.contract_signed_date < w.ws + 7),
    (select count(*) from public.deals d where d.status = 'Closed' and d.closing_date >= w.ws and d.closing_date < w.ws + 7),
    (select coalesce(sum(d.fee), 0) from public.deals d where d.status = 'Closed' and d.closing_date >= w.ws and d.closing_date < w.ws + 7)
  from w order by w.ws desc
$$;

create or replace function public.dashboard_months(p_from date, p_months int default 12)
returns table (month date, outreach bigint, conversations bigint, contracts bigint, closings bigint, revenue numeric)
language sql stable security invoker set search_path = '' as $$
  with m as (
    select (date_trunc('month', p_from) + make_interval(months => n))::date as ms
    from generate_series(0, greatest(p_months, 1) - 1) n
  )
  select m.ms,
    (select count(*) from public.lead_activities a
       where a.kind in ('call','text','email','voicemail','door','letter')
         and (a.created_at at time zone 'America/Chicago')::date >= m.ms
         and (a.created_at at time zone 'America/Chicago')::date < (m.ms + interval '1 month')::date),
    (select count(*) from public.lead_activities a
       where a.reached
         and (a.created_at at time zone 'America/Chicago')::date >= m.ms
         and (a.created_at at time zone 'America/Chicago')::date < (m.ms + interval '1 month')::date),
    (select count(*) from public.deals d where d.contract_signed_date >= m.ms and d.contract_signed_date < (m.ms + interval '1 month')::date),
    (select count(*) from public.deals d where d.status = 'Closed' and d.closing_date >= m.ms and d.closing_date < (m.ms + interval '1 month')::date),
    (select coalesce(sum(d.fee), 0) from public.deals d where d.status = 'Closed' and d.closing_date >= m.ms and d.closing_date < (m.ms + interval '1 month')::date)
  from m order by m.ms
$$;

create or replace function public.dashboard_sources(p_from date, p_to date)
returns table (lead_source text, leads bigint, contracts bigint, closings bigint, revenue numeric, spend numeric)
language sql stable security invoker set search_path = '' as $$
  with src as (
    select coalesce(l.lead_source, 'Unknown') s from public.leads l
    union select coalesce(ms.lead_source, 'Unknown') from public.marketing_spend ms
  )
  select src.s,
    (select count(*) from public.leads l where coalesce(l.lead_source, 'Unknown') = src.s
       and (l.created_at at time zone 'America/Chicago')::date between p_from and p_to),
    (select count(*) from public.deals d left join public.leads l on l.id = d.lead_id
       where coalesce(l.lead_source, 'Unknown') = src.s and d.contract_signed_date between p_from and p_to),
    (select count(*) from public.deals d left join public.leads l on l.id = d.lead_id
       where coalesce(l.lead_source, 'Unknown') = src.s and d.status = 'Closed' and d.closing_date between p_from and p_to),
    (select coalesce(sum(d.fee), 0) from public.deals d left join public.leads l on l.id = d.lead_id
       where coalesce(l.lead_source, 'Unknown') = src.s and d.status = 'Closed' and d.closing_date between p_from and p_to),
    (select coalesce(sum(ms.amount), 0) from public.marketing_spend ms
       where ms.lead_source = src.s and ms.month between date_trunc('month', p_from)::date and p_to)
  from src order by 4 desc, 2 desc
$$;

revoke execute on function public.dashboard_weeks(int), public.dashboard_months(date, int),
  public.dashboard_sources(date, date) from public, anon;
grant execute on function public.dashboard_weeks(int), public.dashboard_months(date, int),
  public.dashboard_sources(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- Photo storage: public-read bucket with unguessable file names
-- (listing photos are meant to be seen by buyers; uploads go through
--  short-lived signed upload links issued by the server)
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public)
    values ('deal-photos', 'deal-photos', true)
    on conflict (id) do nothing;
  end if;
end $$;
