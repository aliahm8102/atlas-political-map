begin;
update auth.users set email = 'feedback-other@example.test' where id = '22222222-2222-4222-a222-222222222222';
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-a444-444444444444', false);
do $$ declare sent uuid; blocked boolean := false; begin
  sent := public.send_atlas_feedback('bug', '  مشکل نقشه  ', 'جزئیات مشکل');
  if not exists(select 1 from public.atlas_feedback where id = sent and user_id = auth.uid() and subject = 'مشکل نقشه' and status = 'new') then raise exception 'Feedback not saved with verified owner'; end if;
  begin insert into public.atlas_feedback(user_id, category, subject, body) values(auth.uid(), 'bug', 'Forged', 'Direct insert'); raise exception 'Direct insert permitted'; exception when insufficient_privilege then null; end;
  begin update public.atlas_feedback set status = 'resolved' where id = sent; raise exception 'Author can update status directly'; exception when insufficient_privilege then null; end;
  begin perform public.set_atlas_feedback_status(sent, 'resolved'); raise exception 'Author can resolve messages'; exception when insufficient_privilege then null; end;
  begin perform public.list_atlas_feedback(); raise exception 'Author can list all messages and account emails'; exception when insufficient_privilege then null; end;
  begin perform public.send_atlas_feedback('owner', 'Subject', 'Body'); raise exception 'Invalid category accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.send_atlas_feedback('bug', '  ', 'Body'); raise exception 'Blank subject accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.send_atlas_feedback('bug', 'Subject', repeat('a', 4001)); raise exception 'Oversized message accepted'; exception when invalid_parameter_value then null; end;
  for i in 1..9 loop perform public.send_atlas_feedback('contact', 'Message ' || i, 'Body'); end loop;
  begin perform public.send_atlas_feedback('bug', 'Too many', 'Body'); exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Feedback rate limit failed'; end if;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-a222-222222222222', false);
do $$ begin if exists(select 1 from public.atlas_feedback) then raise exception 'Cross-user message exposure'; end if; end $$;
select public.send_atlas_feedback('suggestion', 'Private suggestion', 'Second account');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-a111-111111111111', false);
select public.set_atlas_admin('33333333-3333-4333-a333-333333333333', true);
select set_config('request.jwt.claim.sub', '33333333-3333-4333-a333-333333333333', false);
do $$ declare sent uuid; begin
  if (select count(*) from public.list_atlas_feedback()) <> 11 then raise exception 'Admin cannot read inbox'; end if;
  if not exists(select 1 from public.list_atlas_feedback() where subject = 'Private suggestion' and sender_email <> '' and sender_name <> '') then raise exception 'Missing sender details'; end if;
  select id into sent from public.list_atlas_feedback() where subject = 'Private suggestion';
  perform public.set_atlas_feedback_status(sent, 'read');
  if not exists(select 1 from public.list_atlas_feedback() where id = sent and status = 'read') then raise exception 'Read status not saved'; end if;
  perform public.set_atlas_feedback_status(sent, 'resolved');
  if not exists(select 1 from public.list_atlas_feedback() where id = sent and status = 'resolved') then raise exception 'Resolved status not saved'; end if;
  begin perform public.set_atlas_feedback_status(sent, 'invalid'); raise exception 'Invalid status accepted'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-a111-111111111111', false);
do $$ begin if (select count(*) from public.list_atlas_feedback()) <> 11 then raise exception 'Owner cannot read inbox'; end if; end $$;
select public.set_atlas_admin('33333333-3333-4333-a333-333333333333', false);
select set_config('request.jwt.claim.sub', '33333333-3333-4333-a333-333333333333', false);
do $$ begin
  begin perform public.list_atlas_feedback(); raise exception 'Revoked admin can read inbox'; exception when insufficient_privilege then null; end;
  if exists(select 1 from public.atlas_feedback) then raise exception 'Revoked admin can read table'; end if;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform public.send_atlas_feedback('bug', 'Anonymous', 'Body'); raise exception 'Anonymous feedback allowed'; exception when insufficient_privilege then null; end;
  begin perform public.list_atlas_feedback(); raise exception 'Anonymous inbox allowed'; exception when insufficient_privilege then null; end;
  begin perform id from public.atlas_feedback; raise exception 'Anonymous feedback read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: feedback ownership, validation, rate limits, author isolation, staff inbox, status changes, revocation and anonymous denial' as result;
