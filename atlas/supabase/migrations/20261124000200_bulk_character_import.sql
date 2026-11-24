begin;

create function public.import_atlas_people(entries jsonb) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  entry jsonb;
  saved uuid[] := '{}';
begin
  if auth.uid() is null or public.current_atlas_role() not in ('admin', 'owner') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if entries is null or jsonb_typeof(entries) <> 'array' then
    raise exception 'Invalid import' using errcode = '22023';
  end if;
  if jsonb_array_length(entries) not between 1 and 200 then
    raise exception 'Invalid import size' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(entries) as items(item)
    where item->>'id' is not null group by (item->>'id')::uuid having count(*) > 1
  ) then
    raise exception 'Duplicate person ID' using errcode = '22023';
  end if;
  for entry in select value from jsonb_array_elements(entries)
  loop
    saved := array_append(saved, public.save_atlas_person((entry->>'id')::uuid, entry->'character'));
  end loop;
  return saved;
end;
$$;

revoke all on function public.import_atlas_people(jsonb) from public, anon, authenticated;
grant execute on function public.import_atlas_people(jsonb) to authenticated;

commit;
