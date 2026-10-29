create sequence if not exists public.order_ticket_seq;

alter table public.orders add column if not exists ticket_no integer;
alter table public.orders add column if not exists settled boolean not null default false;
alter table public.orders add column if not exists settled_at timestamptz;

update public.orders o
set ticket_no = n.n
from (
  select id, row_number() over (order by created_at, id) as n
  from public.orders
  where ticket_no is null
) n
where o.id = n.id and o.ticket_no is null;

select setval(
  'public.order_ticket_seq',
  greatest(coalesce((select max(ticket_no) from public.orders), 0), 1),
  (select max(ticket_no) is not null from public.orders)
);

create unique index if not exists orders_ticket_no_uidx on public.orders (ticket_no);

create or replace function public.set_order_ticket_no()
returns trigger
language plpgsql
as $$
begin
  if new.ticket_no is null then
    new.ticket_no := nextval('public.order_ticket_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_ticket_no on public.orders;
create trigger trg_order_ticket_no
before insert on public.orders
for each row execute function public.set_order_ticket_no();

grant usage, select on sequence public.order_ticket_seq to anon, authenticated;

create table if not exists public.day_closes (
  id uuid primary key default gen_random_uuid(),
  business_date date not null unique,
  closed_at timestamptz not null default now(),
  dine_in_total numeric(10,2) not null default 0,
  bungkus_total numeric(10,2) not null default 0,
  line_count integer not null default 0,
  revenue numeric(10,2) not null default 0,
  note text not null default ''
);

alter table public.day_closes enable row level security;
drop policy if exists day_closes_anon_all on public.day_closes;
create policy day_closes_anon_all on public.day_closes for all to anon using (true) with check (true);
