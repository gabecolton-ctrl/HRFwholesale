\set ON_ERROR_STOP on
\set QUIET on
create or replace function pg_temp.login(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false); $$;
do $$ begin assert (select count(*) from public.scan_markets) = 6, 'six DFW starter markets'; end $$;
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a'); -- owner
do $$ declare mid uuid; begin
  select id into mid from public.scan_markets where city='Dallas';
  insert into public.scan_listings (market_id, rentcast_id, address, zip, price, score, qualified) values (mid, 'rc-1', '742 Secret Ln', '75216', 150000, 72, true);
  insert into public.scan_listings (market_id, rentcast_id, address, zip, price, score, qualified) values (mid, 'rc-1', '742 Secret Ln', '75216', 140000, 80, true)
    on conflict (rentcast_id) do update set price = excluded.price;
  assert (select price from public.scan_listings where rentcast_id='rc-1') = 140000, 'upsert by rentcast id';
  insert into public.scan_runs (market_id, requests) values (mid, 2);
end $$;
select pg_temp.login('00000000-0000-0000-0000-00000000000e'); -- VA
do $$ begin
  assert (select count(*) from public.scan_listings) = 1, 'VA sees listings';
  update public.scan_listings set status='dismissed';
  assert (select status from public.scan_listings limit 1) = 'dismissed', 'VA can dismiss';
  begin insert into public.scan_markets (city, state) values ('X','TX'); raise exception 'FAIL VA added market';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.login('00000000-0000-0000-0000-00000000000d'); -- dispositions
do $$ begin
  assert (select count(*) from public.scan_listings) = 0, 'dispo cannot see scanner';
  assert (select coalesce(sum(requests),0) from public.scan_runs) = 2, 'dispo can count RentCast usage (comps)';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1'); -- buyer
do $$ begin assert (select count(*) from public.scan_listings) = 0 and (select count(*) from public.scan_runs) = 0, 'buyer sees nothing'; end $$;
reset role;
\echo 'ALL SCANNER TESTS PASSED'
