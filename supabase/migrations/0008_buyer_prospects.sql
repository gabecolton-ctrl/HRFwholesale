-- Buyer prospects: cash buyers imported from PropStream (or any list), vetted, then moved into your buyers list.
-- Safe to run more than once.

create table if not exists public.buyer_prospects (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  owner_key       text not null unique,        -- normalized owner name + mailing ZIP (dedupes repeat imports)
  name            text not null,
  is_company      boolean not null default false,
  mailing_address text,
  phones          jsonb not null default '[]'::jsonb,   -- [{number, type, dnc}]
  emails          text[] not null default '{}',
  purchases       integer not null default 0,
  purchases_12mo  integer not null default 0,
  last_purchase   date,
  price_min       numeric(12,2),
  price_max       numeric(12,2),
  avg_price       numeric(12,2),
  zips            text[] not null default '{}',
  cities          text[] not null default '{}',
  property_types  text[] not null default '{}',
  properties      jsonb not null default '[]'::jsonb,   -- up to 25 recent purchases
  score           integer not null default 0,
  suggested_tier  text not null default 'C' check (suggested_tier in ('A','B','C')),
  source_file     text,
  status          text not null default 'new' check (status in ('new','added','rejected')),
  buyer_id        uuid references public.cash_buyers(id) on delete set null
);
create index if not exists buyer_prospects_q_idx on public.buyer_prospects (status, score desc);

alter table public.buyer_prospects enable row level security;
drop policy if exists prospects_rw on public.buyer_prospects;
create policy prospects_rw on public.buyer_prospects for all to authenticated
  using (public.has_role('owner','dispositions')) with check (public.has_role('owner','dispositions'));
grant select, insert, update, delete on public.buyer_prospects to authenticated;
