begin;

alter table public.people
  add column name_fa text not null default '' check (char_length(name_fa) <= 120),
  add column title_fa text not null default '' check (char_length(title_fa) <= 240);

create or replace function public.atlas_parse_character(payload jsonb) returns public.people
language plpgsql security definer set search_path = '' as $$
declare p public.people;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then raise exception 'Invalid character' using errcode = '22023'; end if;
  p := jsonb_populate_record(null::public.people, payload);
  p.name_fa := trim(coalesce(p.name_fa, '')); p.title_fa := trim(coalesce(p.title_fa, ''));
  p.name := trim(p.name); p.title := trim(p.title); p.image_url := coalesce(p.image_url, '');
  if char_length(p.name_fa) > 120 or char_length(p.title_fa) > 240
    or p.name is null or char_length(p.name) not between 1 and 120
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

create or replace function public.save_atlas_person(person_id uuid, payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.people; result uuid;
begin
  if auth.uid() is null or public.current_atlas_role() not in ('admin', 'owner') then raise exception 'Permission denied' using errcode = '42501'; end if;
  p := public.atlas_parse_character(payload);
  if person_id is null then
    insert into public.people(dataset_id, country_code, name, title, name_fa, title_fa, role, latitude, longitude, image_url, start_year, end_year)
      values ('community', p.country_code, p.name, p.title, p.name_fa, p.title_fa, p.role, p.latitude, p.longitude, p.image_url, p.start_year, p.end_year) returning id into result;
  else
    update public.people set country_code = p.country_code, name = p.name, title = p.title, name_fa = p.name_fa, title_fa = p.title_fa, role = p.role, latitude = p.latitude, longitude = p.longitude, image_url = p.image_url, start_year = p.start_year, end_year = p.end_year
      where id = person_id returning id into result;
    if result is null then raise exception 'Person not found' using errcode = '22023'; end if;
  end if;
  insert into public.atlas_audit_log(actor_id, action, target_id, details) values (auth.uid(), case when person_id is null then 'person.create' else 'person.update' end, result, to_jsonb(p) - 'id' - 'dataset_id');
  return result;
end;
$$;

commit;
