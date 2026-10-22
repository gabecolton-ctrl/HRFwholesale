-- =====================================================================
-- H.R.F Assets LLC — nationwide buying
-- Adds a State to deals, shows it in the buyer portal, and lets buyers
-- list states (e.g. "TX" or "Texas") in their buy box.
-- Run AFTER 0002_phase2.sql. Safe to run more than once.
-- =====================================================================

alter table public.deals add column if not exists state text not null default 'TX';

-- Copy the state from the seller lead onto existing deals.
update public.deals d set state = upper(l.state)
from public.leads l
where l.id = d.lead_id and coalesce(l.state, '') <> '' and d.state is distinct from upper(l.state);

create or replace function public.state_name(code text)
returns text language sql immutable as $$
  select case upper(coalesce(code, ''))
    when 'AL' then 'Alabama'
    when 'AK' then 'Alaska'
    when 'AZ' then 'Arizona'
    when 'AR' then 'Arkansas'
    when 'CA' then 'California'
    when 'CO' then 'Colorado'
    when 'CT' then 'Connecticut'
    when 'DE' then 'Delaware'
    when 'DC' then 'District of Columbia'
    when 'FL' then 'Florida'
    when 'GA' then 'Georgia'
    when 'HI' then 'Hawaii'
    when 'ID' then 'Idaho'
    when 'IL' then 'Illinois'
    when 'IN' then 'Indiana'
    when 'IA' then 'Iowa'
    when 'KS' then 'Kansas'
    when 'KY' then 'Kentucky'
    when 'LA' then 'Louisiana'
    when 'ME' then 'Maine'
    when 'MD' then 'Maryland'
    when 'MA' then 'Massachusetts'
    when 'MI' then 'Michigan'
    when 'MN' then 'Minnesota'
    when 'MS' then 'Mississippi'
    when 'MO' then 'Missouri'
    when 'MT' then 'Montana'
    when 'NE' then 'Nebraska'
    when 'NV' then 'Nevada'
    when 'NH' then 'New Hampshire'
    when 'NJ' then 'New Jersey'
    when 'NM' then 'New Mexico'
    when 'NY' then 'New York'
    when 'NC' then 'North Carolina'
    when 'ND' then 'North Dakota'
    when 'OH' then 'Ohio'
    when 'OK' then 'Oklahoma'
    when 'OR' then 'Oregon'
    when 'PA' then 'Pennsylvania'
    when 'RI' then 'Rhode Island'
    when 'SC' then 'South Carolina'
    when 'SD' then 'South Dakota'
    when 'TN' then 'Tennessee'
    when 'TX' then 'Texas'
    when 'UT' then 'Utah'
    when 'VT' then 'Vermont'
    when 'VA' then 'Virginia'
    when 'WA' then 'Washington'
    when 'WV' then 'West Virginia'
    when 'WI' then 'Wisconsin'
    when 'WY' then 'Wyoming'
  end
$$;

drop function if exists public.portal_deals();
create or replace function public.portal_deals()
returns table (
  id uuid, status text, area text, city text, state text, zip text, property_type text,
  beds numeric, baths numeric, sqft integer, year_built integer,
  arv numeric, repair_estimate numeric, rehab_level text, list_price numeric,
  closing_date date, description text, photo_paths text[], comps jsonb,
  published_at timestamptz, acknowledged boolean, address text
)
language sql stable security definer set search_path = '' as $$
  select d.id,
         case when d.status in ('Under contract','Marketing') then 'Available' else 'Pending' end,
         d.area, d.city, d.state, d.zip, d.property_type, d.beds, d.baths, d.sqft, d.year_built,
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

revoke execute on function public.portal_deals() from public, anon;
grant execute on function public.portal_deals() to authenticated;

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
          where lower(trim(a)) in (lower(coalesce(d.zip,'')), lower(coalesce(d.city,'')), lower(coalesce(d.area,'')), lower(coalesce(d.state,'')), lower(coalesce(public.state_name(d.state),'')))
             or (length(trim(a)) >= 4 and lower(coalesce(d.area,'') || ' ' || coalesce(d.city,'') || ' ' || coalesce(public.state_name(d.state),'')) like '%' || lower(trim(a)) || '%')))
    and (d.price is null or ((b.price_min is null or d.price >= b.price_min) and (b.price_max is null or d.price <= b.price_max)))
    and (cardinality(b.rehab_levels) = 0 or d.rehab_level is null or d.rehab_level = any(b.rehab_levels))
    and (cardinality(b.property_types) = 0 or d.property_type is null or d.property_type = any(b.property_types))
  order by b.tier, b.deals_closed desc, b.name
$$;
revoke execute on function public.matching_buyers(uuid) from public, anon, authenticated;
grant execute on function public.matching_buyers(uuid) to service_role;
