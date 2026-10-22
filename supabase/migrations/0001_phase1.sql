-- =====================================================================
-- H.R.F Assets LLC — hrfwholesale.com
-- Phase 1 schema: roles, leads, follow-ups, cash buyers, deal pipeline
--
-- Security model:
--   * Every table has Row Level Security ON. Access is decided here, in
--     the database, so no page, import or future feature can bypass it.
--   * Public forms (seller form, buyer sign-up) write through the server
--     using the service role, never directly from the browser.
--   * Files (proof of funds, signed disclosures) live in private storage
--     buckets with no direct access; the app hands out short-lived links
--     only after checking the matching row through RLS.
--
-- Business rules enforced here (not just in the screens):
--   * A deal cannot be published to the buyer portal unless it is under
--     contract AND the seller disclosure is marked signed.
--   * A deal cannot be "Buyer assigned" (or any later stage) unless the
--     buyer disclosure is marked signed and an end buyer is chosen.
--   * Every open lead has a next follow-up date (cadence 3/7/14/30/60/90).
--   * Do Not Call leads drop out of the follow-up queue.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Roles & profiles
-- ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum
    ('pending', 'owner', 'acquisitions', 'dispositions', 'va', 'buyer');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        public.app_role not null default 'pending',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Every new login gets a profile with NO access ('pending'). Staff are
-- promoted by the owner; buyers are set to 'buyer' by the sign-up flow.
-- Metadata sent from the browser is never trusted for the role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Current user's role (null when not signed in or deactivated).
create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.active
$$;

create or replace function public.has_role(variadic roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = any(roles), false)
$$;

-- Only the owner (or the server's service role) can change roles/active.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and auth.uid() is not null
     and not public.has_role('owner') then
    raise exception 'Only the owner can change roles or deactivate users';
  end if;
  if new.id = auth.uid() and old.role = 'owner'
     and (new.role <> 'owner' or not new.active) then
    raise exception 'You cannot remove your own owner access';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- Normalized address used to spot duplicates ("123 N. Main St." = "123 n main st")
create or replace function public.address_key(addr text, zip text)
returns text language sql immutable as $$
  select nullif(
    regexp_replace(lower(coalesce(addr, '')), '[^a-z0-9]+', '', 'g')
    || coalesce(left(regexp_replace(coalesce(zip, ''), '[^0-9]', '', 'g'), 5), ''),
  '')
$$;

-- Follow-up cadence: days after the cadence start (3, 7, 14, 30, 60, 90).
create or replace function public.cadence_offset(step int)
returns int language sql immutable as $$
  select (array[3, 7, 14, 30, 60, 90])[step]
$$;

-- ---------------------------------------------------------------------
-- Leads (Lead Tracker)
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references public.profiles(id) on delete set null,
  assigned_to         uuid references public.profiles(id) on delete set null,

  -- Seller
  seller_name         text not null,
  phone               text,
  email               text,
  mailing_address     text,

  -- Property
  address             text not null,
  city                text,
  state               text not null default 'TX',
  zip                 text,
  county              text,
  property_type       text,
  beds                numeric(4,1),
  baths               numeric(4,1),
  sqft                integer,
  year_built          integer,
  condition           text,
  occupancy           text,

  -- Motivation
  reason_for_selling  text,
  timeline            text,
  asking_price        numeric(12,2),
  motivation          smallint check (motivation between 1 and 5),
  lead_source         text,

  -- Numbers (filled during analysis)
  est_arv             numeric(12,2),
  est_repairs         numeric(12,2),
  mortgage_balance    numeric(12,2),
  offer_amount        numeric(12,2),
  offer_date          date,

  -- Keep-or-wholesale signals (playbook: own-property track)
  keep_candidate          boolean not null default false,
  low_rate_loan           boolean not null default false,
  free_and_clear          boolean not null default false,
  tired_landlord          boolean not null default false,
  open_to_monthly_payments boolean,

  -- Status & follow-up
  status              text not null default 'New' check (status in
                        ('New','Contacted','Follow up','Appointment set',
                         'Offer made','Under contract','Closed','Dead')),
  dead_reason         text,
  do_not_call         boolean not null default false,
  do_not_call_at      timestamptz,
  cadence_start       date not null default current_date,
  follow_up_step      smallint not null default 1 check (follow_up_step between 1 and 7),
  next_follow_up      date,
  last_contacted_at   timestamptz,

  notes               text,
  address_key         text generated always as (public.address_key(address, zip)) stored,

  -- An open lead always has a next follow-up date.
  constraint lead_needs_follow_up check (
    next_follow_up is not null
    or status in ('Under contract','Closed','Dead')
    or do_not_call
  )
);

