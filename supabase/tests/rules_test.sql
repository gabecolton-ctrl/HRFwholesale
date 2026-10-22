-- Automated checks for the Phase 1 database rules and role security.
-- Every check raises an error (and stops the run) if a rule is broken.
\set ON_ERROR_STOP on
\set QUIET on

-- ---------- setup (as superuser = server/service role) ----------
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','owner@hrf.test','{"full_name":"Gabriel"}'),
 ('00000000-0000-0000-0000-00000000000b','acq@hrf.test','{}'),
 ('00000000-0000-0000-0000-00000000000c','acq2@hrf.test','{}'),
 ('00000000-0000-0000-0000-00000000000d','dispo@hrf.test','{}'),
 ('00000000-0000-0000-0000-00000000000e','va@hrf.test','{}'),
 ('00000000-0000-0000-0000-00000000000f','buyer@hrf.test','{"full_name":"Bob Buyer"}'),
 ('00000000-0000-0000-0000-000000000010','rando@hrf.test','{"role":"owner"}');

do $$ begin
  assert (select count(*) from public.profiles) = 7, 'profiles auto-created';
  assert (select role from public.profiles where email='rando@hrf.test') = 'pending',
         'self-declared role in metadata is ignored';
end $$;

update public.profiles set role='owner'        where email='owner@hrf.test';
update public.profiles set role='acquisitions' where email in ('acq@hrf.test','acq2@hrf.test');
update public.profiles set role='dispositions' where email='dispo@hrf.test';
update public.profiles set role='va'           where email='va@hrf.test';
update public.profiles set role='buyer'        where email='buyer@hrf.test';

-- web lead (server inserts, unassigned)
insert into public.leads (id, seller_name, phone, address, zip, lead_source, condition, timeline)
values ('10000000-0000-0000-0000-000000000001','Web Seller','2145550100','123 N. Main St.','75201','Website','Needs work','ASAP');
-- lead assigned to acq2
insert into public.leads (id, seller_name, address, zip, assigned_to, lead_source)
values ('10000000-0000-0000-0000-000000000002','Other Rep Seller','9 Elm','75217','00000000-0000-0000-0000-00000000000c','Probate');
-- buyer row linked to the buyer login
insert into public.cash_buyers (id, user_id, name, areas, price_min, price_max, rehab_levels, strategies)
values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000f','Bob Buyer',
        '{75217,75216}',80000,200000,'{Light,Medium}','{Flip}');
insert into public.cash_buyers (id, name, areas) values ('20000000-0000-0000-0000-000000000002','Other Buyer','{75201}');

do $$
declare l public.leads;
begin
  select * into l from public.leads where id='10000000-0000-0000-0000-000000000001';
  assert l.next_follow_up = current_date + 3, 'new lead gets day-3 follow-up, got ' || l.next_follow_up;
  assert l.address_key = '123nmainst75201', 'address key normalized: ' || l.address_key;
  assert l.status = 'New';
  assert (select count(*) from public.lead_activities where lead_id = l.id) = 1, 'creation logged';
end $$;

-- ---------- switch to signed-in users ----------
create or replace function pg_temp.login(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false); $$;

