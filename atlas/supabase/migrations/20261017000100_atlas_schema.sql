begin;

create table public.datasets (
  id text primary key,
  name text not null,
  snapshot_label text not null default 'Imported wim-main snapshot; not independently verified',
  imported_at timestamptz not null default now()
);
create table public.countries (
  code text primary key, name text not null, region text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180)
);
create table public.people (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null references public.datasets(id),
  country_code text not null references public.countries(code),
  name text not null, title text not null,
  role text not null check (role in ('leader','member','army','religious','business')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  image_url text not null, start_year numeric, end_year numeric,
  check (end_year is null or start_year is null or end_year >= start_year)
);
create index people_country_idx on public.people(country_code);
create index people_dataset_idx on public.people(dataset_id);
create index people_period_idx on public.people(start_year, end_year);
create table public.geopolitical_layers (
  id text primary key, name text not null, geojson jsonb not null, note text not null
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Explorer' check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);
create table public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, person_id)
);
create index bookmarks_person_idx on public.bookmarks(person_id);
create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  viewport jsonb not null check (jsonb_typeof(viewport) = 'object'),
  created_at timestamptz not null default now()
);
create index saved_views_user_idx on public.saved_views(user_id);
create table public.country_notes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  country_code text not null references public.countries(code),
  body text not null default '' check (char_length(body) <= 10000),
  updated_at timestamptz not null default now(),
  primary key (user_id, country_code)
);
create index country_notes_country_idx on public.country_notes(country_code);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger preferences_updated before update on public.user_preferences for each row execute function public.touch_updated_at();
create trigger notes_updated before update on public.country_notes for each row execute function public.touch_updated_at();

create function public.handle_new_atlas_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 80), ''), 'Explorer'));
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;
create trigger on_atlas_user_created after insert on auth.users for each row execute function public.handle_new_atlas_user();
revoke execute on function public.handle_new_atlas_user() from public, anon, authenticated;

-- Initialize profiles for users that predate this migration.
insert into public.profiles (id, display_name)
select id, coalesce(nullif(left(trim(raw_user_meta_data ->> 'display_name'), 80), ''), 'Explorer') from auth.users
on conflict (id) do nothing;
insert into public.user_preferences (user_id) select id from public.profiles on conflict (user_id) do nothing;

alter table public.datasets enable row level security;
alter table public.countries enable row level security;
alter table public.people enable row level security;
alter table public.geopolitical_layers enable row level security;
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.bookmarks enable row level security;
alter table public.saved_views enable row level security;
alter table public.country_notes enable row level security;

-- Dataset writes are reserved for SQL migrations / trusted administrators.
revoke all on public.datasets, public.countries, public.people, public.geopolitical_layers from anon, authenticated;
grant select on public.datasets, public.countries, public.people, public.geopolitical_layers to authenticated;
create policy datasets_read on public.datasets for select to authenticated using (true);
create policy countries_read on public.countries for select to authenticated using (true);
create policy people_read on public.people for select to authenticated using (true);
create policy layers_read on public.geopolitical_layers for select to authenticated using (true);

revoke all on public.profiles, public.user_preferences, public.bookmarks, public.saved_views, public.country_notes from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.user_preferences, public.bookmarks, public.saved_views, public.country_notes to authenticated;
create policy profile_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profile_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy preferences_owner on public.user_preferences for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy bookmarks_owner on public.bookmarks for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy views_owner on public.saved_views for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notes_owner on public.country_notes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
commit;
