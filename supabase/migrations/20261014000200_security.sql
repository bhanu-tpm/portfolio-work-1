-- Grants, Row-Level Security policies and privileged workflow functions.

-- ---------------------------------------------------------------------------
-- Baseline: no implicit access for API roles.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Policy helper functions must be executable by API roles.
grant execute on function public.has_role(public.app_role) to anon, authenticated;
grant execute on function public.authorize(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- Enable RLS everywhere.
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, phone, education_status, organization, course, timezone,
              ai_consent, ai_consent_at, email_notifications)
  on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.authorize('clients.view')));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------
grant select on public.user_roles to authenticated;
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

grant select on public.role_permissions to authenticated;
create policy role_permissions_select on public.role_permissions
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Settings (admin only; server code reads public-safe values with the service role)
-- ---------------------------------------------------------------------------
grant select, insert, update on public.app_settings to authenticated;
create policy app_settings_admin on public.app_settings
  for all to authenticated
  using ((select public.authorize('settings.manage')))
  with check ((select public.authorize('settings.manage')));

-- ---------------------------------------------------------------------------
-- Categories: public read of active categories, admin manage
-- ---------------------------------------------------------------------------
grant select on public.consultation_categories to anon, authenticated;
grant insert, update, delete on public.consultation_categories to authenticated;

create policy categories_public_read on public.consultation_categories
  for select to anon, authenticated
  using (is_active or (select public.authorize('content.manage')));

create policy categories_admin_write on public.consultation_categories
  for all to authenticated
  using ((select public.authorize('content.manage')))
  with check ((select public.authorize('content.manage')));

-- ---------------------------------------------------------------------------
-- Consultation requests
-- ---------------------------------------------------------------------------
grant select on public.consultation_requests to authenticated;
grant insert (client_id, category_id, full_name, email, phone, education_status, organization,
              course, challenge, goals, concerns, questions, expected_outcomes, preferred_format,
              preferred_date, intake_answers, consent_privacy, consent_ai)
  on public.consultation_requests to authenticated;
grant update (status, client_message, category_id) on public.consultation_requests to authenticated;

create policy requests_select on public.consultation_requests
  for select to authenticated
  using (client_id = (select auth.uid()) or (select public.authorize('requests.manage')));

create policy requests_insert_own on public.consultation_requests
  for insert to authenticated
  with check (client_id = (select auth.uid()) and status = 'submitted');

create policy requests_admin_update on public.consultation_requests
  for update to authenticated
  using ((select public.authorize('requests.manage')))
  with check ((select public.authorize('requests.manage')));

grant select on public.request_status_history to authenticated;
create policy status_history_select on public.request_status_history
  for select to authenticated
  using (
    (select public.authorize('requests.manage'))
    or exists (
      select 1 from public.consultation_requests r
      where r.id = request_id and r.client_id = (select auth.uid())
    )
  );

grant select, insert on public.request_messages to authenticated;
create policy request_messages_select on public.request_messages
  for select to authenticated
  using (
    (select public.authorize('requests.manage'))
    or exists (
      select 1 from public.consultation_requests r
      where r.id = request_id and r.client_id = (select auth.uid())
    )
  );
create policy request_messages_insert_client on public.request_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and author_role = 'client'
    and exists (
      select 1 from public.consultation_requests r
      where r.id = request_id
        and r.client_id = (select auth.uid())
        and r.status not in ('declined', 'completed')
    )
  );
create policy request_messages_insert_admin on public.request_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and author_role = 'admin'
    and (select public.authorize('requests.manage'))
  );

-- Admin notes: no client policy at all.
grant select, insert, update, delete on public.admin_notes to authenticated;
create policy admin_notes_admin on public.admin_notes
  for all to authenticated
  using ((select public.authorize('requests.manage')))
  with check ((select public.authorize('requests.manage')));

-- ---------------------------------------------------------------------------
-- Files (metadata only; objects live in private buckets without client policies)
-- ---------------------------------------------------------------------------
grant select on public.files to authenticated;
create policy files_select on public.files
  for select to authenticated
  using (
    (select public.is_admin())
    or (owner_id = (select auth.uid()) and purpose in ('request_attachment', 'resume'))
  );

