create table public.vehicle_inventory_alerts (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 320),
  search_query text not null default '' check (char_length(search_query) <= 120),
  make text not null default '' check (char_length(make) <= 80),
  transmission text not null default '' check (transmission in ('', 'automatic', 'manual')),
  body_type text not null default '' check (char_length(body_type) <= 80),
  fuel text not null default '' check (char_length(fuel) <= 80),
  min_price numeric(12, 2) not null default 0 check (min_price >= 0),
  max_price numeric(12, 2) not null default 0 check (max_price = 0 or max_price >= min_price),
  min_mileage integer not null default 0 check (min_mileage >= 0),
  max_mileage integer not null default 0 check (max_mileage = 0 or max_mileage >= min_mileage),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  source text not null default 'website' check (source in ('website', 'mercado_libre')),
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    email,
    search_query,
    make,
    transmission,
    body_type,
    fuel,
    min_price,
    max_price,
    min_mileage,
    max_mileage
  )
);

alter table public.vehicle_inventory_alerts enable row level security;

revoke all on table public.vehicle_inventory_alerts from anon, authenticated;
grant select, insert, update on table public.vehicle_inventory_alerts to service_role;

create index vehicle_inventory_alerts_active_idx
  on public.vehicle_inventory_alerts (created_at)
  where status = 'active';
