import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { aiSettingsSchema } from "@/lib/settings";
import { env, isAiConfigured } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import type { AiFeature, AiRun } from "@/lib/db/types";
import { DEFAULT_PAGE_SIZE, pageRange, totalPages } from "@/lib/pagination";
import {
  AI_FEATURES,
  AI_FEATURE_LABELS,
  AI_RUN_STATUSES,
  budgetPercent,
  formatNumber,
  formatUsd,
  parseAiRunFilters,
  utcMonthStart,
} from "@/lib/validation/admin";
import { EmptyState, PageHeader, Section } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { FilterForm, FilterSelect, QueryError, TableWrap } from "@/components/admin-ops/filters";

export const metadata: Metadata = { title: "AI usage" };

interface SummaryRow {
  feature: AiFeature;
  runs: number | string;
  failures: number | string;
  input_tokens: number | string;
  output_tokens: number | string;
  estimated_cost_usd: number | string;
  avg_latency_ms: number | string | null;
}

type RunRow = Pick<
  AiRun,
  | "id"
  | "feature"
  | "model"
  | "status"
  | "input_tokens"
  | "output_tokens"
  | "total_tokens"
  | "estimated_cost_usd"
  | "latency_ms"
  | "error_code"
  | "created_at"
>;

const RUN_STATUS_TONE = { pending: "info", succeeded: "success", failed: "danger" } as const;

