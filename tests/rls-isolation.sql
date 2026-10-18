begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'bloomwell-rls-a@example.invalid', '', now()),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'bloomwell-rls-b@example.invalid', '', now());

insert into public.bloomwell_user_data (user_id, data)
values
  ('00000000-0000-4000-8000-000000000001', '{"owner":"user-a"}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', '{"owner":"user-b"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows
  from public.bloomwell_user_data;
  if visible_rows <> 1 then
    raise exception 'User A cannot see exactly their own row';
  end if;

  select count(*) into visible_rows
  from public.bloomwell_user_data
  where user_id = '00000000-0000-4000-8000-000000000002';
  if visible_rows <> 0 then
    raise exception 'User A can read User B data';
  end if;

  begin
    insert into public.bloomwell_user_data (user_id, data)
    values ('00000000-0000-4000-8000-000000000002', '{"owner":"attacker"}'::jsonb);
    raise exception 'User A inserted a row for User B';
  exception when insufficient_privilege then
    null;
  end;

  update public.bloomwell_user_data
  set data = '{"owner":"attacker"}'::jsonb
  where user_id = '00000000-0000-4000-8000-000000000002';
  if found then
    raise exception 'User A updated User B data';
  end if;

  delete from public.bloomwell_user_data
  where user_id = '00000000-0000-4000-8000-000000000002';
  if found then
    raise exception 'User A deleted User B data';
  end if;

  delete from public.bloomwell_user_data
  where user_id = '00000000-0000-4000-8000-000000000001';
  if not found then
    raise exception 'User A could not delete their original row';
  end if;

  insert into public.bloomwell_user_data (user_id, data)
  values ('00000000-0000-4000-8000-000000000001', '{"owner":"user-a"}'::jsonb);

  update public.bloomwell_user_data
  set data = '{"owner":"user-a-updated"}'::jsonb
  where user_id = '00000000-0000-4000-8000-000000000001';
  if not found then
    raise exception 'User A could not update their own row';
  end if;

  delete from public.bloomwell_user_data
  where user_id = '00000000-0000-4000-8000-000000000001';
  if not found then
    raise exception 'User A could not delete their own row';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

do $$
declare
  owner_data jsonb;
begin
  select data into owner_data
  from public.bloomwell_user_data
  where user_id = '00000000-0000-4000-8000-000000000002';
  if owner_data <> '{"owner":"user-b"}'::jsonb then
    raise exception 'User B data was missing or modified by User A';
  end if;
end
$$;

rollback;
