alter table public.bloomwell_user_data
  drop constraint if exists bloomwell_user_data_data_is_object;
alter table public.bloomwell_user_data
  add constraint bloomwell_user_data_data_is_object
  check (jsonb_typeof(data) = 'object');

drop policy if exists "Users can read their own BloomWell data" on public.bloomwell_user_data;
drop policy if exists "Users can insert their own BloomWell data" on public.bloomwell_user_data;
drop policy if exists "Users can update their own BloomWell data" on public.bloomwell_user_data;
drop policy if exists "Users can delete their own BloomWell data" on public.bloomwell_user_data;

create policy "Users can read their own BloomWell data"
  on public.bloomwell_user_data
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own BloomWell data"
  on public.bloomwell_user_data
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own BloomWell data"
  on public.bloomwell_user_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own BloomWell data"
  on public.bloomwell_user_data
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "BloomWell owner fence for select" on public.bloomwell_user_data;
drop policy if exists "BloomWell owner fence for insert" on public.bloomwell_user_data;
drop policy if exists "BloomWell owner fence for update" on public.bloomwell_user_data;
drop policy if exists "BloomWell owner fence for delete" on public.bloomwell_user_data;

create policy "BloomWell owner fence for select"
  on public.bloomwell_user_data
  as restrictive
  for select to public
  using ((select auth.uid()) = user_id);

create policy "BloomWell owner fence for insert"
  on public.bloomwell_user_data
  as restrictive
  for insert to public
  with check ((select auth.uid()) = user_id);

create policy "BloomWell owner fence for update"
  on public.bloomwell_user_data
  as restrictive
  for update to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "BloomWell owner fence for delete"
  on public.bloomwell_user_data
  as restrictive
  for delete to public
  using ((select auth.uid()) = user_id);

revoke all on public.bloomwell_user_data from public, anon;
grant select, insert, update, delete on public.bloomwell_user_data to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bloomwell-private',
  'bloomwell-private',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

drop policy if exists "Users can read their own private BloomWell files" on storage.objects;
drop policy if exists "Users can upload their own private BloomWell files" on storage.objects;
drop policy if exists "Users can update their own private BloomWell files" on storage.objects;
drop policy if exists "Users can delete their own private BloomWell files" on storage.objects;

create policy "Users can read their own private BloomWell files"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bloomwell-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can upload their own private BloomWell files"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bloomwell-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can update their own private BloomWell files"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'bloomwell-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'bloomwell-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own private BloomWell files"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bloomwell-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "BloomWell private-file owner fence for select" on storage.objects;
drop policy if exists "BloomWell private-file owner fence for insert" on storage.objects;
drop policy if exists "BloomWell private-file owner fence for update" on storage.objects;
drop policy if exists "BloomWell private-file owner fence for delete" on storage.objects;

create policy "BloomWell private-file owner fence for select"
  on storage.objects
  as restrictive
  for select to public
  using (
    bucket_id <> 'bloomwell-private'
    or (
      bucket_id = 'bloomwell-private'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

create policy "BloomWell private-file owner fence for insert"
  on storage.objects
  as restrictive
  for insert to public
  with check (
    bucket_id <> 'bloomwell-private'
    or (
      bucket_id = 'bloomwell-private'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

create policy "BloomWell private-file owner fence for update"
  on storage.objects
  as restrictive
  for update to public
  using (
    bucket_id <> 'bloomwell-private'
    or (
      bucket_id = 'bloomwell-private'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  )
  with check (
    bucket_id <> 'bloomwell-private'
    or (
      bucket_id = 'bloomwell-private'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

create policy "BloomWell private-file owner fence for delete"
  on storage.objects
  as restrictive
  for delete to public
  using (
    bucket_id <> 'bloomwell-private'
    or (
      bucket_id = 'bloomwell-private'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );
