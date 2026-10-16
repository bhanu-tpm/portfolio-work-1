-- Core schema: identity, RBAC, consultation workflow, scheduling, outcomes,
-- content, AI records, notifications, audit.
-- All tables have RLS enabled. Grants are explicit (no reliance on default privileges).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'client');

create type public.request_status as enum (
  'submitted', 'under_review', 'more_info_required', 'accepted', 'declined', 'completed'
);

create type public.appointment_status as enum (
  'pending', 'confirmed', 'reschedule_requested', 'cancellation_requested',
  'cancelled', 'completed', 'no_show'
);

create type public.outcome_status as enum (
  'draft', 'approved', 'published', 'superseded', 'archived'
);

create type public.post_status as enum ('draft', 'published', 'unpublished');

create type public.portfolio_kind as enum (
  'expertise', 'experience', 'project', 'qualification', 'certification'
);

create type public.ai_feature as enum (
  'intake_analysis', 'outcome_draft', 'resource_suggestions', 'career_assistant', 'resume_review'
);

create type public.ai_run_status as enum ('pending', 'succeeded', 'failed');

create type public.ai_generation_status as enum ('generated', 'edited', 'reviewed', 'dismissed');

create type public.file_purpose as enum ('request_attachment', 'outcome_document', 'resume');

create type public.notification_status as enum ('queued', 'sent', 'failed', 'skipped');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity and RBAC
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  education_status text,
  organization text,
  course text,
  timezone text not null default 'Asia/Kolkata',
  ai_consent boolean not null default false,
  ai_consent_at timestamptz,
  email_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.role_permissions (
  role public.app_role not null,
  permission text not null,
  primary key (role, permission)
);

insert into public.role_permissions (role, permission)
select 'admin', p
from unnest(array[
  'admin.access', 'requests.manage', 'clients.view', 'appointments.manage',
  'outcomes.manage', 'outcomes.publish', 'content.manage', 'settings.manage',
  'ai.use', 'audit.view'
]) as p;

-- Security definer so policies can consult RBAC tables without recursive RLS.
create or replace function public.has_role(check_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = check_role
  );
$$;

create or replace function public.authorize(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role = ur.role
    where ur.user_id = (select auth.uid())
      and rp.permission = requested_permission
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.authorize('admin.access');
$$;

-- New auth users always become clients. Admins are granted manually.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'client')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile email in sync when the user changes it through Supabase Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Run from the SQL editor (service role / postgres) to promote an account.
create or replace function public.grant_admin(target_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  select id into target_id from auth.users where lower(email) = lower(target_email);
  if target_id is null then
    raise exception 'No user with email %', target_email;
  end if;
  insert into public.user_roles (user_id, role) values (target_id, 'admin')
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value) values
  ('booking', jsonb_build_object(
    'timezone', 'Asia/Kolkata',
    'slotMinutes', 60,
    'bufferMinutes', 15,
    'minNoticeHours', 24,
    'maxDaysAhead', 30,
    'formats', jsonb_build_array('video', 'phone'),
    'reminderHoursBefore', 24
  )),
  ('ai', jsonb_build_object(
    'intakeAnalysis', true,
    'outcomeDraft', true,
    'resourceSuggestions', true,
    'careerAssistant', true,
    'resumeReview', true,
    'model', null,
    'assistantDailyMessageLimit', 30,
    'resumeDailyLimit', 3,
    'adminDailyLimit', 200,
    'monthlyBudgetUsd', 20
  )),
  ('email', jsonb_build_object(
    'newRequest', true,
    'statusChange', true,
    'moreInfo', true,
    'appointment', true,
    'reminders', true,
    'outcomePublished', true,
    'contact', true
  )),
  ('privacy', jsonb_build_object(
    'assistantRetentionDays', 180,
    'aiRunRetentionDays', 365,
    'resumeRetentionDays', 90
  ));

