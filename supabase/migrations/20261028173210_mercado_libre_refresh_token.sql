create table public.mercado_libre_credentials (
  seller_id text primary key,
  encrypted_refresh_token text not null,
  lease_id uuid,
  lease_until timestamptz not null default '-infinity',
  updated_at timestamptz not null default now()
);
alter table public.mercado_libre_credentials enable row level security;
revoke all on public.mercado_libre_credentials from public, anon, authenticated;
grant select, insert, update on public.mercado_libre_credentials to service_role;
comment on table public.mercado_libre_credentials is
  'Backend-only AES-256-GCM refresh token. No access tokens or vehicle inventory are persisted.';
