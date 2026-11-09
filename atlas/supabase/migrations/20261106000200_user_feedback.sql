begin;

create table public.atlas_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('suggestion', 'bug', 'contact')),
  subject text not null check (char_length(trim(subject)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'read', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index atlas_feedback_inbox on public.atlas_feedback(status, created_at desc);
create index atlas_feedback_author on public.atlas_feedback(user_id, created_at desc);
alter table public.atlas_feedback enable row level security;
revoke all on public.atlas_feedback from anon, authenticated;
grant select on public.atlas_feedback to authenticated;
create policy atlas_feedback_read on public.atlas_feedback for select to authenticated
  using (user_id = (select auth.uid()) or (select public.current_atlas_role()) in ('admin', 'owner'));

create function public.send_atlas_feedback(category text, subject text, body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); message_id uuid;
begin
  if actor is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if category is null or category not in ('suggestion','bug','contact')
    or subject is null or char_length(trim(subject)) not between 1 and 120
    or body is null or char_length(trim(body)) not between 1 and 4000
  then raise exception 'Invalid feedback' using errcode = '22023'; end if;
  -- Serialize per-account rate checks; authors cannot choose an owner or status.
  perform pg_advisory_xact_lock(hashtextextended('atlas-feedback:' || actor::text, 0));
  if (select count(*) from public.atlas_feedback f where f.user_id = actor and f.created_at > now() - interval '1 hour') >= 10
  then raise exception 'Feedback rate limit reached'; end if;
  insert into public.atlas_feedback(user_id, category, subject, body)
    values (actor, category, trim(subject), trim(body)) returning id into message_id;
  return message_id;
end;
$$;

create function public.list_atlas_feedback()
returns table(id uuid, category text, subject text, body text, status text, created_at timestamptz, sender_name text, sender_email text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_atlas_role() not in ('admin', 'owner')
  then raise exception 'Permission denied' using errcode = '42501'; end if;
  return query select f.id, f.category, f.subject, f.body, f.status, f.created_at, coalesce(nullif(trim(p.display_name), ''), u.email, '')::text, coalesce(u.email, '')::text
    from public.atlas_feedback f join public.profiles p on p.id = f.user_id join auth.users u on u.id = f.user_id
    order by (f.status = 'new') desc, f.created_at desc, f.id limit 200;
end;
$$;

create function public.set_atlas_feedback_status(message_id uuid, next_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_atlas_role() not in ('admin', 'owner')
  then raise exception 'Permission denied' using errcode = '42501'; end if;
  if next_status is null or next_status not in ('new', 'read', 'resolved')
  then raise exception 'Invalid status' using errcode = '22023'; end if;
  update public.atlas_feedback set status = next_status, updated_at = now() where id = message_id;
  if not found then raise exception 'Message not found' using errcode = '22023'; end if;
end;
$$;

revoke all on function public.send_atlas_feedback(text,text,text), public.list_atlas_feedback(), public.set_atlas_feedback_status(uuid,text) from public, anon, authenticated;
grant execute on function public.send_atlas_feedback(text,text,text), public.list_atlas_feedback(), public.set_atlas_feedback_status(uuid,text) to authenticated;

commit;
