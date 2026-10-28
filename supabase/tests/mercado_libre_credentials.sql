-- Run as a database administrator after the migration. All changes roll back.
begin;
do $$
begin
  assert (select relrowsecurity from pg_class where oid = 'public.mercado_libre_credentials'::regclass);
  assert not has_table_privilege('anon', 'public.mercado_libre_credentials', 'SELECT');
  assert not has_table_privilege('anon', 'public.mercado_libre_credentials', 'INSERT');
  assert not has_table_privilege('authenticated', 'public.mercado_libre_credentials', 'UPDATE');
  assert not has_table_privilege('authenticated', 'public.mercado_libre_credentials', 'SELECT');
end $$;
set local role service_role;
insert into public.mercado_libre_credentials (seller_id, encrypted_refresh_token) values ('test-seller', 'test-ciphertext');
update public.mercado_libre_credentials
set lease_id = '00000000-0000-0000-0000-000000000001', lease_until = now() + interval '120 seconds'
where seller_id = 'test-seller' and lease_until < now();
do $$
declare affected integer;
begin
  update public.mercado_libre_credentials set lease_id = gen_random_uuid()
  where seller_id = 'test-seller' and lease_until < now();
  get diagnostics affected = row_count;
  assert affected = 0, 'An active lease must block a second refresh';
  update public.mercado_libre_credentials set encrypted_refresh_token = 'rotated'
  where seller_id = 'test-seller' and lease_id = '00000000-0000-0000-0000-000000000002';
  get diagnostics affected = row_count;
  assert affected = 0, 'A different lease must not overwrite the token';
  update public.mercado_libre_credentials set encrypted_refresh_token = 'rotated'
  where seller_id = 'test-seller' and lease_id = '00000000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  assert affected = 1;
end $$;
rollback;