-- ---------------------------------------------------------------------------
-- Consultation categories
-- ---------------------------------------------------------------------------
create table public.consultation_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 2 and 120),
  short_description text not null default '',
  scope text not null default '',
  formats text[] not null default array['video', 'phone'],
  duration_minutes integer check (duration_minutes between 15 and 240),
  intake_questions jsonb not null default '[]'::jsonb check (jsonb_typeof(intake_questions) = 'array'),
  resume_review_enabled boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index consultation_categories_order_idx on public.consultation_categories (sort_order);
create trigger consultation_categories_updated_at before update on public.consultation_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Consultation requests
-- ---------------------------------------------------------------------------
create or replace function public.generate_reference_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i integer;
begin
  loop
    code := 'CR-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMM') || '-';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.consultation_requests where reference_code = code);
  end loop;
  return code;
end;
$$;

create table public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  client_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid references public.consultation_categories (id) on delete set null,
  status public.request_status not null default 'submitted',
  -- Original submission (never edited by the client after submission)
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 30),
  education_status text not null check (char_length(education_status) <= 80),
  organization text check (char_length(organization) <= 160),
  course text check (char_length(course) <= 160),
  challenge text not null check (char_length(challenge) between 20 and 4000),
  goals text not null check (char_length(goals) between 5 and 3000),
  concerns text check (char_length(concerns) <= 3000),
  questions text not null check (char_length(questions) between 5 and 3000),
  expected_outcomes text not null check (char_length(expected_outcomes) between 5 and 3000),
  preferred_format text not null check (char_length(preferred_format) <= 40),
  preferred_date date,
  intake_answers jsonb not null default '{}'::jsonb check (jsonb_typeof(intake_answers) = 'object'),
  consent_privacy boolean not null check (consent_privacy),
  consent_ai boolean not null default false,
  consented_at timestamptz not null default now(),
  -- Message shown to the client alongside the current status (e.g. clarification request)
  client_message text check (char_length(client_message) <= 3000),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index consultation_requests_client_idx on public.consultation_requests (client_id, submitted_at desc);
create index consultation_requests_status_idx on public.consultation_requests (status, submitted_at desc);
create trigger consultation_requests_updated_at before update on public.consultation_requests
  for each row execute function public.set_updated_at();

create or replace function public.consultation_requests_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reference_code is null or new.reference_code = '' then
    new.reference_code := public.generate_reference_code();
  end if;
  return new;
end;
$$;
create trigger consultation_requests_reference before insert on public.consultation_requests
  for each row execute function public.consultation_requests_before_insert();

create table public.request_status_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.consultation_requests (id) on delete cascade,
  from_status public.request_status,
  to_status public.request_status not null,
  changed_by uuid references auth.users (id) on delete set null,
  client_message text,
  created_at timestamptz not null default now()
);
create index request_status_history_request_idx on public.request_status_history (request_id, created_at);

create or replace function public.track_request_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.request_status_history (request_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, (select auth.uid()));
  elsif new.status is distinct from old.status then
    insert into public.request_status_history (request_id, from_status, to_status, changed_by, client_message)
    values (new.id, old.status, new.status, (select auth.uid()), new.client_message);
  end if;
  return new;
end;
$$;
create trigger consultation_requests_status_history
  after insert or update of status on public.consultation_requests
  for each row execute function public.track_request_status();

