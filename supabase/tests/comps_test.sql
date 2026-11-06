-- Comps lookups: staff can read/insert, VA and buyers cannot.
\set ON_ERROR_STOP on
\set QUIET on
create or replace function pg_temp.login(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false); $$;

set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000b'); -- acquisitions
do $$ begin
  insert into public.comp_lookups (address_key, query, result) values ('1 main st|75201', '{"address":"1 Main St"}', '{"price":200000}');
  assert (select count(*) from public.comp_lookups) = 1, 'acquisitions reads lookups';
  assert (select created_by from public.comp_lookups limit 1) = '00000000-0000-0000-0000-00000000000b', 'created_by defaults to user';
  begin
    insert into public.comp_lookups (address_key, created_by) values ('x', '00000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL spoofed created_by';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000e'); -- VA
do $$ begin
  assert (select count(*) from public.comp_lookups) = 0, 'VA cannot read lookups';
  begin
    insert into public.comp_lookups (address_key) values ('x');
    raise exception 'FAIL VA inserted';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000b1'); -- buyer
do $$ begin
  assert (select count(*) from public.comp_lookups) = 0, 'buyer cannot read lookups';
end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000d'); -- dispositions
do $$ begin
  assert (select count(*) from public.comp_lookups) = 1, 'dispo reads lookups';
end $$;
reset role;
\echo 'ALL COMPS TESTS PASSED'
