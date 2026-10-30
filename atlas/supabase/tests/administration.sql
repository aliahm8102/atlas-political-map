-- Tests execute against the isolated test cluster, never the hosted project.
insert into auth.users(id, email, raw_user_meta_data) values
('33333333-3333-4333-a333-333333333333', 'admin@example.test', '{"display_name":"Moderator"}'),
('44444444-4444-4444-a444-444444444444', 'user@example.test', '{"display_name":"User","role":"owner"}');
update auth.users set email = 'aliahm8102@gmail.com' where id = '11111111-1111-4111-a111-111111111111';
\ir ../bootstrap-owner.sql

set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-a444-444444444444', false);
do $$ begin
  if public.current_atlas_role() <> 'user' then raise exception 'Editable metadata elevated permissions'; end if;
  begin insert into public.atlas_roles values (auth.uid(), 'owner', now()); raise exception 'Self-promotion succeeded'; exception when insufficient_privilege then null; end;
  begin perform public.set_atlas_admin(auth.uid(), true); raise exception 'A user can appoint admins'; exception when insufficient_privilege then null; end;
  begin perform public.list_atlas_accounts(''); raise exception 'User can read account emails'; exception when insufficient_privilege then null; end;
  begin perform public.save_atlas_person(null, '{}'); raise exception 'User can create shared people'; exception when insufficient_privilege then null; end;
  begin perform public.delete_atlas_person((select id from public.people limit 1)); raise exception 'User can delete shared people'; exception when insufficient_privilege then null; end;
  begin perform public.review_atlas_character(gen_random_uuid(), 'approved', ''); raise exception 'User can approve requests'; exception when insufficient_privilege then null; end;
  begin insert into public.character_submissions(user_id, local_id, submitter_name, character, status) values (auth.uid(), gen_random_uuid(), 'Forged', '{}', 'approved'); raise exception 'Forged submission succeeded'; exception when insufficient_privilege then null; end;
  begin perform public.submit_atlas_character(gen_random_uuid(), '{"name":"Unsafe","title":"Test","role":"leader","country_code":"364","latitude":35,"longitude":51,"image_url":"javascript:alert(1)"}'); raise exception 'Unsafe portrait accepted'; exception when invalid_parameter_value then null; end;
end $$;