create table public.request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.consultation_requests (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_role public.app_role not null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index request_messages_request_idx on public.request_messages (request_id, created_at);

create table public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.consultation_requests (id) on delete cascade,
  client_id uuid references public.profiles (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (request_id is not null or client_id is not null)
);
create index admin_notes_request_idx on public.admin_notes (request_id, created_at desc);
create index admin_notes_client_idx on public.admin_notes (client_id, created_at desc);
create trigger admin_notes_updated_at before update on public.admin_notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Private file metadata
-- ---------------------------------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  owner_id uuid references public.profiles (id) on delete cascade,
  request_id uuid references public.consultation_requests (id) on delete cascade,
  purpose public.file_purpose not null,
  original_name text not null check (char_length(original_name) <= 255),
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
create index files_owner_idx on public.files (owner_id, created_at desc);
create index files_request_idx on public.files (request_id);

-- ---------------------------------------------------------------------------
-- Scheduling
-- ---------------------------------------------------------------------------
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index availability_rules_weekday_idx on public.availability_rules (weekday);

create table public.blocked_periods (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index blocked_periods_range_idx on public.blocked_periods (starts_at, ends_at);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.consultation_requests (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 240),
  blocked_from timestamptz not null,
  blocked_until timestamptz not null,
  timezone text not null default 'Asia/Kolkata',
  format text not null check (char_length(format) <= 40),
  status public.appointment_status not null default 'pending',
  meeting_details text check (char_length(meeting_details) <= 1000),
  client_note text check (char_length(client_note) <= 1000),
  change_request_reason text check (char_length(change_request_reason) <= 1000),
  change_requested_at timestamptz,
  cancellation_reason text check (char_length(cancellation_reason) <= 1000),
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  reminder_sent_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Double-booking protection: active appointments (including buffers) never overlap.
  constraint appointments_no_overlap exclude using gist (
    tstzrange(blocked_from, blocked_until, '[)') with &&
  ) where (status in ('pending', 'confirmed', 'reschedule_requested', 'cancellation_requested'))
);
create index appointments_client_idx on public.appointments (client_id, starts_at desc);
create index appointments_starts_idx on public.appointments (starts_at);
create unique index appointments_one_active_per_request on public.appointments (request_id)
  where (status in ('pending', 'confirmed', 'reschedule_requested', 'cancellation_requested'));
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

create or replace function public.appointments_compute_block()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The buffer follows each appointment, so consecutive slots are (duration + buffer) apart.
  new.blocked_from := new.starts_at;
  new.blocked_until := new.ends_at + make_interval(mins => new.buffer_minutes);
  return new;
end;
$$;
create trigger appointments_block_range before insert or update of starts_at, ends_at, buffer_minutes
  on public.appointments
  for each row execute function public.appointments_compute_block();

-- ---------------------------------------------------------------------------
-- Consultation outcomes
-- ---------------------------------------------------------------------------
create table public.consultation_outcomes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.consultation_requests (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  title text not null check (char_length(title) between 3 and 200),
  status public.outcome_status not null default 'draft',
  approved_version_id uuid,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  published_version_id uuid,
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  superseded_by uuid references public.consultation_outcomes (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outcome_published_requires_approval check (
    status not in ('published')
    or (published_version_id is not null
        and approved_by is not null
        and approved_at is not null
        and published_version_id = approved_version_id)
  ),
  constraint outcome_approved_requires_approver check (
    status <> 'approved' or (approved_version_id is not null and approved_by is not null)
  )
);
create index consultation_outcomes_client_idx on public.consultation_outcomes (client_id, created_at desc);
create index consultation_outcomes_request_idx on public.consultation_outcomes (request_id);
create index consultation_outcomes_status_idx on public.consultation_outcomes (status);
create trigger consultation_outcomes_updated_at before update on public.consultation_outcomes
  for each row execute function public.set_updated_at();

create table public.outcome_versions (
  id uuid primary key default gen_random_uuid(),
  outcome_id uuid not null references public.consultation_outcomes (id) on delete cascade,
  version_number integer not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  source text not null default 'manual' check (source in ('manual', 'ai_draft', 'ai_assisted')),
  ai_generation_id uuid,
  file_id uuid references public.files (id) on delete set null,
  change_note text check (char_length(change_note) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (outcome_id, version_number)
);

alter table public.consultation_outcomes
  add constraint consultation_outcomes_approved_version_fk
    foreign key (approved_version_id) references public.outcome_versions (id) on delete set null,
  add constraint consultation_outcomes_published_version_fk
    foreign key (published_version_id) references public.outcome_versions (id) on delete restrict;

-- Versions are immutable once written (except linking a generated PDF before approval).
create or replace function public.outcome_versions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent public.consultation_outcomes%rowtype;
begin
  select * into parent from public.consultation_outcomes where id = coalesce(new.outcome_id, old.outcome_id);

  if tg_op = 'INSERT' then
    if parent.status in ('published', 'superseded', 'archived') then
      raise exception 'Cannot add versions to a % outcome', parent.status;
    end if;
    -- New content invalidates any existing approval.
    if parent.status = 'approved' then
      update public.consultation_outcomes
        set status = 'draft', approved_version_id = null, approved_by = null, approved_at = null
        where id = parent.id;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.content is distinct from old.content
       or new.outcome_id is distinct from old.outcome_id
       or new.version_number is distinct from old.version_number then
      raise exception 'Outcome versions are immutable';
    end if;
    if new.file_id is distinct from old.file_id and parent.status <> 'draft' then
      raise exception 'Documents can only be attached while the outcome is a draft';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if parent.published_version_id = old.id or parent.approved_version_id = old.id then
      raise exception 'Cannot delete an approved or published version';
    end if;
    return old;
  end if;
  return null;
end;
$$;
create trigger outcome_versions_guard
  before insert or update or delete on public.outcome_versions
  for each row execute function public.outcome_versions_guard();

-- Outcome state machine.
create or replace function public.consultation_outcomes_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    -- Content of approval/publication fields may not change silently.
    if new.status = 'published' and (
      new.published_version_id is distinct from old.published_version_id
      or new.approved_version_id is distinct from old.approved_version_id
    ) then
      raise exception 'Published outcomes cannot be modified; create a new outcome to supersede it';
    end if;
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status in ('approved', 'archived'))
    or (old.status = 'approved' and new.status in ('draft', 'published', 'archived'))
    or (old.status = 'published' and new.status in ('superseded', 'archived'))
    or (old.status = 'superseded' and new.status = 'archived')
  ) then
    raise exception 'Invalid outcome status transition % -> %', old.status, new.status;
  end if;

  if new.status = 'approved' then
    if new.approved_version_id is null then
      raise exception 'Approval requires a version';
    end if;
    if not exists (
      select 1 from public.outcome_versions v
      where v.id = new.approved_version_id and v.outcome_id = new.id
    ) then
      raise exception 'Approved version does not belong to this outcome';
    end if;
  end if;

  return new;
end;
$$;
create trigger consultation_outcomes_guard
  before update on public.consultation_outcomes
  for each row execute function public.consultation_outcomes_guard();

-- ---------------------------------------------------------------------------
-- Blog
-- ---------------------------------------------------------------------------
create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  created_at timestamptz not null default now()
);

