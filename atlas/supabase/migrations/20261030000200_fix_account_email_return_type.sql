begin;

-- Supabase Auth stores email as varchar(255), but this RPC promises text.
-- RETURN QUERY requires matching column types; keep the cast at the boundary.
-- Replacing the function preserves existing accounts, roles and submissions.
create or replace function public.list_atlas_accounts(search_query text default '')
returns table(user_id uuid, display_name text, email text, access_role text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_atlas_role() <> 'owner' then raise exception 'Owner permission required' using errcode = '42501'; end if;
  if search_query is null or char_length(search_query) > 100 then raise exception 'Invalid search' using errcode = '22023'; end if;
  return query select p.id, p.display_name, coalesce(u.email::text, ''), coalesce(r.role, 'user')
    from public.profiles p join auth.users u on u.id = p.id left join public.atlas_roles r on r.user_id = p.id
    where search_query = '' or p.display_name ilike '%' || search_query || '%' or u.email ilike '%' || search_query || '%'
    order by p.created_at desc, p.id limit 100;
end;
$$;

revoke all on function public.list_atlas_accounts(text) from public, anon, authenticated;
grant execute on function public.list_atlas_accounts(text) to authenticated;

commit;