create index if not exists leads_status_idx      on public.leads (status);
create index if not exists leads_follow_up_idx   on public.leads (next_follow_up) where not do_not_call;
create index if not exists leads_assigned_idx    on public.leads (assigned_to);
create index if not exists leads_address_key_idx on public.leads (address_key);
create index if not exists leads_source_idx      on public.leads (lead_source);

create or replace function public.leads_before_write()
returns trigger language plpgsql as $$
begin
  -- Keep candidate turns on automatically when any keeper signal is set.
  if new.low_rate_loan or new.free_and_clear or new.tired_landlord
     or coalesce(new.open_to_monthly_payments, false) then
    new.keep_candidate := true;
  end if;

  -- Do Not Call: stamp it and take the lead out of the follow-up queue.
  if new.do_not_call then
    new.do_not_call_at := coalesce(new.do_not_call_at, now());
    new.next_follow_up := null;
  elsif tg_op = 'UPDATE' and old.do_not_call and not new.do_not_call then
    new.do_not_call_at := null;
  end if;

  -- Closed/Dead/Under contract leads leave the follow-up queue.
  if new.status in ('Under contract','Closed','Dead') then
    new.next_follow_up := null;
  end if;

  -- Open leads with no date get the next cadence date automatically.
  if new.next_follow_up is null and not new.do_not_call
     and new.status not in ('Under contract','Closed','Dead') then
    new.next_follow_up := greatest(
      new.cadence_start + coalesce(public.cadence_offset(new.follow_up_step), 30),
      current_date);
  end if;

  if new.status = 'Offer made' and new.offer_date is null then
    new.offer_date := current_date;
  end if;
  return new;
end $$;

drop trigger if exists leads_before_write on public.leads;
create trigger leads_before_write before insert or update on public.leads
  for each row execute function public.leads_before_write();

drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- VAs handle lead entry and follow-ups only: they cannot move a lead into
-- Offer made / Under contract / Closed, reassign it, or edit the numbers.
create or replace function public.guard_va_lead_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.has_role('va') then
    if tg_op = 'UPDATE' and new.status is distinct from old.status
       and new.status in ('Offer made','Under contract','Closed') then
      raise exception 'Callers cannot set a lead to "%"; ask your acquisitions rep', new.status;
    end if;
    if tg_op = 'INSERT' and new.status in ('Offer made','Under contract','Closed') then
      raise exception 'Callers cannot create a lead with status "%"', new.status;
    end if;
    if tg_op = 'UPDATE' and (new.assigned_to is distinct from old.assigned_to
       or new.offer_amount is distinct from old.offer_amount
       or new.est_arv is distinct from old.est_arv
       or new.est_repairs is distinct from old.est_repairs) then
      raise exception 'Callers cannot reassign leads or change offer numbers';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists leads_va_guard on public.leads;
create trigger leads_va_guard before insert or update on public.leads
  for each row execute function public.guard_va_lead_update();

-- ---------------------------------------------------------------------
-- TCPA consent records (append-only proof of what the seller agreed to)
-- ---------------------------------------------------------------------
create table if not exists public.consent_records (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  lead_id       uuid references public.leads(id) on delete cascade,
  buyer_id      uuid,
  kind          text not null check (kind in ('seller_tcpa','buyer_alerts')),
  consent_text  text not null,
  phone         text,
  email         text,
  ip_address    text,
  user_agent    text,
  page_url      text
);
create index if not exists consent_lead_idx on public.consent_records (lead_id);