create table public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 200),
  excerpt text not null default '' check (char_length(excerpt) <= 500),
  content text not null default '',
  cover_image_url text,
  cover_image_alt text check (char_length(cover_image_alt) <= 200),
  category_id uuid references public.blog_categories (id) on delete set null,
  status public.post_status not null default 'draft',
  published_at timestamptz,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 170),
  reading_minutes integer not null default 1,
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);
create index blog_posts_published_idx on public.blog_posts (status, published_at desc);
create index blog_posts_category_idx on public.blog_posts (category_id);
create trigger blog_posts_updated_at before update on public.blog_posts
  for each row execute function public.set_updated_at();

create table public.blog_post_tags (
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  tag_id uuid not null references public.blog_tags (id) on delete cascade,
  primary key (post_id, tag_id)
);
create index blog_post_tags_tag_idx on public.blog_post_tags (tag_id);

-- ---------------------------------------------------------------------------
-- Portfolio / site profile
-- ---------------------------------------------------------------------------
create table public.site_profile (
  id smallint primary key default 1 check (id = 1),
  full_name text not null default 'Your Name',
  headline text not null default '',
  short_bio text not null default '',
  long_bio text not null default '',
  approach text not null default '',
  photo_url text,
  contact_email text,
  contact_phone text,
  location text,
  social_links jsonb not null default '[]'::jsonb check (jsonb_typeof(social_links) = 'array'),
  credibility_points jsonb not null default '[]'::jsonb check (jsonb_typeof(credibility_points) = 'array'),
  updated_at timestamptz not null default now()
);
create trigger site_profile_updated_at before update on public.site_profile
  for each row execute function public.set_updated_at();

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  kind public.portfolio_kind not null,
  title text not null check (char_length(title) between 2 and 200),
  subtitle text check (char_length(subtitle) <= 200),
  description text check (char_length(description) <= 2000),
  period text check (char_length(period) <= 80),
  url text check (url is null or url ~ '^https?://'),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolio_items_kind_idx on public.portfolio_items (kind, sort_order);