-- ===== ANON: sees nothing =====
set role anon;
do $$ begin
  begin
    perform count(*) from public.leads;
    raise exception 'FAIL anon read leads';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ===== PENDING user (self-declared owner) sees nothing =====
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-000000000010');
do $$ begin
  assert (select count(*) from public.leads) = 0, 'pending sees no leads';
  assert (select count(*) from public.cash_buyers) = 0, 'pending sees no buyers';
  assert (select count(*) from public.deals) = 0, 'pending sees no deals';
  begin
    update public.profiles set role='owner' where id = auth.uid();
    raise exception 'FAIL pending self-promoted';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- ===== VA =====
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
do $$
declare l public.leads;
begin
  assert (select count(*) from public.leads) = 1, 'VA sees unassigned web lead only, not acq2''s lead';
  assert (select count(*) from public.cash_buyers) = 0, 'VA cannot see buyers';
  assert (select count(*) from public.deals) = 0, 'VA cannot see deals';
  assert (select count(*) from public.profiles where role='buyer') = 0, 'VA cannot see buyer profiles';

  -- VA logs a follow-up: cadence advances to day 7
  l := public.complete_follow_up('10000000-0000-0000-0000-000000000001','call',true,'Talked, wants offer',null,null);
  assert l.follow_up_step = 2, 'step advanced';
  assert l.next_follow_up = current_date + 7, 'day-7 follow-up, got ' || l.next_follow_up;
  assert l.status = 'Contacted', 'New → Contacted after first touch';

  -- VA may set Appointment set but not Offer made
  update public.leads set status='Appointment set' where id='10000000-0000-0000-0000-000000000001';
  begin
    update public.leads set status='Offer made' where id='10000000-0000-0000-0000-000000000001';
    raise exception 'FAIL VA set Offer made';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    delete from public.leads where id='10000000-0000-0000-0000-000000000001';
    if found then raise exception 'FAIL VA deleted a lead'; end if;
  end;

  -- VA enters a lead
  insert into public.leads (seller_name, address, lead_source, created_by)
  values ('VA Entered','55 Oak','Driving for dollars', auth.uid());
end $$;

-- ===== ACQUISITIONS rep A =====
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.leads) = 2, 'acq sees unassigned leads (web + VA-entered), not acq2''s: ' || (select count(*) from public.leads);
  assert (select count(*) from public.cash_buyers) = 0, 'acq cannot see buyers list';
  -- claims the web lead and makes an offer
  update public.leads set assigned_to = auth.uid(), status='Offer made', offer_amount=95000,
         low_rate_loan = true
   where id='10000000-0000-0000-0000-000000000001';
  assert (select keep_candidate from public.leads where id='10000000-0000-0000-0000-000000000001'),
         'keep candidate auto-flagged from low-rate loan';
  assert (select offer_date from public.leads where id='10000000-0000-0000-0000-000000000001') = current_date;

  -- puts it under contract
  insert into public.deals (id, lead_id, acq_rep, created_by, address, zip, contract_signed_date,
                            option_period_end, closing_date, contract_price, arv, repair_estimate)
  values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
          auth.uid(), auth.uid(), '123 N. Main St.', '75201', current_date, current_date+10,
          current_date+30, 95000, 200000, 35000);
  assert (select status from public.leads where id='10000000-0000-0000-0000-000000000001') = 'Under contract',
         'lead moves to Under contract when deal created';
  assert (select next_follow_up from public.leads where id='10000000-0000-0000-0000-000000000001') is null,
         'under-contract lead leaves follow-up queue';
end $$;

-- acq2 cannot see acq's deal
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from public.deals) = 0, 'acq2 cannot see another rep''s deal';
  assert (select count(*) from public.leads where id='10000000-0000-0000-0000-000000000001') = 0,
         'acq2 cannot see lead assigned to acq';
end $$;

