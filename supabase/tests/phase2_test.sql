-- Phase 2 checks: buyer portal privacy, disclosure gate, offers, matching, KPIs.
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false); $$;

-- setup as server
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000b1','b1@hrf.test'),
 ('00000000-0000-0000-0000-0000000000b2','b2@hrf.test')
on conflict do nothing;
update public.profiles set role='buyer' where email in ('b1@hrf.test','b2@hrf.test');

insert into public.cash_buyers (id, user_id, name, email, areas, price_min, price_max, rehab_levels, property_types, tier) values
 ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','Oak Cliff Flipper','b1@hrf.test','{75216,Oak Cliff}',80000,180000,'{Medium,Heavy}','{Single family}','A'),
 ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b2','Plano Holder','b2@hrf.test','{75024}',200000,400000,'{Turnkey}','{}','B'),
 ('40000000-0000-0000-0000-000000000003',null,'Anywhere Buyer','any@hrf.test','{}',null,null,'{}','{}','C'),
 ('40000000-0000-0000-0000-000000000004',null,'Opted Out','out@hrf.test','{}',null,null,'{}','{}','A');
update public.cash_buyers set email_alerts=false where id='40000000-0000-0000-0000-000000000004';

insert into public.deals (id, address, city, zip, area, property_type, rehab_level, contract_signed_date,
                          contract_price, assignment_price, list_price, arv, repair_estimate,
                          seller_disclosure_signed, seller_disclosure_date, published_to_portal, status,
                          comps, photo_paths)
values
 ('50000000-0000-0000-0000-000000000001','742 Secret Ln','Dallas','75216','Oak Cliff','Single family','Medium',current_date,
  90000, null, 125000, 210000, 40000, true, current_date, true, 'Marketing',
  '[{"address":"1 Comp St","sold_price":205000}]', '{p1.jpg}'),
 ('50000000-0000-0000-0000-000000000002','9 Hidden Ct','Dallas','75216','Oak Cliff','Single family','Medium',current_date,
  80000, null, 110000, 190000, 30000, false, null, false, 'Under contract', '[]', '{}');

-- ===== matching =====
do $$
declare ids uuid[];
begin
  select array_agg(buyer_id order by tier) into ids from public.matching_buyers('50000000-0000-0000-0000-000000000001');
  assert ids = array['40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003']::uuid[],
    'matches Oak Cliff flipper + anywhere buyer only (not Plano, not opted out): ' || coalesce(ids::text, 'none');
end $$;

-- ===== buyer b1 =====
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
do $$
declare r record; n int;
begin
  -- no direct table access to deals, other buyers, offers of others
  assert (select count(*) from public.deals) = 0, 'buyer cannot read deals table';
  assert (select count(*) from public.cash_buyers) = 1, 'buyer sees only own buyer row';

  select count(*) into n from public.portal_deals();
  assert n = 1, 'only the published deal is listed, got ' || n;
  select * into r from public.portal_deals() limit 1;
  assert r.address is null, 'address hidden before acknowledgment';
  assert r.list_price = 125000 and r.status = 'Available', 'list price + status shown';

  -- cannot submit interest before acknowledging
  begin
    perform public.submit_deal_interest('50000000-0000-0000-0000-000000000001','interest');
    raise exception 'FAIL interest before ack';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;

  -- cannot acknowledge an unpublished deal
  begin
    perform public.acknowledge_deal('50000000-0000-0000-0000-000000000002','x');
    raise exception 'FAIL ack unpublished';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;

  perform public.acknowledge_deal('50000000-0000-0000-0000-000000000001','H.R.F Assets LLC is assigning…','1.2.3.4','test');
  select * into r from public.portal_deals() limit 1;
  assert r.address = '742 Secret Ln' and r.acknowledged, 'address revealed after acknowledgment';

  -- offer needs an amount
  begin
    perform public.submit_deal_interest('50000000-0000-0000-0000-000000000001','offer');
    raise exception 'FAIL offer without amount';
  exception when check_violation then null; end;

  perform public.submit_deal_interest('50000000-0000-0000-0000-000000000001','offer',120000,current_date+21,'Cash, 14 day close');
  assert (select count(*) from public.portal_my_offers()) = 1, 'buyer sees own offer';
  assert (select count(*) from public.deal_offers) = 1, 'buyer reads own offer row';

  -- dashboard functions return nothing useful for a buyer (RLS)
  assert (select coalesce(sum(contracts),0) from public.dashboard_weeks(4)) = 0, 'buyer sees no KPI data';

  -- cannot call matching (server-only)
  begin
    perform public.matching_buyers('50000000-0000-0000-0000-000000000001');
    raise exception 'FAIL buyer ran matching';
  exception when insufficient_privilege then null; end;
