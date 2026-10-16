-- Aggregates for AI budget enforcement and the usage dashboard.

create or replace function public.ai_cost_since(since timestamptz)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(estimated_cost_usd), 0) from public.ai_runs where created_at >= since;
$$;

create or replace function public.ai_usage_summary(since timestamptz)
returns table (
  feature public.ai_feature,
  runs bigint,
  failures bigint,
  input_tokens bigint,
  output_tokens bigint,
  estimated_cost_usd numeric,
  avg_latency_ms numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.authorize('ai.use') or (select auth.role()) = 'service_role') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
    select r.feature,
           count(*)::bigint,
           count(*) filter (where r.status = 'failed')::bigint,
           coalesce(sum(r.input_tokens), 0)::bigint,
           coalesce(sum(r.output_tokens), 0)::bigint,
           coalesce(sum(r.estimated_cost_usd), 0),
           round(avg(r.latency_ms))
    from public.ai_runs r
    where r.created_at >= since
    group by r.feature
    order by r.feature;
end;
$$;

revoke execute on function public.ai_cost_since(timestamptz) from public, anon, authenticated;
grant execute on function public.ai_cost_since(timestamptz) to service_role;
revoke execute on function public.ai_usage_summary(timestamptz) from public, anon;
grant execute on function public.ai_usage_summary(timestamptz) to authenticated, service_role;

-- Retention: delete assistant history, AI run metadata and resume reviews past their
-- configured retention. Scheduled from the cron endpoint.
create or replace function public.apply_retention(
  assistant_days integer, ai_run_days integer, resume_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversations integer;
  runs integer;
  reviews integer;
begin
  delete from public.ai_conversations where updated_at < now() - make_interval(days => assistant_days);
  get diagnostics conversations = row_count;
  delete from public.ai_runs where created_at < now() - make_interval(days => ai_run_days);
  get diagnostics runs = row_count;
  delete from public.resume_reviews where created_at < now() - make_interval(days => resume_days);
  get diagnostics reviews = row_count;
  return jsonb_build_object('conversations', conversations, 'ai_runs', runs, 'resume_reviews', reviews);
end;
$$;

revoke execute on function public.apply_retention(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.apply_retention(integer, integer, integer) to service_role;
