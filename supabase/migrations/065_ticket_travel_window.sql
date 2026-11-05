-- Reject expired travel windows even if the trip status worker has not run.
-- Keep the existing booking/sailing/passenger locks and one-way attendance
-- transitions. Operators must update departure/arrival when rescheduling.
do $$declare definition text; previous text; needle text;begin
  definition:=replace(pg_get_functiondef('barkolink_private.execute(text,jsonb,text,text)'::regprocedure),chr(13),'');
  previous:=definition;
  needle:=$needle$      if b.status <> 'CONFIRMED' or b.payment_status <> 'PAID' then raise exception 'Payment must be completed first.'; end if;
      if operation = 'CheckInTicket' then$needle$;
  definition:=replace(definition,needle,$replacement$      if b.status <> 'CONFIRMED' or b.payment_status <> 'PAID' then raise exception 'Payment must be completed first.'; end if;
      if b.payment_method='PAYMONGO_TEST' and b.payment_verified_at is null then raise exception 'Staff payment verification is required before admission.'; end if;
      if s.arrival_at<=now() then raise exception 'This ticket travel period has ended. Keep it for transaction records only.'; end if;
      if operation = 'CheckInTicket' then$replacement$);
  if definition=previous then raise exception 'Ticket attendance guard insertion point was not found.';end if;
  execute definition;

  definition:=replace(pg_get_functiondef('barkolink_private.execute_flexible_discounts_v30(text,jsonb,text,text)'::regprocedure),chr(13),'');
  previous:=definition;
  needle:=$needle$    if s.status not in ('SCHEDULED','BOARDING') or (s.status<>'BOARDING' and s.departure_at<=now()) then$needle$;
  definition:=replace(definition,needle,$replacement$    if s.arrival_at<=now() then raise exception 'This ticket travel period has ended. Keep it for transaction records only.'; end if;
    if s.status not in ('SCHEDULED','BOARDING') or (s.status<>'BOARDING' and s.departure_at<=now()) then$replacement$);
  if definition=previous then raise exception 'Ticket QR guard insertion point was not found.';end if;
  execute definition;
end $$;
