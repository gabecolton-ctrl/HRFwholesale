-- Distress inbox: roles, dedupe, starter Dallas feed.
\set ON_ERROR_STOP on
\set QUIET on
create or replace function pg_temp.login(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false); $$;

do $$ begin
  assert (select count(*) from public.signal_feeds where dataset_id = 'd7e7-envw') = 1, 'Dallas starter feed seeded once';
end $$;

set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a'); -- owner
do $$
declare fid uuid;
begin
  select id into fid from public.signal_feeds limit 1;
  insert into public.distress_signals (source, feed_id, source_id, signal_type, address, city, state, zip)
  values ('feed', fid, 'SR-1', 'High Weeds', '742 Secret Ln', 'Dallas', 'TX', '75216');
  insert into public.distress_signals (source, feed_id, source_id, signal_type, address, city, state, zip)
  values ('feed', fid, 'SR-1', 'High Weeds', '742 Secret Ln', 'Dallas', 'TX', '75216')
  on conflict (feed_id, source_id) do nothing;
  assert (select count(*) from public.distress_signals) = 1, 'duplicate feed record skipped';
  assert (select address_key from public.distress_signals limit 1) = public.address_key('742 Secret Ln','75216'), 'address key matches leads';
  insert into public.lead_lists (name, strategy, geography, requested_count) values ('t', 'custom', '{"mode":"states","states":["TX"]}', 10);
end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000e'); -- VA
do $$ begin
  assert (select count(*) from public.distress_signals) = 1, 'VA sees inbox';
  update public.distress_signals set status = 'dismissed';
  assert (select status from public.distress_signals limit 1) = 'dismissed', 'VA can dismiss';
  assert (select count(*) from public.lead_lists) = 0, 'VA cannot see paid lists';
  begin
    insert into public.lead_lists (name, strategy, geography, requested_count) values ('x','custom','{}',1);
    raise exception 'FAIL VA bought list';
  exception when insufficient_privilege then null; end;
  begin
    update public.signal_feeds set active = false;
    if found then raise exception 'FAIL VA edited feed'; end if;
  end;
end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000d'); -- dispositions
do $$ begin
  assert (select count(*) from public.distress_signals) = 0, 'dispo cannot see inbox';
end $$;

select pg_temp.login('00000000-0000-0000-0000-0000000000b1'); -- buyer
do $$ begin
  assert (select count(*) from public.distress_signals) = 0, 'buyer cannot see inbox';
  assert (select count(*) from public.signal_feeds) = 0, 'buyer cannot see feeds';
end $$;
reset role;
\echo 'ALL DISTRESS TESTS PASSED'
