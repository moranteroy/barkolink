-- Rewards are still earned/issued automatically, but passengers choose whether
-- to use them by entering a code and selecting Apply at booking review.
do $$declare definition text;previous text;begin
  definition:=pg_get_functiondef('barkolink_private.issue_loyalty_vouchers(text)'::regprocedure);
  previous:=definition;
  definition:=replace(definition,
    'Your personal voucher applies automatically to your next eligible booking and is valid for ',
    'Enter the voucher code at booking review and select Apply. It is valid for ');
  if definition=previous then raise exception 'Loyalty notification wording insertion point was not found.';end if;
  execute definition;
end $$;
