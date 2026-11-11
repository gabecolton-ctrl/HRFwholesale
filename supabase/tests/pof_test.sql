\set ON_ERROR_STOP on
\set QUIET on
create or replace function pg_temp.login(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false); $$;
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000d'); -- dispositions declines
do $$ begin
  update public.cash_buyers set pof_declined_at = now(), pof_decline_reason = 'Too old' where id = '40000000-0000-0000-0000-000000000001';
  assert (select pof_decline_reason from public.cash_buyers where id = '40000000-0000-0000-0000-000000000001') = 'Too old', 'team can decline';
end $$;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1'); -- that buyer
do $$ begin
  begin
    update public.cash_buyers set pof_declined_at = null, pof_decline_reason = null where user_id = '00000000-0000-0000-0000-0000000000b1';
    raise exception 'FAIL buyer cleared decline';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  update public.cash_buyers set phone = '2145550000' where user_id = '00000000-0000-0000-0000-0000000000b1';
end $$;
reset role;
\echo 'ALL POF TESTS PASSED'
