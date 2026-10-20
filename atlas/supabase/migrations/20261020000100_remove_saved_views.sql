-- Retire saved map views. Historical migrations are kept intact.
drop table if exists public.saved_views;
