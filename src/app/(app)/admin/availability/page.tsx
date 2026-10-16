import type { Metadata } from "next";
import { CalendarOff, Clock } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import type { AvailabilityRule, BlockedPeriod } from "@/lib/db/types";
import { formatDateTime, formatTimeZoneName } from "@/lib/format";
import { utcToLocalInput } from "@/lib/booking/rules";
import { EmptyState, PageHeader, Section } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { ActionDialog } from "@/components/booking/action-dialog";
import {
  deleteAvailabilityRule,
  deleteBlockedPeriod,
  saveAvailabilityRule,
  saveBlockedPeriod,
  saveBookingSettings,
} from "./actions";
import { BlockedPeriodForm, BookingSettingsForm, RuleForm, WEEKDAYS } from "./forms";

export const metadata: Metadata = { title: "Availability" };

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function AvailabilityPage() {
  await requireAdmin();
  const supabase = await createClient();
  const settings = await getSettings("booking");
  const nowIso = new Date().toISOString();
  const [{ data: rulesData, error: rulesError }, { data: blockedData, error: blockedError }] = await Promise.all([
    supabase.from("availability_rules").select("*").order("weekday").order("start_time"),
    supabase.from("blocked_periods").select("*").gte("ends_at", nowIso).order("starts_at").limit(100),
  ]);
  const rules = (rulesData ?? []) as AvailabilityRule[];
  const blocked = (blockedData ?? []) as BlockedPeriod[];
  const tz = `${formatTimeZoneName(settings.timezone)} (${settings.timezone})`;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Availability"
        description={`Weekly hours, blocked time and booking rules. All times are in ${tz}. Slots are generated deterministically from these settings.`}
      />

      <Section title="Weekly hours" description="Clients can book slots that fit entirely inside these windows.">
        {rulesError ? <p className="text-sm text-destructive">Hours could not be loaded. Please refresh.</p> : null}
        {rules.length === 0 && !rulesError ? (
          <EmptyState icon={Clock} title="No weekly hours yet" description="Add your first window below. Without hours, clients can't book." className="mb-6" />
        ) : (
          <ul className="mb-6 grid gap-3">
            {WEEK_ORDER.flatMap((d) => rules.filter((r) => r.weekday === d)).map((rule) => (
              <li key={rule.id} className="rounded-lg border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {WEEKDAYS[rule.weekday]} · {rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)}
                  </p>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={rule.is_active ? "success" : "neutral"}>{rule.is_active ? "Active" : "Inactive"}</StatusBadge>
                    <ActionDialog
                      action={deleteAvailabilityRule}
                      hidden={{ id: rule.id }}
                      triggerLabel="Delete"
                      triggerVariant="ghost"
                      title="Delete these hours?"
                      description="Existing appointments are kept; only new bookings are affected."
                      confirmLabel="Delete"
                      confirmVariant="destructive"
                    />
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-teal">Edit</summary>
                  <div className="mt-3">
                    <RuleForm action={saveAvailabilityRule} rule={rule} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t pt-4">
          <h3 className="mb-3 text-sm font-semibold">Add hours</h3>
          <RuleForm action={saveAvailabilityRule} />
        </div>
      </Section>

      <Section title="Blocked time" description="Holidays, travel or other unavailable periods. Existing appointments are not cancelled automatically.">
        {blockedError ? <p className="text-sm text-destructive">Blocked periods could not be loaded. Please refresh.</p> : null}
        {blocked.length === 0 && !blockedError ? (
          <EmptyState icon={CalendarOff} title="No upcoming blocked time" className="mb-6" />
        ) : (
          <ul className="mb-6 grid gap-3">
            {blocked.map((b) => (
              <li key={b.id} className="rounded-lg border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {formatDateTime(b.starts_at, settings.timezone)} → {formatDateTime(b.ends_at, settings.timezone)}
                    </p>
                    {b.reason ? <p className="text-sm text-muted-foreground">{b.reason}</p> : null}
                  </div>
                  <ActionDialog
                    action={deleteBlockedPeriod}
                    hidden={{ id: b.id }}
                    triggerLabel="Delete"
                    triggerVariant="ghost"
                    title="Remove this blocked period?"
                    description="The time becomes bookable again if it falls inside your weekly hours."
                    confirmLabel="Remove"
                    confirmVariant="destructive"
                  />
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-teal">Edit</summary>
                  <div className="mt-3">
                    <BlockedPeriodForm
                      action={saveBlockedPeriod}
                      timezoneLabel={tz}
                      period={{
                        id: b.id,
                        startsAt: utcToLocalInput(b.starts_at, settings.timezone),
                        endsAt: utcToLocalInput(b.ends_at, settings.timezone),
                        reason: b.reason,
                      }}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t pt-4">
          <h3 className="mb-3 text-sm font-semibold">Block time</h3>
          <BlockedPeriodForm action={saveBlockedPeriod} timezoneLabel={tz} />
        </div>
      </Section>

      <Section title="Booking settings" description="Changing the timezone changes how weekly hours are interpreted.">
        <BookingSettingsForm action={saveBookingSettings} settings={settings} />
      </Section>
    </div>
  );
}
