-- Atomic guest/POS place-order. Apply when ready for hosted; app falls back if missing.

create or replace function public.place_order(
  p_table_number text,
  p_order_type text,
  p_source text,
  p_kitchen_notes text,
  p_total numeric,
  p_items jsonb
)
returns table (id uuid, ticket_no integer, table_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
begin
  if p_table_number !~ '^(0[1-9]|1[0-9]|20)$' then
    raise exception 'invalid table';
  end if;
  if p_order_type not in ('dine_in', 'bungkus') then
    raise exception 'invalid order type';
  end if;
  if p_source not in ('guest', 'pos') then
    raise exception 'invalid source';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'empty items';
  end if;

  insert into public.orders (table_number, order_type, source, kitchen_notes, total, status, settled)
  values (p_table_number, p_order_type, p_source, coalesce(p_kitchen_notes, ''), p_total, 'preparing', false)
  returning orders.id into oid;

  insert into public.order_items (order_id, name, qty, unit_price)
  select oid, x.name, x.qty, x.unit_price
  from jsonb_to_recordset(p_items) as x(name text, qty integer, unit_price numeric);

  return query select o.id, o.ticket_no, o.table_number from public.orders o where o.id = oid;
end;
$$;

revoke all on function public.place_order(text, text, text, text, numeric, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, numeric, jsonb) to anon, authenticated;
