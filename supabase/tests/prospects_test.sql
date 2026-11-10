\set ON_ERROR_STOP on
\set QUIET on
create or replace function pg_temp.login(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false); $$;
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000d'); -- dispositions
do $$ begin
  insert into public.buyer_prospects (owner_key, name, purchases, score) values ('OAK|75201', 'Oak Cliff Homes LLC', 3, 90);
  insert into public.buyer_prospects (owner_key, name, purchases, score) values ('OAK|75201', 'Oak Cliff Homes LLC', 4, 95)
    on conflict (owner_key) do update set purchases = excluded.purchases, score = excluded.score;
  update public.buyer_prospects set status = 'rejected';
  insert into public.buyer_prospects (owner_key, name, purchases, score) values ('OAK|75201', 'Oak Cliff Homes LLC', 5, 99)
    on conflict (owner_key) do update set purchases = excluded.purchases, score = excluded.score;
  assert (select purchases from public.buyer_prospects) = 5, 're-import updates numbers';
  assert (select status from public.buyer_prospects) = 'rejected', 're-import keeps your decision';
end $$;
select pg_temp.login('00000000-0000-0000-0000-00000000000e'); -- VA
do $$ begin assert (select count(*) from public.buyer_prospects) = 0, 'VA cannot see prospects'; end $$;
select pg_temp.login('00000000-0000-0000-0000-00000000000b'); -- acquisitions
do $$ begin assert (select count(*) from public.buyer_prospects) = 0, 'acquisitions cannot see prospects'; end $$;
select pg_temp.login('00000000-0000-0000-0000-00000000000a'); -- owner
do $$ begin assert (select count(*) from public.buyer_prospects) = 1, 'owner sees prospects'; end $$;
reset role;
\echo 'ALL PROSPECT TESTS PASSED'