-- ---------------------------------------------------------------------------
-- Scheduling
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.availability_rules to authenticated;
create policy availability_admin on public.availability_rules
  for all to authenticated
  using ((select public.authorize('appointments.manage')))
  with check ((select public.authorize('appointments.manage')));

grant select, insert, update, delete on public.blocked_periods to authenticated;
create policy blocked_periods_admin on public.blocked_periods
  for all to authenticated
  using ((select public.authorize('appointments.manage')))
  with check ((select public.authorize('appointments.manage')));

grant select on public.appointments to authenticated;
grant insert, update on public.appointments to authenticated;
create policy appointments_select on public.appointments
  for select to authenticated
  using (client_id = (select auth.uid()) or (select public.authorize('appointments.manage')));
create policy appointments_admin_write on public.appointments
  for all to authenticated
  using ((select public.authorize('appointments.manage')))
  with check ((select public.authorize('appointments.manage')));
-- Client bookings and change requests go through server code that validates
-- availability and then writes with the service role.

-- ---------------------------------------------------------------------------
-- Outcomes
-- ---------------------------------------------------------------------------
grant select on public.consultation_outcomes to authenticated;
grant insert, update on public.consultation_outcomes to authenticated;
create policy outcomes_client_select on public.consultation_outcomes
  for select to authenticated
  using (
    (client_id = (select auth.uid()) and status <> 'archived')
    or (select public.authorize('outcomes.manage'))
  );
create policy outcomes_admin_write on public.consultation_outcomes
  for all to authenticated
  using ((select public.authorize('outcomes.manage')))
  with check ((select public.authorize('outcomes.manage')));

grant select on public.outcome_versions to authenticated;
grant insert, update, delete on public.outcome_versions to authenticated;
-- Clients only ever see the version that was explicitly published.
create policy outcome_versions_client_select on public.outcome_versions
  for select to authenticated
  using (
    (select public.authorize('outcomes.manage'))
    or exists (
      select 1 from public.consultation_outcomes o
      where o.id = outcome_id
        and o.client_id = (select auth.uid())
        and o.status in ('published', 'superseded')
        and o.published_version_id = outcome_versions.id
    )
  );
create policy outcome_versions_admin_write on public.outcome_versions
  for all to authenticated
  using ((select public.authorize('outcomes.manage')))
  with check ((select public.authorize('outcomes.manage')));

-- ---------------------------------------------------------------------------
-- Blog and portfolio: public read of published content, admin manage
-- ---------------------------------------------------------------------------
grant select on public.blog_categories, public.blog_tags, public.blog_post_tags,
                public.blog_posts, public.site_profile, public.portfolio_items
  to anon, authenticated;
grant insert, update, delete on public.blog_categories, public.blog_tags, public.blog_post_tags,
                public.blog_posts, public.site_profile, public.portfolio_items
  to authenticated;

create policy blog_categories_read on public.blog_categories for select to anon, authenticated using (true);
create policy blog_categories_admin on public.blog_categories for all to authenticated
  using ((select public.authorize('content.manage'))) with check ((select public.authorize('content.manage')));

create policy blog_tags_read on public.blog_tags for select to anon, authenticated using (true);
create policy blog_tags_admin on public.blog_tags for all to authenticated
  using ((select public.authorize('content.manage'))) with check ((select public.authorize('content.manage')));

create policy blog_posts_read on public.blog_posts for select to anon, authenticated
  using ((status = 'published' and published_at <= now()) or (select public.authorize('content.manage')));
create policy blog_posts_admin on public.blog_posts for all to authenticated
  using ((select public.authorize('content.manage'))) with check ((select public.authorize('content.manage')));

create policy blog_post_tags_read on public.blog_post_tags for select to anon, authenticated
  using (exists (
    select 1 from public.blog_posts p
    where p.id = post_id and ((p.status = 'published' and p.published_at <= now()) or (select public.authorize('content.manage')))
  ));
create policy blog_post_tags_admin on public.blog_post_tags for all to authenticated
  using ((select public.authorize('content.manage'))) with check ((select public.authorize('content.manage')));

create policy site_profile_read on public.site_profile for select to anon, authenticated using (true);
create policy site_profile_admin on public.site_profile for all to authenticated
  using ((select public.authorize('content.manage'))) with check ((select public.authorize('content.manage')));

