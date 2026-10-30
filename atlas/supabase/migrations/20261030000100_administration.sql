begin;

-- Access roles are independent of user-editable profiles and JWT metadata.
create table public.atlas_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'admin', 'owner')),
  updated_at timestamptz not null default now()
);
create function public.current_atlas_role() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select role from public.atlas_roles where user_id = auth.uid()), 'user');
$$;
revoke all on function public.current_atlas_role() from public, anon, authenticated;
grant execute on function public.current_atlas_role() to authenticated;
alter table public.atlas_roles enable row level security;
revoke all on public.atlas_roles from anon, authenticated;
grant select on public.atlas_roles to authenticated;
create policy atlas_roles_read on public.atlas_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.current_atlas_role()) = 'owner');

insert into public.datasets(id, name, snapshot_label)
values ('community', 'Atlas community', 'Characters published or maintained by Atlas administrators');

create table public.character_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_id uuid not null,
  submitter_name text not null,
  character jsonb not null check (jsonb_typeof(character) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '' check (char_length(review_note) <= 1000),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  person_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);
create index character_submissions_pending on public.character_submissions(status, created_at);
alter table public.character_submissions enable row level security;
revoke all on public.character_submissions from anon, authenticated;
grant select on public.character_submissions to authenticated;
create policy submissions_read on public.character_submissions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.current_atlas_role()) in ('admin', 'owner'));

create table public.atlas_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.atlas_audit_log enable row level security;
revoke all on public.atlas_audit_log from anon, authenticated;
grant select on public.atlas_audit_log to authenticated;
create policy audit_staff_read on public.atlas_audit_log for select to authenticated
  using ((select public.current_atlas_role()) in ('admin', 'owner'));

