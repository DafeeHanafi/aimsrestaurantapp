create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  table_number text not null,
  order_type text not null check (order_type in ('dine_in', 'bungkus')),
  source text not null check (source in ('guest', 'pos')),
  status text not null default 'preparing' check (status in ('preparing', 'ready', 'done')),
  kitchen_notes text not null default '',
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  name text not null,
  qty integer not null default 1,
  unit_price numeric(10,2) not null,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists orders_anon_all on public.orders;
create policy orders_anon_all on public.orders for all to anon using (true) with check (true);

drop policy if exists order_items_anon_all on public.order_items;
create policy order_items_anon_all on public.order_items for all to anon using (true) with check (true);

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
