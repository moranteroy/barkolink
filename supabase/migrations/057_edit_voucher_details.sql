create function barkolink_private.update_voucher_details(args jsonb,actor_uid text,actor_role text) returns jsonb
language plpgsql set search_path='' as $$
declare offer public.voucher; reserved integer; required integer; limit_value integer; title_value text; description_value text;
begin
  if nullif(actor_uid,'') is null or actor_role is distinct from 'ADMIN' then raise exception 'Administrator access required.' using errcode='42501'; end if;
  select * into offer from public.voucher where id=(args->>'id')::uuid for update;
  if not found then raise exception 'Voucher was not found.'; end if;
  if offer.owner_uid is not null then raise exception 'Personal loyalty rewards keep their original reward terms.'; end if;
  title_value:=trim(coalesce(args->>'title','')); description_value:=trim(coalesce(args->>'description',''));
  required:=(args->>'requiredTrips')::integer; limit_value:=(args->>'usageLimit')::integer;
  if length(title_value) not between 3 and 120 or length(description_value)>1000 then raise exception 'Enter a promo name (3 to 120 characters) and description (up to 1,000 characters).'; end if;
  if required is null or required not between 0 and 1000 or (not offer.claimable and required<>0) then raise exception 'Choose a valid voucher mission.'; end if;
  reserved:=barkolink_private.voucher_allocations(offer.id);
  if limit_value is null or limit_value<greatest(1,reserved) then raise exception 'The limit must be at least % to cover existing claims and uses.',greatest(1,reserved); end if;
  if reserved>0 and required<>offer.required_trips then raise exception 'The mission cannot change after a passenger has claimed or used this voucher.'; end if;
  update public.voucher set title=title_value,description=description_value,required_trips=required,usage_limit=limit_value where id=offer.id;
  insert into public.activity_log(actor_uid,action,entity_type,entity_id,details)
    values(actor_uid,'VOUCHER_DETAILS_UPDATED','voucher',offer.id::text,jsonb_build_object('requiredTrips',required,'usageLimit',limit_value));
  return jsonb_build_object('id',offer.id);
end $$;
do $$
declare definition text; insertion integer;
begin
  definition:=replace(pg_get_functiondef('barkolink_private.execute_flexible_discounts(text,jsonb,text,text)'::regprocedure),E'\r\n',E'\n');
  insertion:=position(E'\nbegin\n' in definition);
  if insertion=0 then raise exception 'Voucher dispatcher insertion point was not found.'; end if;
  execute overlay(definition placing E'  if operation=\'AdminUpdateVoucherDetails\' then return barkolink_private.update_voucher_details(args,actor_uid,actor_role); end if;\n' from insertion+length(E'\nbegin\n') for 0);
end $$;
revoke all on function barkolink_private.update_voucher_details(jsonb,text,text) from public,anon,authenticated;
