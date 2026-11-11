-- Proof of funds: let the team decline a POF (with a reason) and ask the buyer to resubmit.
-- Status: verified (pof_verified) / declined (pof_declined_at after the last upload) / under review / missing.
-- Safe to run more than once.

alter table public.cash_buyers add column if not exists pof_declined_at timestamptz;
alter table public.cash_buyers add column if not exists pof_decline_reason text;

-- Buyers still can't change their own verification fields.
create or replace function public.guard_buyer_self_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.has_role('buyer') then
    if new.tier is distinct from old.tier
       or new.pof_verified is distinct from old.pof_verified
       or new.pof_amount is distinct from old.pof_amount
       or new.pof_declined_at is distinct from old.pof_declined_at
       or new.pof_decline_reason is distinct from old.pof_decline_reason
       or new.status is distinct from old.status
       or new.notes is distinct from old.notes
       or new.deals_closed is distinct from old.deals_closed
       or new.user_id is distinct from old.user_id
       or new.pof_path is distinct from old.pof_path
       or (new.sms_consent and not old.sms_consent) then   -- opting OUT is always allowed
      raise exception 'Buyers can only update their contact info and buy box';
    end if;
  end if;
  return new;
end $$;