function SummaryTable({ rows, label }: { rows: SummaryRow[]; label: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No AI runs in this period.</p>;
  const total = rows.reduce(
    (acc, r) => ({
      runs: acc.runs + Number(r.runs),
      failures: acc.failures + Number(r.failures),
      tokens: acc.tokens + Number(r.input_tokens) + Number(r.output_tokens),
      cost: acc.cost + Number(r.estimated_cost_usd),
    }),
    { runs: 0, failures: 0, tokens: 0, cost: 0 },
  );
  return (
    <TableWrap label={label}>
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Feature</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Runs</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Failures</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Input tokens</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Output tokens</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Avg latency</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Est. cost</th>
          </tr>
        </thead>
        <tbody className="divide-y tabular-nums">
          {rows.map((r) => (
            <tr key={r.feature}>
              <th scope="row" className="px-4 py-3 text-left font-medium">
                {AI_FEATURE_LABELS[r.feature] ?? r.feature}
              </th>
              <td className="px-4 py-3 text-right">{formatNumber(r.runs)}</td>
              <td className={`px-4 py-3 text-right ${Number(r.failures) > 0 ? "text-destructive" : ""}`}>
                {formatNumber(r.failures)}
              </td>
              <td className="px-4 py-3 text-right">{formatNumber(r.input_tokens)}</td>
              <td className="px-4 py-3 text-right">{formatNumber(r.output_tokens)}</td>
              <td className="px-4 py-3 text-right">
                {r.avg_latency_ms === null ? "—" : `${formatNumber(r.avg_latency_ms)} ms`}
              </td>
              <td className="px-4 py-3 text-right">{formatUsd(r.estimated_cost_usd)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t font-medium tabular-nums">
          <tr>
            <th scope="row" className="px-4 py-3 text-left">Total</th>
            <td className="px-4 py-3 text-right">{formatNumber(total.runs)}</td>
            <td className="px-4 py-3 text-right">{formatNumber(total.failures)}</td>
            <td className="px-4 py-3 text-right" colSpan={2}>
              {formatNumber(total.tokens)} tokens
            </td>
            <td />
            <td className="px-4 py-3 text-right">{formatUsd(total.cost)}</td>
          </tr>
        </tfoot>
      </table>
    </TableWrap>
  );
}

export default async function AiUsagePage({ searchParams }: PageProps<"/admin/ai-usage">) {
  await requireAdmin();
  const filters = parseAiRunFilters(await searchParams);
  const supabase = await createClient();

  const now = new Date();
  const monthStart = utcMonthStart(now);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const { from, to } = pageRange(filters.page);
  let runsQuery = supabase
    .from("ai_runs")
    .select(
      "id, feature, model, status, input_tokens, output_tokens, total_tokens, estimated_cost_usd, latency_ms, error_code, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.feature) runsQuery = runsQuery.eq("feature", filters.feature);
  if (filters.status) runsQuery = runsQuery.eq("status", filters.status);

  const [month, last30, settingsRow, runs] = await Promise.all([
    supabase.rpc("ai_usage_summary", { since: monthStart.toISOString() }),
    supabase.rpc("ai_usage_summary", { since: thirtyDaysAgo.toISOString() }),
    supabase.from("app_settings").select("value").eq("key", "ai").maybeSingle(),
    runsQuery,
  ]);
  for (const [name, res] of Object.entries({ month, last30, runs })) {
    if (res.error) console.error(`[admin/ai-usage] ${name} failed`, res.error.message);
  }

  const parsedSettings = aiSettingsSchema.safeParse(settingsRow.data?.value ?? {});
  const settings = parsedSettings.success ? parsedSettings.data : aiSettingsSchema.parse({});
  const monthRows = (month.data ?? []) as SummaryRow[];
  const last30Rows = (last30.data ?? []) as SummaryRow[];
  const runRows = (runs.data ?? []) as RunRow[];
  const monthSpend = monthRows.reduce((s, r) => s + Number(r.estimated_cost_usd), 0);
  const budget = settings.monthlyBudgetUsd;
  const percent = budgetPercent(monthSpend, budget);
  const hasFilters = Boolean(filters.feature || filters.status);

  return (
    <>
      <PageHeader
        title="AI usage"
        description={
          <>
            Runs, failures, tokens and estimated cost per feature. Costs are estimates based on the
            AI_INPUT_PRICE_PER_MTOK ({formatUsd(env.aiInputPricePerMTok())}/1M) and AI_OUTPUT_PRICE_PER_MTOK (
            {formatUsd(env.aiOutputPricePerMTok())}/1M) environment variables, not your provider invoice.
          </>
        }
        actions={
          <Link href="/admin/settings#ai" className="text-sm underline">
            AI settings
          </Link>
        }
      />

      <div className="grid gap-6">
        {!isAiConfigured() ? (
          <p className="rounded-lg bg-warning/10 p-3 text-sm" role="note">
            OpenAI is not configured (or AI_ENABLED=false), so no new AI runs will be recorded.
          </p>
        ) : null}

        <Section title="This month's spend" description={`Since ${formatDateTime(monthStart.toISOString())} (UTC month).`}>
          {month.error ? (
            <QueryError what="this month's usage" />
          ) : budget > 0 ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="text-2xl font-semibold tabular-nums">{formatUsd(monthSpend)}</span>{" "}
                  <span className="text-muted-foreground">of {formatUsd(budget)} budget</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{percent.toFixed(0)}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Monthly AI budget used"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percent)}
                className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={`h-full rounded-full ${percent >= 100 ? "bg-destructive" : percent >= 80 ? "bg-warning" : "bg-teal"}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              {percent >= 100 ? (
                <p className="text-sm text-destructive">
                  Budget reached: AI features are paused until next month or until you raise the budget.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm">
              <span className="text-2xl font-semibold tabular-nums">{formatUsd(monthSpend)}</span>{" "}
              <span className="text-muted-foreground">spent · no monthly budget cap set</span>
            </p>
          )}
        </Section>

        <Section title="This month by feature">
          {month.error ? <QueryError what="usage" /> : <SummaryTable rows={monthRows} label="This month by feature" />}
        </Section>

        <Section title="Last 30 days by feature">
          {last30.error ? (
            <QueryError what="usage" />
          ) : (
            <SummaryTable rows={last30Rows} label="Last 30 days by feature" />
          )}
        </Section>

        <Section title="Recent runs">
          <FilterForm action="/admin/ai-usage" hasFilters={hasFilters} label="Filter AI runs">
            <FilterSelect
              name="feature"
              label="Feature"
              value={filters.feature}
              options={AI_FEATURES.map((f) => ({ value: f, label: AI_FEATURE_LABELS[f] }))}
            />
            <FilterSelect
              name="status"
              label="Status"
              value={filters.status}
              options={AI_RUN_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
            />
          </FilterForm>

          {runs.error ? (
            <QueryError what="AI runs" />
          ) : runRows.length === 0 ? (
            <EmptyState icon={Sparkles} title={hasFilters ? "No runs match these filters" : "No AI runs yet"} />
          ) : (
            <TableWrap label="Recent AI runs">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Created</th>
                    <th scope="col" className="px-4 py-3 font-medium">Feature</th>
                    <th scope="col" className="px-4 py-3 font-medium">Model</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Tokens (in/out)</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Latency</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Est. cost</th>
                    <th scope="col" className="px-4 py-3 font-medium">Error code</th>
                  </tr>
                </thead>
                <tbody className="divide-y tabular-nums">
                  {runRows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="px-4 py-3">{AI_FEATURE_LABELS[r.feature] ?? r.feature}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.model}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={RUN_STATUS_TONE[r.status] ?? "neutral"}>{r.status}</StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {r.input_tokens === null && r.output_tokens === null
                          ? "—"
                          : `${formatNumber(r.input_tokens)} / ${formatNumber(r.output_tokens)}`}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {r.latency_ms === null ? "—" : `${formatNumber(r.latency_ms)} ms`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.estimated_cost_usd === null ? "—" : formatUsd(r.estimated_cost_usd)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-destructive">{r.error_code ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
          <PaginationNav
            path="/admin/ai-usage"
            page={filters.page}
            totalPages={totalPages(runs.count, DEFAULT_PAGE_SIZE)}
            totalCount={runs.count}
            params={{ feature: filters.feature, status: filters.status }}
          />
        </Section>
      </div>
    </>
  );
}