-- ===== DISPOSITIONS =====
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from public.deals) = 1, 'dispo sees pipeline';
  assert (select count(*) from public.leads) = 0, 'dispo cannot see seller leads';
  assert (select count(*) from public.cash_buyers) = 2, 'dispo sees all buyers';

  -- RULE 1: cannot publish without seller disclosure
  begin
    update public.deals set published_to_portal = true where id='30000000-0000-0000-0000-000000000001';
    raise exception 'FAIL published without seller disclosure';
  exception when check_violation then null; end;

  -- signed without a date is rejected
  begin
    update public.deals set seller_disclosure_signed = true where id='30000000-0000-0000-0000-000000000001';
    raise exception 'FAIL signed with no date';
  exception when check_violation then null; end;

  update public.deals set seller_disclosure_signed = true, seller_disclosure_date = current_date,
                          published_to_portal = true, status = 'Marketing'
   where id='30000000-0000-0000-0000-000000000001';
  assert (select published_at from public.deals where id='30000000-0000-0000-0000-000000000001') is not null;

  -- RULE 2: cannot mark Buyer assigned without buyer disclosure
  begin
    update public.deals set status='Buyer assigned', end_buyer_id='20000000-0000-0000-0000-000000000001',
                            assignment_price = 110000
     where id='30000000-0000-0000-0000-000000000001';
    raise exception 'FAIL buyer assigned without buyer disclosure';
  exception when check_violation then null; end;

  -- ... and cannot skip ahead to Closed either
  begin
    update public.deals set status='Closed', end_buyer_id='20000000-0000-0000-0000-000000000001'
     where id='30000000-0000-0000-0000-000000000001';
    raise exception 'FAIL closed without buyer disclosure';
  exception when check_violation then null; end;

  -- needs an end buyer too
  begin
    update public.deals set status='Buyer assigned', buyer_disclosure_signed=true, buyer_disclosure_date=current_date
     where id='30000000-0000-0000-0000-000000000001';
    raise exception 'FAIL buyer assigned without end buyer';
  exception when check_violation then null; end;

  update public.deals set status='Buyer assigned', end_buyer_id='20000000-0000-0000-0000-000000000001',
                          buyer_disclosure_signed=true, buyer_disclosure_date=current_date,
                          assignment_price = 110000
   where id='30000000-0000-0000-0000-000000000001';
  assert (select fee from public.deals where id='30000000-0000-0000-0000-000000000001') = 15000, 'fee computed';

  update public.deals set status='Closed' where id='30000000-0000-0000-0000-000000000001';
  assert (select published_to_portal from public.deals where id='30000000-0000-0000-0000-000000000001') = false,
         'closed deal comes off the portal';
  assert (select deals_closed from public.cash_buyers where id='20000000-0000-0000-0000-000000000001') = 1,
         'buyer deal count updated';
end $$;

-- ===== OWNER =====
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from public.leads) = 3, 'owner sees all leads';
  assert (select status from public.leads where id='10000000-0000-0000-0000-000000000001') = 'Closed',
         'lead closed with the deal';
  assert (select count(*) from public.consent_records) = 0;
  -- Do Not Call removes from queue
  update public.leads set do_not_call = true where id='10000000-0000-0000-0000-000000000002';
  assert (select next_follow_up from public.leads where id='10000000-0000-0000-0000-000000000002') is null,
         'DNC leaves queue';
  update public.leads set do_not_call = false where id='10000000-0000-0000-0000-000000000002';
  assert (select next_follow_up from public.leads where id='10000000-0000-0000-0000-000000000002') is not null,
         'un-DNC gets a follow-up date again';
  -- owner cannot demote themselves
  begin
    update public.profiles set role='va' where id = auth.uid();
    raise exception 'FAIL owner self-demoted';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  -- owner can promote
  update public.profiles set role='acquisitions' where email='rando@hrf.test';
end $$;

-- ===== BUYER =====
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
do $$ begin
  assert (select count(*) from public.cash_buyers) = 1, 'buyer sees only own row';
  assert (select count(*) from public.leads) = 0 and (select count(*) from public.deals) = 0,
         'buyer sees no CRM data';
  update public.cash_buyers set areas = '{75217,75216,75241}' where user_id = auth.uid();
  update public.cash_buyers set sms_consent = false where user_id = auth.uid();  -- opt-out allowed
  begin
    update public.cash_buyers set tier='A', pof_verified=true where user_id = auth.uid();
    raise exception 'FAIL buyer self-verified';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

reset role;

-- ===== Cadence end-to-end =====
do $$
declare l public.leads; i int;
begin
  insert into public.leads (id, seller_name, address, cadence_start)
  values ('10000000-0000-0000-0000-000000000009','Cadence Test','1 Test', current_date - 200);
  -- behind schedule: next date never lands in the past
  l := public.complete_follow_up('10000000-0000-0000-0000-000000000009','text',false);
  assert l.next_follow_up = current_date + 1, 'overdue lead scheduled for tomorrow, got ' || l.next_follow_up;
  for i in 1..6 loop
    l := public.complete_follow_up('10000000-0000-0000-0000-000000000009','call',false);
  end loop;
  assert l.follow_up_step = 7 and l.next_follow_up = current_date + 30, 'monthly nurture after day 90';
  l := public.complete_follow_up('10000000-0000-0000-0000-000000000009','call',true,null,null,current_date + 2);
  assert l.next_follow_up = current_date + 2, 'manual callback date respected';
end $$;

\echo 'ALL RULE TESTS PASSED'