-- ---------------------------------------------------------------------
-- Lead activity log (feeds the Phase 2 KPI dashboard)
-- ---------------------------------------------------------------------
create table if not exists public.lead_activities (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  created_by  uuid references public.profiles(id) on delete set null,
  kind        text not null check (kind in
                ('call','text','email','door','letter','voicemail',
                 'appointment','offer','note','status','system')),
  reached     boolean not null default false,   -- true = a live conversation
  outcome     text,
  notes       text
);
create index if not exists activities_lead_idx on public.lead_activities (lead_id, created_at desc);
create index if not exists activities_created_idx on public.lead_activities (created_at);

-- Status changes are logged automatically.
create or replace function public.log_lead_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_activities (lead_id, created_by, kind, outcome)
    values (new.id, auth.uid(), 'system', 'Lead created (' || coalesce(new.lead_source, 'unknown source') || ')');
  elsif new.status is distinct from old.status then
    insert into public.lead_activities (lead_id, created_by, kind, outcome, notes)
    values (new.id, auth.uid(), 'status', old.status || ' → ' || new.status, new.dead_reason);
  end if;
  if tg_op = 'UPDATE' and new.do_not_call and not old.do_not_call then
    insert into public.lead_activities (lead_id, created_by, kind, outcome)
    values (new.id, auth.uid(), 'system', 'Marked Do Not Call');
  end if;
  return null;
end $$;

drop trigger if exists leads_log_status on public.leads;
create trigger leads_log_status after insert or update on public.leads
  for each row execute function public.log_lead_status();

-- Log a follow-up attempt and move the lead to its next cadence date.
-- p_next_date overrides the cadence (e.g. "call me back Tuesday").
create or replace function public.complete_follow_up(
  p_lead_id   uuid,
  p_kind      text,
  p_reached   boolean,
  p_outcome   text default null,
  p_notes     text default null,
  p_next_date date default null
) returns public.leads
language plpgsql security invoker set search_path = '' as $$
declare
  l public.leads;
  next_step smallint;
  next_date date;
begin
  select * into l from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead not found or not visible to you';
  end if;

  insert into public.lead_activities (lead_id, created_by, kind, reached, outcome, notes)
  values (p_lead_id, auth.uid(), p_kind, coalesce(p_reached, false), p_outcome, p_notes);

  next_step := least(l.follow_up_step + 1, 7);
  if p_next_date is not null then
    next_date := p_next_date;
  elsif next_step <= 6 then
    -- next cadence day; if we're behind, never schedule in the past
    next_date := greatest(l.cadence_start + public.cadence_offset(next_step), current_date + 1);
  else
    -- after day 90: monthly nurture until it's marked Dead or Closed
    next_date := current_date + 30;
  end if;

  update public.leads set
    follow_up_step    = next_step,
    next_follow_up    = case when do_not_call or status in ('Under contract','Closed','Dead')
                             then null else next_date end,
    last_contacted_at = now(),
    status            = case when status = 'New' then 'Contacted' else status end
  where id = p_lead_id
  returning * into l;

  return l;
end $$;

-- ---------------------------------------------------------------------
-- Cash buyers
-- ---------------------------------------------------------------------
create table if not exists public.cash_buyers (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  user_id           uuid unique references auth.users(id) on delete set null,
  created_by        uuid references public.profiles(id) on delete set null,

  name              text not null,
  company           text,
  phone             text,
  email             text,

  -- Buy box
  areas             text[] not null default '{}',   -- ZIPs, cities or neighborhoods
  price_min         numeric(12,2),
  price_max         numeric(12,2),
  property_types    text[] not null default '{}',   -- SFR, Duplex, Multifamily, Townhome, Condo, Land, Mobile
  rehab_levels      text[] not null default '{}',   -- Turnkey, Light, Medium, Heavy
  strategies        text[] not null default '{}',   -- Flip, Hold

  -- Proof of funds
  pof_path          text,
  pof_uploaded_at   timestamptz,
  pof_verified      boolean not null default false,
  pof_amount        numeric(12,2),

  tier              text not null default 'B' check (tier in ('A','B','C')),
  source            text,
  status            text not null default 'Active' check (status in ('Active','Inactive')),
  email_alerts      boolean not null default true,
  sms_consent       boolean not null default false,  -- agreed to calls/texts about deals
  deals_closed      integer not null default 0,
  last_deal_at      date,
  notes             text,

  constraint price_range_ok check (price_min is null or price_max is null or price_min <= price_max)
);

