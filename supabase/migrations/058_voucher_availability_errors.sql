-- Report voucher availability before asking for a claim; all quote and booking
-- eligibility rules continue through the existing validator.
create or replace function barkolink_private.voucher_quote(args jsonb,actor text) returns jsonb
language plpgsql set search_path='' as $$
declare offer public.voucher; claimed boolean;
begin
  select * into offer from public.voucher where code=upper(trim(args->>'voucherCode'));
  if offer.owner_uid is not null and offer.owner_uid is distinct from actor then
    raise exception 'This loyalty voucher belongs to another passenger.' using errcode='42501';
  end if;
  if found then
    if now()>=offer.expires_at then raise exception 'This voucher has expired. Choose another voucher.';end if;
    if now()<offer.starts_at then raise exception 'This voucher is not available yet. Check its start date.';end if;
    if not offer.is_active then raise exception 'This voucher is inactive. Choose another voucher.';end if;
    if offer.claimable then
      select exists(select 1 from public.voucher_claim c where c.voucher_id=offer.id and c.owner_uid=actor) into claimed;
      if not claimed then raise exception 'Claim this voucher on the Claim vouchers page before using it.';end if;
    end if;
  end if;
  return barkolink_private.voucher_quote_v25(args,actor);
end $$;
revoke all on function barkolink_private.voucher_quote(jsonb,text) from public,anon,authenticated;