end $$;

-- ===== buyer b2: does not see b1's acknowledgment or offer =====
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
do $$
declare r record;
begin
  select * into r from public.portal_deals() limit 1;
  assert r.address is null, 'b2 still needs to acknowledge';
  assert (select count(*) from public.deal_offers) = 0, 'b2 cannot see b1 offer';
  assert (select count(*) from public.deal_acknowledgments) = 0, 'b2 cannot see b1 ack';
end $$;

-- ===== deactivated buyer sees nothing =====
reset role;
select pg_temp.login('');
update public.cash_buyers set status='Inactive' where id='40000000-0000-0000-0000-000000000002';
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  assert (select count(*) from public.portal_deals()) = 0, 'inactive buyer sees no listings';
end $$;

-- ===== dispositions sees offers; VA does not =====
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from public.deal_offers) = 1, 'dispo sees offers';
  update public.deal_offers set status='Reviewed';
end $$;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
do $$ begin
  assert (select count(*) from public.deal_offers) = 0, 'VA cannot see offers';
  assert (select count(*) from public.marketing_spend) = 0;
  begin
    update public.app_settings set default_mao_pct = 90;
    if found then raise exception 'FAIL VA changed settings'; end if;
  end;
end $$;

-- ===== owner KPIs =====
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
do $$
declare w record;
begin
  update public.app_settings set default_mao_pct = 72;
  insert into public.marketing_spend (month, lead_source, amount) values (date_trunc('month', current_date)::date, 'Probate', 300);
  select * into w from public.dashboard_weeks(2) limit 1;  -- this week
  assert w.contracts >= 3, 'contracts this week counted: ' || w.contracts;
  assert w.outreach >= 1 and w.conversations >= 1, 'outreach/conversations counted';
  assert (select count(*) from public.dashboard_months(date_trunc('month', current_date)::date, 3)) = 3, 'three months returned';
  assert (select spend from public.dashboard_sources(current_date - 30, current_date) where lead_source = 'Probate') = 300, 'spend by source';
end $$;
reset role;

-- ===== nationwide: state on deals, state in buy box =====
select pg_temp.login('');
insert into public.cash_buyers (id, name, email, areas) values ('40000000-0000-0000-0000-000000000009','Ohio Buyer','oh@hrf.test','{Ohio}');
insert into public.deals (id, address, city, state, zip, contract_signed_date, list_price, seller_disclosure_signed, seller_disclosure_date, published_to_portal, status)
values ('50000000-0000-0000-0000-000000000009','5 Lake Rd','Columbus','OH','43201',current_date,90000,true,current_date,true,'Marketing');
do $$ begin
  assert exists (select 1 from public.matching_buyers('50000000-0000-0000-0000-000000000009') where buyer_id = '40000000-0000-0000-0000-000000000009'),
    'buyer listing "Ohio" matches an OH deal';
  assert not exists (select 1 from public.matching_buyers('50000000-0000-0000-0000-000000000001') where buyer_id = '40000000-0000-0000-0000-000000000009'),
    'Ohio buyer does not match a Texas deal';
end $$;
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  assert (select state from public.portal_deals() where id = '50000000-0000-0000-0000-000000000009') = 'OH', 'portal shows state';
end $$;
reset role;

\echo 'ALL PHASE 2 TESTS PASSED'