create index if not exists buyers_areas_idx  on public.cash_buyers using gin (areas);
create index if not exists buyers_rehab_idx  on public.cash_buyers using gin (rehab_levels);
create index if not exists buyers_email_idx  on public.cash_buyers (lower(email));
create index if not exists buyers_phone_idx  on public.cash_buyers (regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g'));

drop trigger if exists buyers_touch on public.cash_buyers;
create trigger buyers_touch before update on public.cash_buyers
  for each row execute function public.touch_updated_at();

-- Buyers can edit their own buy box and contact info, but not their tier,
-- proof-of-funds verification, status, or internal notes.
create or replace function public.guard_buyer_self_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.has_role('buyer') then
    if new.tier is distinct from old.tier
       or new.pof_verified is distinct from old.pof_verified
       or new.pof_amount is distinct from old.pof_amount
       or new.status is distinct from old.status
       or new.notes is distinct from old.notes
       or new.deals_closed is distinct from old.deals_closed
       or new.user_id is distinct from old.user_id
       or new.pof_path is distinct from old.pof_path
       or (new.sms_consent and not old.sms_consent) then   -- opting OUT is always allowed
      raise exception 'Buyers can only update their contact info and buy box';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists buyers_self_guard on public.cash_buyers;
create trigger buyers_self_guard before update on public.cash_buyers
  for each row execute function public.guard_buyer_self_update();

alter table public.consent_records
  drop constraint if exists consent_records_buyer_id_fkey;
alter table public.consent_records
  add constraint consent_records_buyer_id_fkey
  foreign key (buyer_id) references public.cash_buyers(id) on delete cascade;

-- ---------------------------------------------------------------------
-- Deal pipeline
-- ---------------------------------------------------------------------
create table if not exists public.deals (
  id                        uuid primary key default gen_random_uuid(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  created_by                uuid references public.profiles(id) on delete set null,
  lead_id                   uuid references public.leads(id) on delete set null,
  acq_rep                   uuid references public.profiles(id) on delete set null,
  dispo_rep                 uuid references public.profiles(id) on delete set null,

  -- Property (copied from the lead so dispositions never needs lead access)
  address                   text not null,
  city                      text,
  zip                       text,
  area                      text,
  property_type             text,
  beds                      numeric(4,1),
  baths                     numeric(4,1),
  sqft                      integer,
  year_built                integer,
  arv                       numeric(12,2),
  repair_estimate           numeric(12,2),
  rehab_level               text check (rehab_level in ('Turnkey','Light','Medium','Heavy')),
  description               text,

  -- Contract & dates
  contract_signed_date      date,
  option_period_end         date,
  closing_date              date,
  contract_price            numeric(12,2),
  earnest_money             numeric(12,2),
  option_fee                numeric(12,2),
  assignment_price          numeric(12,2),     -- what the end buyer pays
  fee                       numeric(12,2) generated always as
                              (assignment_price - contract_price) stored,
  exit_strategy             text not null default 'Assignment'
                              check (exit_strategy in ('Assignment','Double close','Keep')),
  title_company             text,
  title_opened_date         date,
  end_buyer_id              uuid references public.cash_buyers(id) on delete set null,
  buyer_emd                 numeric(12,2),
  buyer_emd_received        boolean not null default false,

  status                    text not null default 'Under contract' check (status in
                              ('Under contract','Marketing','Buyer assigned',
                               'Clear to close','Closed','Cancelled')),
  cancel_reason             text,

  -- Texas equitable-interest disclosures
  seller_disclosure_signed  boolean not null default false,
  seller_disclosure_date    date,
  seller_disclosure_path    text,
  buyer_disclosure_signed   boolean not null default false,
  buyer_disclosure_date     date,
  buyer_disclosure_path     text,

  -- Buyer portal (Phase 2 shows these)
  published_to_portal       boolean not null default false,
  published_at              timestamptz,

  notes                     text,

  constraint seller_disclosure_dated check (not seller_disclosure_signed or seller_disclosure_date is not null),
  constraint buyer_disclosure_dated  check (not buyer_disclosure_signed  or buyer_disclosure_date  is not null)
);

create index if not exists deals_status_idx on public.deals (status);
create index if not exists deals_lead_idx   on public.deals (lead_id);
create index if not exists deals_acq_idx    on public.deals (acq_rep);

drop trigger if exists deals_touch on public.deals;
create trigger deals_touch before update on public.deals
  for each row execute function public.touch_updated_at();

-- THE TWO HARD RULES (plus "never market what you don't have under contract")
create or replace function public.enforce_deal_rules()
returns trigger language plpgsql as $$
begin
  if new.published_to_portal then
    if new.contract_signed_date is null then
      raise exception 'RULE: a deal cannot be published until the purchase contract is signed (contract signed date is empty)'
        using errcode = 'check_violation';
    end if;
    if not new.seller_disclosure_signed then
      raise exception 'RULE: a deal cannot be published to the buyer portal until the seller disclosure is marked signed'
        using errcode = 'check_violation';
    end if;
    if new.status in ('Closed','Cancelled') then
      new.published_to_portal := false;
    end if;
    new.published_at := coalesce(new.published_at, now());
  else
    new.published_at := null;
  end if;

  if new.status in ('Buyer assigned','Clear to close','Closed')
     and new.exit_strategy <> 'Keep' then
    if not new.buyer_disclosure_signed then
      raise exception 'RULE: a deal cannot be marked "%" until the buyer disclosure is marked signed', new.status
        using errcode = 'check_violation';
    end if;
    if new.end_buyer_id is null then
      raise exception 'RULE: choose the end buyer before marking the deal "%"', new.status
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'Cancelled' then
    new.published_to_portal := false;
    new.published_at := null;
  end if;
  return new;
end $$;

drop trigger if exists deals_rules on public.deals;
create trigger deals_rules before insert or update on public.deals
  for each row execute function public.enforce_deal_rules();

-- Keep the lead in step with its deal.
create or replace function public.sync_lead_from_deal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.lead_id is null then return null; end if;
  if tg_op = 'INSERT' and new.status <> 'Cancelled' then
    update public.leads set status = 'Under contract'
      where id = new.lead_id and status not in ('Under contract','Closed');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'Closed' then
      update public.leads set status = 'Closed' where id = new.lead_id;
    elsif new.status = 'Cancelled' then
      -- contract fell through: back into follow-up
      update public.leads set status = 'Follow up', next_follow_up = current_date + 1
        where id = new.lead_id and status = 'Under contract';
    end if;
  end if;
  if new.status = 'Closed' and new.end_buyer_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'Closed') then
    update public.cash_buyers
      set deals_closed = deals_closed + 1,
          last_deal_at = coalesce(new.closing_date, current_date)
      where id = new.end_buyer_id;
  end if;
  return null;
end $$;

drop trigger if exists deals_sync_lead on public.deals;
create trigger deals_sync_lead after insert or update on public.deals
  for each row execute function public.sync_lead_from_deal();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.leads           enable row level security;
alter table public.consent_records enable row level security;
alter table public.lead_activities enable row level security;
alter table public.cash_buyers     enable row level security;
alter table public.deals           enable row level security;

-- Nothing is readable by signed-out visitors.
revoke all on public.profiles, public.leads, public.consent_records,
              public.lead_activities, public.cash_buyers, public.deals from anon;

-- Profiles
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid()
         or public.has_role('owner')
         or (public.has_role('acquisitions','dispositions','va')
             and role not in ('buyer','pending')));
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated
  using (public.has_role('owner') or id = auth.uid())
  with check (public.has_role('owner') or id = auth.uid());

