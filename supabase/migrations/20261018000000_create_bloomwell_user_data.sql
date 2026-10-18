create table if not exists public.bloomwell_user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.bloomwell_user_data enable row level security;

drop policy if exists "Users can read their own BloomWell data" on public.bloomwell_user_data;
create policy "Users can read their own BloomWell data"
  on public.bloomwell_user_data
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.bloomwell_user_data from public, anon, authenticated;
grant select on public.bloomwell_user_data to authenticated;

create or replace function public.save_my_bloomwell_data(
  p_data jsonb,
  p_expected_updated_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_at timestamptz := clock_timestamp();
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception using errcode = '22023', message = 'BloomWell data must be a JSON object';
  end if;

  insert into public.bloomwell_user_data as existing (user_id, data, updated_at)
  values ((select auth.uid()), p_data, saved_at)
  on conflict (user_id) do update
    set data = excluded.data,
        updated_at = saved_at
    where existing.updated_at = p_expected_updated_at
  returning existing.updated_at into saved_at;

  if not found then
    raise exception using errcode = '40001', message = 'BLOOMWELL_DATA_CONFLICT';
  end if;

  return saved_at;
end;
$$;

revoke all on function public.save_my_bloomwell_data(jsonb, timestamptz) from public;
grant execute on function public.save_my_bloomwell_data(jsonb, timestamptz) to authenticated;

create or replace function public.delete_my_bloomwell_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users
  where id = (select auth.uid());
end;
$$;

revoke all on function public.delete_my_bloomwell_account() from public;
grant execute on function public.delete_my_bloomwell_account() to authenticated;