select public.submit_atlas_character('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '{"name":"Publication test","title":"Community figure","role":"leader","country_code":"364","latitude":35,"longitude":51,"image_url":""}');
select public.submit_atlas_character('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '{"name":"Duplicate retry","title":"Changed while pending","role":"leader","country_code":"364","latitude":35,"longitude":51,"image_url":""}');
do $$ begin
  if (select count(*) from public.character_submissions) <> 1 then raise exception 'Duplicate request was stored'; end if;
  if (select character->>'name' from public.character_submissions limit 1) <> 'Publication test' then raise exception 'Pending snapshot was overwritten'; end if;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-a222-222222222222', false);
do $$ begin if exists(select 1 from public.character_submissions) then raise exception 'Cross-user request exposure'; end if; end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-a111-111111111111', false);
select public.set_atlas_admin('33333333-3333-4333-a333-333333333333', true);
do $$ begin
  if public.current_atlas_role() <> 'owner' then raise exception 'Owner bootstrap failed'; end if;
  if (select count(*) from public.list_atlas_accounts('admin@example.test')) <> 1 then raise exception 'Owner cannot find the target account'; end if;
  if not exists(select 1 from public.list_atlas_accounts('admin@example.test') where email = 'admin@example.test' and display_name = 'Moderator' and access_role = 'admin') then raise exception 'Account RPC returned incorrect details'; end if;
  if (select count(*) from public.list_atlas_accounts('')) <> 4 then raise exception 'Owner cannot load the account list'; end if;
  begin perform public.set_atlas_admin(auth.uid(), false); raise exception 'Owner was demoted'; exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '33333333-3333-4333-a333-333333333333', false);
do $$ declare request_id uuid; published uuid; new_person uuid; begin
  if public.current_atlas_role() <> 'admin' then raise exception 'Admin grant failed'; end if;
  begin perform public.set_atlas_admin('44444444-4444-4444-a444-444444444444', true); raise exception 'Admin can grant roles'; exception when insufficient_privilege then null; end;
  begin perform public.list_atlas_accounts(''); raise exception 'Admin can read account emails'; exception when insufficient_privilege then null; end;
  select id into request_id from public.character_submissions limit 1;
  published := public.review_atlas_character(request_id, 'approved', 'Approved by moderator');
  if not exists(select 1 from public.people where id = published and name = 'Publication test') then raise exception 'Publication did not create the shared person'; end if;
  begin perform public.review_atlas_character(request_id, 'approved', 'Duplicate'); raise exception 'Request approved twice'; exception when invalid_parameter_value then null; end;
  if (select count(*) from public.people where name = 'Publication test') <> 1 then raise exception 'Duplicate publication'; end if;
  perform public.save_atlas_person(published, '{"name":"Edited publication","title":"Edited title","role":"army","country_code":"364","latitude":36,"longitude":52,"image_url":"/portraits/test.jpg"}');
  if not exists(select 1 from public.people where id = published and role = 'army' and name = 'Edited publication') then raise exception 'Admin edit failed'; end if;
  new_person := public.save_atlas_person(null, '{"name":"Direct admin addition","title":"Test","role":"member","country_code":"364","latitude":35,"longitude":51,"image_url":""}');
  perform public.delete_atlas_person(new_person);
  if exists(select 1 from public.people where id = new_person) then raise exception 'Admin deletion failed'; end if;
end $$;

select set_config('request.jwt.claim.sub', '44444444-4444-4444-a444-444444444444', false);
select public.submit_atlas_character('bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb', '{"name":"Needs correction","title":"Test","role":"leader","country_code":"364","latitude":35,"longitude":51,"image_url":""}');
do $$ begin
  if (select status from public.character_submissions where local_id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa') <> 'approved' then raise exception 'Author cannot see publication status'; end if;
end $$;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-a333-333333333333', false);
select public.review_atlas_character((select id from public.character_submissions where local_id = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb'), 'rejected', 'Please correct the title');
select set_config('request.jwt.claim.sub', '44444444-4444-4444-a444-444444444444', false);
select public.submit_atlas_character('bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb', '{"name":"Corrected submission","title":"Corrected","role":"leader","country_code":"364","latitude":35,"longitude":51,"image_url":""}');
do $$ begin
  if not exists(select 1 from public.character_submissions where local_id = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb' and status = 'pending' and review_note = '' and reviewer_id is null and reviewed_at is null) then raise exception 'Rejected request could not be resubmitted'; end if;
  if exists(select 1 from public.atlas_audit_log) then raise exception 'User can read staff audit history'; end if;
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-a111-111111111111', false);
select public.set_atlas_admin('33333333-3333-4333-a333-333333333333', false);
select set_config('request.jwt.claim.sub', '33333333-3333-4333-a333-333333333333', false);
do $$ begin
  if public.current_atlas_role() <> 'user' then raise exception 'Revocation not applied'; end if;
  begin perform public.save_atlas_person(null, '{}'); raise exception 'Revoked admin can still write'; exception when insufficient_privilege then null; end;
  if exists(select 1 from public.character_submissions) then raise exception 'Revoked admin can read others requests'; end if;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform public.current_atlas_role(); raise exception 'Anonymous role RPC allowed'; exception when insufficient_privilege then null; end;
  begin perform public.submit_atlas_character(gen_random_uuid(), '{}'); raise exception 'Anonymous submission allowed'; exception when insufficient_privilege then null; end;
  begin perform id from public.character_submissions; raise exception 'Anonymous submissions read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.atlas_audit_log) < 7 then raise exception 'Mutations were not audited'; end if;
  if (select count(*) from public.atlas_roles where role = 'owner') <> 1 then raise exception 'Owner integrity failed'; end if;
end $$;
select 'PASS: owner/admin/user authorization, metadata and direct-write attacks, review isolation, publication, replay protection, rejection/resubmission, CRUD, revocation, audit and anonymous denial' as result;