-- Internal validator: callers cannot invoke it or bypass audited mutation functions.
create function public.atlas_parse_character(payload jsonb) returns public.people
language plpgsql security definer set search_path = '' as $$
declare p public.people;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then raise exception 'Invalid character' using errcode = '22023'; end if;
  p := jsonb_populate_record(null::public.people, payload);
  p.name := trim(p.name); p.title := trim(p.title); p.image_url := coalesce(p.image_url, '');
  if p.name is null or char_length(p.name) not between 1 and 120
    or p.title is null or char_length(p.title) not between 1 and 240
    or p.role is null or p.role not in ('leader','member','army','religious','business')
    or p.latitude is null or p.latitude not between -90 and 90
    or p.longitude is null or p.longitude not between -180 and 180
    or p.country_code is null or not exists (select 1 from public.countries where code = p.country_code)
    or char_length(p.image_url) > 300000
    or not (p.image_url = '' or p.image_url ~ '^/[^/][a-zA-Z0-9/_.%\-]*$' or p.image_url ~ '^https://[^[:space:]]+$' or p.image_url ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')
    or (p.start_year is not null and p.start_year not between 0 and extract(year from current_date) + 1.999999)
    or (p.end_year is not null and p.end_year not between 0 and extract(year from current_date) + 1.999999)
    or (p.start_year is not null and p.end_year is not null and p.end_year < p.start_year)
  then raise exception 'Invalid character' using errcode = '22023'; end if;
  return p;
end;
$$;
revoke all on function public.atlas_parse_character(jsonb) from public, anon, authenticated;

create function public.submit_atlas_character(local_id uuid, payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.people; existing public.character_submissions; result uuid; actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if local_id is null then raise exception 'Invalid character identifier' using errcode = '22023'; end if;
  p := public.atlas_parse_character(payload);
  -- Serializes this user's retries, resubmissions and submission quota checks.
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  select * into existing from public.character_submissions s where s.user_id = actor and s.local_id = submit_atlas_character.local_id for update;
  if found and existing.status in ('pending', 'approved') then return existing.id; end if;
  if existing.id is not null then
    update public.character_submissions set character = to_jsonb(p) - 'id' - 'dataset_id', status = 'pending', review_note = '', reviewer_id = null, reviewed_at = null, updated_at = now() where id = existing.id;
    return existing.id;
  end if;
  if (select count(*) from public.character_submissions where user_id = actor) >= 200 then raise exception 'Submission limit reached' using errcode = '22023'; end if;
  insert into public.character_submissions(user_id, local_id, submitter_name, character)
    select actor, submit_atlas_character.local_id, display_name, to_jsonb(p) - 'id' - 'dataset_id' from public.profiles where id = actor returning id into result;
  if result is null then raise exception 'Profile required' using errcode = '42501'; end if;
  return result;
end;
$$;

create function public.save_atlas_person(person_id uuid, payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.people; result uuid;
begin
  if auth.uid() is null or public.current_atlas_role() not in ('admin', 'owner') then raise exception 'Permission denied' using errcode = '42501'; end if;
  p := public.atlas_parse_character(payload);
  if person_id is null then
    insert into public.people(dataset_id, country_code, name, title, role, latitude, longitude, image_url, start_year, end_year)
      values ('community', p.country_code, p.name, p.title, p.role, p.latitude, p.longitude, p.image_url, p.start_year, p.end_year) returning id into result;
  else
    update public.people set country_code = p.country_code, name = p.name, title = p.title, role = p.role, latitude = p.latitude, longitude = p.longitude, image_url = p.image_url, start_year = p.start_year, end_year = p.end_year
      where id = person_id returning id into result;
    if result is null then raise exception 'Person not found' using errcode = '22023'; end if;
  end if;
  insert into public.atlas_audit_log(actor_id, action, target_id, details) values (auth.uid(), case when person_id is null then 'person.create' else 'person.update' end, result, to_jsonb(p) - 'id' - 'dataset_id');
  return result;
end;
$$;

create function public.delete_atlas_person(person_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare removed public.people;
begin
  if auth.uid() is null or public.current_atlas_role() not in ('admin', 'owner') then raise exception 'Permission denied' using errcode = '42501'; end if;
  delete from public.people where id = person_id returning * into removed;
  if removed.id is null then raise exception 'Person not found' using errcode = '22023'; end if;
  insert into public.atlas_audit_log(actor_id, action, target_id, details) values (auth.uid(), 'person.delete', person_id, to_jsonb(removed));
end;
$$;

create function public.review_atlas_character(submission_id uuid, decision text, note text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.character_submissions; published uuid;
begin
  if auth.uid() is null or public.current_atlas_role() not in ('admin', 'owner') then raise exception 'Permission denied' using errcode = '42501'; end if;
  if decision is null or decision not in ('approved', 'rejected') or note is null or char_length(note) > 1000 then raise exception 'Invalid review' using errcode = '22023'; end if;
  select * into s from public.character_submissions where id = submission_id for update;
  if s.id is null or s.status <> 'pending' then raise exception 'Request is no longer pending' using errcode = '22023'; end if;
  if decision = 'approved' then published := public.save_atlas_person(null, s.character); end if;
  update public.character_submissions set status = decision, review_note = trim(note), reviewer_id = auth.uid(), reviewed_at = now(), updated_at = now(), person_id = published where id = s.id;
  insert into public.atlas_audit_log(actor_id, action, target_id, details) values (auth.uid(), 'submission.' || decision, s.id, jsonb_build_object('person_id', published, 'note', trim(note)));
  return published;
end;
$$;

create function public.set_atlas_admin(target_user uuid, make_admin boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('atlas-role-management'));
  if auth.uid() is null or public.current_atlas_role() <> 'owner' then raise exception 'Owner permission required' using errcode = '42501'; end if;
  if target_user is null or make_admin is null or not exists (select 1 from public.profiles where id = target_user) then raise exception 'Account not found' using errcode = '22023'; end if;
  if exists (select 1 from public.atlas_roles where user_id = target_user and role = 'owner') then raise exception 'Owner role cannot be changed here' using errcode = '42501'; end if;
  insert into public.atlas_roles(user_id, role) values (target_user, case when make_admin then 'admin' else 'user' end)
    on conflict (user_id) do update set role = excluded.role, updated_at = now();
  insert into public.atlas_audit_log(actor_id, action, target_id, details) values (auth.uid(), case when make_admin then 'admin.grant' else 'admin.revoke' end, target_user, '{}'::jsonb);
end;
$$;

create function public.list_atlas_accounts(search_query text default '')
returns table(user_id uuid, display_name text, email text, access_role text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_atlas_role() <> 'owner' then raise exception 'Owner permission required' using errcode = '42501'; end if;
  if search_query is null or char_length(search_query) > 100 then raise exception 'Invalid search' using errcode = '22023'; end if;
  return query select p.id, p.display_name, coalesce(u.email, ''), coalesce(r.role, 'user')
    from public.profiles p join auth.users u on u.id = p.id left join public.atlas_roles r on r.user_id = p.id
    where search_query = '' or p.display_name ilike '%' || search_query || '%' or u.email ilike '%' || search_query || '%'
    order by p.created_at desc, p.id limit 100;
end;
$$;

revoke all on function public.submit_atlas_character(uuid, jsonb), public.save_atlas_person(uuid, jsonb), public.delete_atlas_person(uuid), public.review_atlas_character(uuid, text, text), public.set_atlas_admin(uuid, boolean), public.list_atlas_accounts(text) from public, anon, authenticated;
grant execute on function public.submit_atlas_character(uuid, jsonb), public.save_atlas_person(uuid, jsonb), public.delete_atlas_person(uuid), public.review_atlas_character(uuid, text, text), public.set_atlas_admin(uuid, boolean), public.list_atlas_accounts(text) to authenticated;

commit;
