insert into auth.users (id, raw_user_meta_data) values
('11111111-1111-4111-a111-111111111111', '{"display_name":"First explorer"}'),
('22222222-2222-4222-a222-222222222222', '{"display_name":"Second explorer"}');
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-a111-111111111111', false);
insert into public.bookmarks(user_id, person_id) select auth.uid(), id from public.people limit 1;
insert into public.country_notes(user_id, country_code, body) values (auth.uid(), '364', 'First private note');
update public.profiles set display_name = 'Updated explorer' where id = auth.uid();
update public.user_preferences set settings = '{"theme":"dark"}' where user_id = auth.uid();
do $$ begin
  if (select count(*) from public.people) <> 156 then raise exception 'Dataset import is incomplete'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'Profiles are not isolated'; end if;
  if (select count(*) from public.user_preferences) <> 1 then raise exception 'Preferences are not isolated'; end if;
  begin
    update public.people set name = 'Unauthorized edit';
    raise exception 'Authenticated users can edit the shared dataset';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-a222-222222222222', false);
do $$ declare changed integer; begin
  if (select count(*) from public.bookmarks) <> 0 then raise exception 'Another user can read bookmarks'; end if;
  if (select count(*) from public.country_notes) <> 0 then raise exception 'Another user can read notes'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'Profile isolation failed'; end if;
  if (select settings from public.user_preferences limit 1) <> '{}'::jsonb then raise exception 'Another user can read preferences'; end if;
  update public.country_notes set body = 'Cross-user edit' where user_id = '11111111-1111-4111-a111-111111111111';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Cross-user update succeeded'; end if;
  delete from public.country_notes where user_id = '11111111-1111-4111-a111-111111111111';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Cross-user delete succeeded'; end if;
  begin
    insert into public.country_notes(user_id, country_code, body) values ('11111111-1111-4111-a111-111111111111', '840', 'Cross-user insertion');
    raise exception 'Cross-user insert succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform id from public.people; raise exception 'Anonymous dataset access succeeded'; exception when insufficient_privilege then null; end;
  begin perform id from public.profiles; raise exception 'Anonymous profile access succeeded'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.country_notes) <> 1 then raise exception 'A legitimate note was lost'; end if;
  if (select body from public.country_notes limit 1) <> 'First private note' then raise exception 'A private note was modified'; end if;
end $$;
select 'PASS: migrations, profile initialization, owner CRUD, cross-user isolation, anonymous denial, and dataset read-only access' as result;
