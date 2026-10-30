-- Run once in Supabase SQL Editor AFTER the administration migration.
-- The named account must already exist and have a confirmed email.
begin;
do $$
declare target uuid;
begin
  perform pg_advisory_xact_lock(hashtext('atlas-role-management'));
  if (select count(*) from auth.users where lower(email) = 'aliahm8102@gmail.com' and email_confirmed_at is not null) > 1 then raise exception 'More than one confirmed account uses the owner email. No roles were changed.'; end if;
  select id into target from auth.users where lower(email) = 'aliahm8102@gmail.com' and email_confirmed_at is not null;
  if target is null then raise exception 'Create and confirm the owner account first: aliahm8102@gmail.com'; end if;
  if exists (select 1 from public.atlas_roles where role = 'owner' and user_id <> target) then raise exception 'A different owner already exists. No roles were changed.'; end if;
  insert into public.atlas_roles(user_id, role) values (target, 'owner')
    on conflict(user_id) do update set role = 'owner', updated_at = now();
end;
$$;
commit;