create policy portfolio_items_read on public.portfolio_items for select to anon, authenticated
  using (is_visible or (select public.authorize('content.manage')));
create policy portfolio_items_admin on public.portfolio_items for all to authenticated
  using ((select public.authorize('content.manage'))) with check ((select public.authorize('content.manage')));

-- ---------------------------------------------------------------------------
-- AI records
-- ---------------------------------------------------------------------------
grant select on public.ai_runs to authenticated;
create policy ai_runs_admin_read on public.ai_runs for select to authenticated
  using ((select public.authorize('ai.use')));

grant select, update on public.ai_generations to authenticated;
create policy ai_generations_admin on public.ai_generations for all to authenticated
  using ((select public.authorize('ai.use'))) with check ((select public.authorize('ai.use')));

grant select, insert, update, delete on public.ai_conversations to authenticated;
create policy ai_conversations_own on public.ai_conversations for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, delete on public.ai_messages to authenticated;
create policy ai_messages_own_select on public.ai_messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy ai_messages_own_delete on public.ai_messages for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, delete on public.resume_reviews to authenticated;
create policy resume_reviews_own on public.resume_reviews for select to authenticated
  -- The consultant only sees reviews the student linked to one of their requests.
  using (user_id = (select auth.uid()) or (request_id is not null and (select public.is_admin())));
create policy resume_reviews_own_delete on public.resume_reviews for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Notifications, audit, contact
-- ---------------------------------------------------------------------------
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select on public.audit_logs to authenticated;
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using ((select public.authorize('audit.view')));

grant select, update, delete on public.contact_messages to authenticated;
create policy contact_messages_admin on public.contact_messages for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- rate_limits: service role only (no grants, no policies).

-- ---------------------------------------------------------------------------
-- Privileged workflow functions (explicit authorization inside)
-- ---------------------------------------------------------------------------
create or replace function public.approve_outcome(p_outcome_id uuid, p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if not public.authorize('outcomes.publish') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.consultation_outcomes
    set status = 'approved', approved_version_id = p_version_id,
        approved_by = actor, approved_at = now()
    where id = p_outcome_id and status = 'draft';
  if not found then
    raise exception 'Outcome must be a draft to approve';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'outcome.approved', 'consultation_outcome', p_outcome_id::text,
          jsonb_build_object('version_id', p_version_id));
end;
$$;

create or replace function public.revoke_outcome_approval(p_outcome_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if not public.authorize('outcomes.publish') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.consultation_outcomes
    set status = 'draft', approved_version_id = null, approved_by = null, approved_at = null
    where id = p_outcome_id and status = 'approved';
  if not found then
    raise exception 'Outcome is not approved';
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values (actor, 'outcome.approval_revoked', 'consultation_outcome', p_outcome_id::text);
end;
$$;

-- Publishes the approved version and supersedes earlier published outcomes for the same request.
create or replace function public.publish_outcome(p_outcome_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target public.consultation_outcomes%rowtype;
  previous_id uuid;
begin
  if not public.authorize('outcomes.publish') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into target from public.consultation_outcomes where id = p_outcome_id for update;
  if not found then
    raise exception 'Outcome not found';
  end if;
  if target.status <> 'approved' or target.approved_version_id is null then
    raise exception 'Only approved outcomes can be published';
  end if;

  for previous_id in
    select id from public.consultation_outcomes
    where request_id = target.request_id and status = 'published' and id <> target.id
    for update
  loop
    update public.consultation_outcomes
      set status = 'superseded', superseded_by = target.id
      where id = previous_id;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (actor, 'outcome.superseded', 'consultation_outcome', previous_id::text,
            jsonb_build_object('superseded_by', target.id));
  end loop;

  update public.consultation_outcomes
    set status = 'published', published_version_id = target.approved_version_id,
        published_by = actor, published_at = now()
    where id = target.id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'outcome.published', 'consultation_outcome', target.id::text,
          jsonb_build_object('version_id', target.approved_version_id));
end;
$$;

grant execute on function public.approve_outcome(uuid, uuid) to authenticated, service_role;
grant execute on function public.revoke_outcome_approval(uuid) to authenticated, service_role;
grant execute on function public.publish_outcome(uuid) to authenticated, service_role;
