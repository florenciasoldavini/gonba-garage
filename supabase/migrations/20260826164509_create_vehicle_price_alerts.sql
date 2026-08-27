create table public.vehicle_price_alerts (
  id uuid primary key default gen_random_uuid(),
  vehicle_slug text not null check (char_length(vehicle_slug) between 1 and 160),
  email text not null check (char_length(email) between 3 and 320),
  current_price numeric(12, 2) not null check (current_price >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  status text not null default 'active' check (status in ('active', 'notified', 'cancelled')),
  source text not null default 'website' check (source in ('website', 'mercado_libre')),
  last_notified_price numeric(12, 2) check (last_notified_price is null or last_notified_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_slug, email)
);

alter table public.vehicle_price_alerts enable row level security;

revoke all on table public.vehicle_price_alerts from anon, authenticated;
grant all on table public.vehicle_price_alerts to service_role;

create index vehicle_price_alerts_active_vehicle_idx
  on public.vehicle_price_alerts (vehicle_slug, status)
  where status = 'active';
