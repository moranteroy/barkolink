-- Fill only placeholder promo descriptions. Preserve codes, financial terms,
-- dates, activation, claims and bookings. Claimed missions keep their saved rules.
do $$
declare offer public.voucher; reserved integer; promo_title text; mission integer;
begin
  for offer in select * from public.voucher where title='Travel promo' and description='' order by id for update loop
    if offer.owner_uid is not null then
      update public.voucher set title='Personal loyalty reward',description='Earned from completed, paid trips. Reserved for the passenger account that earned this reward.' where id=offer.id;
      continue;
    end if;
    reserved:=barkolink_private.voucher_allocations(offer.id);mission:=offer.required_trips;
    if offer.usage_limit=1 then promo_title:='Limited-slot travel treat';
    elsif offer.discount_type='FIXED' and reserved=0 and offer.is_active and offer.expires_at>now() then
      promo_title:='Frequent sailor bonus';
      if offer.claimable then mission:=3; end if;
    elsif not offer.is_active and offer.expires_at>now() then
      promo_title:='Frequent traveler preview';
      if offer.claimable and reserved=0 then mission:=5; end if;
    elsif offer.discount_type='PERCENT' then promo_title:='Sailing saver';
    else promo_title:='Regular fare saver'; end if;
    update public.voucher set title=promo_title,
      description=case when offer.discount_type='PERCENT' then 'Save '||offer.value||'% on eligible regular passenger fares.'
        else 'Save PHP '||offer.value||' on eligible regular passenger fares.' end,
      required_trips=mission where id=offer.id;
  end loop;
end $$;