-- Leads: owner = all; acquisitions & VA = leads assigned to them or that
-- they entered, plus unassigned leads (so new web leads get worked).
create or replace function public.can_see_lead(l_assigned uuid, l_created uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('owner')
      or (public.has_role('acquisitions','va')
          and (l_assigned = auth.uid() or l_created = auth.uid() or l_assigned is null))
$$;

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to authenticated
  using (public.can_see_lead(assigned_to, created_by));
drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads for insert to authenticated
  with check (public.has_role('owner','acquisitions','va'));
drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update to authenticated
  using (public.can_see_lead(assigned_to, created_by))
  with check (public.can_see_lead(assigned_to, created_by)
              or public.has_role('acquisitions'));   -- reps may hand a lead to a teammate
drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads for delete to authenticated
  using (public.has_role('owner'));

-- Activities follow lead visibility.
drop policy if exists activities_select on public.lead_activities;
create policy activities_select on public.lead_activities for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
drop policy if exists activities_insert on public.lead_activities;
create policy activities_insert on public.lead_activities for insert to authenticated
  with check (public.has_role('owner','acquisitions','va')
              and exists (select 1 from public.leads l where l.id = lead_id));
drop policy if exists activities_delete on public.lead_activities;
create policy activities_delete on public.lead_activities for delete to authenticated
  using (public.has_role('owner'));

-- Consent records: owner can read; written only by the server.
drop policy if exists consent_owner_read on public.consent_records;
create policy consent_owner_read on public.consent_records for select to authenticated
  using (public.has_role('owner'));

-- Cash buyers: owner & dispositions manage; buyers see/update their own row.
drop policy if exists buyers_select on public.cash_buyers;
create policy buyers_select on public.cash_buyers for select to authenticated
  using (public.has_role('owner','dispositions') or (user_id = auth.uid() and public.has_role('buyer')));
drop policy if exists buyers_insert on public.cash_buyers;
create policy buyers_insert on public.cash_buyers for insert to authenticated
  with check (public.has_role('owner','dispositions'));
drop policy if exists buyers_update on public.cash_buyers;
create policy buyers_update on public.cash_buyers for update to authenticated
  using (public.has_role('owner','dispositions') or (user_id = auth.uid() and public.has_role('buyer')))
  with check (public.has_role('owner','dispositions') or (user_id = auth.uid() and public.has_role('buyer')));
drop policy if exists buyers_delete on public.cash_buyers;
create policy buyers_delete on public.cash_buyers for delete to authenticated
  using (public.has_role('owner'));

-- Deals: owner & dispositions = all; acquisitions = deals they sourced.
drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals for select to authenticated
  using (public.has_role('owner','dispositions')
         or (public.has_role('acquisitions') and (acq_rep = auth.uid() or created_by = auth.uid())));
drop policy if exists deals_insert on public.deals;
create policy deals_insert on public.deals for insert to authenticated
  with check (public.has_role('owner','dispositions')
              or (public.has_role('acquisitions') and acq_rep = auth.uid()));
drop policy if exists deals_update on public.deals;
create policy deals_update on public.deals for update to authenticated
  using (public.has_role('owner','dispositions')
         or (public.has_role('acquisitions') and (acq_rep = auth.uid() or created_by = auth.uid())))
  with check (public.has_role('owner','dispositions')
         or (public.has_role('acquisitions') and (acq_rep = auth.uid() or created_by = auth.uid())));
drop policy if exists deals_delete on public.deals;
create policy deals_delete on public.deals for delete to authenticated
  using (public.has_role('owner'));

-- Function permissions
revoke execute on function public.complete_follow_up(uuid, text, boolean, text, text, date) from public, anon;
grant  execute on function public.complete_follow_up(uuid, text, boolean, text, text, date) to authenticated;

-- ---------------------------------------------------------------------
-- Private storage buckets (no storage policies = no direct access;
-- the server issues short-lived signed links after an RLS check)
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public)
    values ('proof-of-funds', 'proof-of-funds', false),
           ('disclosures',    'disclosures',    false)
    on conflict (id) do nothing;
  end if;
end $$;