create trigger portfolio_items_updated_at before update on public.portfolio_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- AI records
-- ---------------------------------------------------------------------------
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  feature public.ai_feature not null,
  status public.ai_run_status not null default 'pending',
  provider text not null default 'openai',
  model text not null,
  user_id uuid references auth.users (id) on delete set null,
  request_id uuid references public.consultation_requests (id) on delete set null,
  outcome_id uuid references public.consultation_outcomes (id) on delete set null,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric(12, 6),
  latency_ms integer,
  attempts integer not null default 1,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index ai_runs_created_idx on public.ai_runs (created_at desc);
create index ai_runs_feature_idx on public.ai_runs (feature, created_at desc);
create index ai_runs_user_idx on public.ai_runs (user_id, created_at desc);

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  feature public.ai_feature not null,
  ai_run_id uuid references public.ai_runs (id) on delete set null,
  request_id uuid references public.consultation_requests (id) on delete cascade,
  outcome_id uuid references public.consultation_outcomes (id) on delete cascade,
  content jsonb not null,           -- original model output (validated)
  edited_content jsonb,             -- administrator edits; original is preserved
  status public.ai_generation_status not null default 'generated',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_generations_request_idx on public.ai_generations (request_id, created_at desc);
create index ai_generations_outcome_idx on public.ai_generations (outcome_id, created_at desc);
create trigger ai_generations_updated_at before update on public.ai_generations
  for each row execute function public.set_updated_at();

alter table public.outcome_versions
  add constraint outcome_versions_ai_generation_fk
    foreign key (ai_generation_id) references public.ai_generations (id) on delete set null;

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Career guidance' check (char_length(title) <= 120),
  saved_to_request_id uuid references public.consultation_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);
create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  created_at timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

create table public.resume_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid references public.consultation_requests (id) on delete set null,
  file_id uuid references public.files (id) on delete set null,
  target_role text check (char_length(target_role) <= 160),
  status public.ai_run_status not null default 'pending',
  feedback jsonb,
  ai_run_id uuid references public.ai_runs (id) on delete set null,
  error_message text,
  created_at timestamptz not null default now()
);
create index resume_reviews_user_idx on public.resume_reviews (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Notifications, audit, contact, rate limits
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade, -- null = administrator notification
  type text not null,
  channel text not null default 'email' check (channel in ('email', 'in_app')),
  recipient_email text,
  subject text not null,
  body text not null default '',
  link text,
  status public.notification_status not null default 'queued',
  provider_message_id text,
  error text,
  read_at timestamptz,
  related_request_id uuid references public.consultation_requests (id) on delete set null,
  related_appointment_id uuid references public.appointments (id) on delete set null,
  related_outcome_id uuid references public.consultation_outcomes (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_status_idx on public.notifications (status, created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) <= 254),
  subject text not null check (char_length(subject) between 2 and 160),
  message text not null check (char_length(message) between 10 and 5000),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
create index contact_messages_created_idx on public.contact_messages (created_at desc);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

-- Fixed-window limiter. Returns true when the call is allowed.
create or replace function public.consume_rate_limit(limit_key text, max_hits integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket timestamptz;
  current_hits integer;
begin
  bucket := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);
  insert into public.rate_limits as rl (key, window_start, hits)
  values (limit_key, bucket, 1)
  on conflict (key, window_start) do update set hits = rl.hits + 1
  returning hits into current_hits;

  -- Opportunistic cleanup of old windows.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return current_hits <= max_hits;
end;
$$;
