-- An isolated local stand-in for the Supabase-owned auth schema, for SQL tests.
create role anon nologin;
create role authenticated nologin;
create schema auth;
-- Match Supabase Auth's email type so RPC return-type mismatches are caught.
create table auth.users (id uuid primary key, email varchar(255), email_confirmed_at timestamptz default now(), raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
