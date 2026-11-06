-- Owner lookups: owner/acquisitions/VA can read+insert; dispositions and buyers cannot.
\set ON_ERROR_STOP on
\set QUIET on
create or replace function pg_temp.login(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false); $$;

set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000e'); -- VA
do $$ begin
  insert into public.property_lookups (address_key, credits) values ('1 main st|dallas|tx', 10);
  assert (select count(*) from public.property_lookups) = 1, 'VA reads lookups';
end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000d'); -- dispositions
do $$ begin
  assert (select count(*) from public.property_lookups) = 0, 'dispo cannot read owner lookups';
  begin
    insert into public.property_lookups (address_key) values ('x');
    raise exception 'FAIL dispo inserted';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000b1'); -- buyer
do $$ begin
  assert (select count(*) from public.property_lookups) = 0, 'buyer cannot read owner lookups';
end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000a'); -- owner
do $$ begin
  assert (select count(*) from public.property_lookups) = 1, 'owner reads lookups';
  update public.leads set property_data = '{"x":1}' where id = (select id from public.leads limit 1);
end $$;
reset role;
\echo 'ALL LOOKUP TESTS PASSED'
