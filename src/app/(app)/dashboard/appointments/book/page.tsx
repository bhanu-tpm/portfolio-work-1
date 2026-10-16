import type { Metadata } from "next";
import Link from "next/link";
import { CalendarX, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/db/types";
import { getSettings } from "@/lib/settings";
import { getAvailableSlots } from "@/lib/booking/service";
import { buildSlotGroups } from "@/lib/booking/display";
import { allowedFormats, bookingDuration } from "@/lib/booking/rules";
import { formatLabel, formatTimeZoneName } from "@/lib/format";
import { EmptyState, PageHeader, Section } from "@/components/shared/page";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Book an appointment" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BookAppointmentPage({ searchParams }: PageProps<"/dashboard/appointments/book">) {
  const sp = await searchParams;
  const requestId = typeof sp.request === "string" ? sp.request : "";
  const user = await requireUser(`/dashboard/appointments/book${requestId ? `?request=${requestId}` : ""}`);

  const header = <PageHeader title="Book an appointment" description="Choose a time that suits you." />;
  const backToRequests = (
    <Button asChild>
      <Link href="/dashboard/requests">View your requests</Link>
    </Button>
  );

  if (!UUID.test(requestId)) {
    return (
      <>
        {header}
        <EmptyState
          icon={ClipboardList}
          title="Choose a request first"
          description="Appointments are booked from an accepted consultation request."
          action={backToRequests}
        />
      </>
    );
  }

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("consultation_requests")
    .select("id, client_id, status, reference_code, category:consultation_categories(title, formats, duration_minutes)")
    .eq("id", requestId)
    .maybeSingle<{
      id: string;
      client_id: string;
      status: string;
      reference_code: string;
      category: { title: string; formats: string[]; duration_minutes: number | null } | null;
    }>();

  if (!request || request.client_id !== user.id) {
    return (
      <>
        {header}
        <EmptyState icon={ClipboardList} title="Request not found" description="We couldn't find that request in your account." action={backToRequests} />
      </>
    );
  }

  if (request.status !== "accepted") {
    return (
      <>
        {header}
        <EmptyState
          icon={ClipboardList}
          title="This request can't be booked yet"
          description="You can book an appointment once your request has been accepted."
          action={
            <Button asChild>
              <Link href={`/dashboard/requests/${request.id}`}>Back to request</Link>
            </Button>
          }
        />
      </>
    );
  }

  const { data: active } = await supabase
    .from("appointments")
    .select("id")
    .eq("request_id", request.id)
    .in("status", ACTIVE_APPOINTMENT_STATUSES)
    .limit(1);
  if (active?.length) {
    return (
      <>
        {header}
        <EmptyState
          icon={CalendarX}
          title="You already have an appointment for this request"
          description="You can request a reschedule or cancellation from your appointments page."
          action={
            <Button asChild>
              <Link href="/dashboard/appointments">Manage appointments</Link>
            </Button>
          }
        />
      </>
    );
  }

  const settings = await getSettings("booking");
  const durationMinutes = bookingDuration(request.category?.duration_minutes, settings.slotMinutes);
  const formats = allowedFormats(request.category?.formats, settings.formats);

  let loadError = false;
  let groups: ReturnType<typeof buildSlotGroups> = [];
  try {
    const { slots } = await getAvailableSlots({ durationMinutes });
    groups = buildSlotGroups(slots, settings.timezone);
  } catch (err) {
    console.error("[booking] slots unavailable", err);
    loadError = true;
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={request.reference_code}
        title="Book an appointment"
        description={`${request.category?.title ?? "Consultation"} · ${durationMinutes} minutes`}
      />
      {loadError ? (
        <EmptyState
          icon={CalendarX}
          title="Availability couldn't be loaded"
          description="Please refresh the page in a moment."
        />
      ) : groups.length === 0 || formats.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="No times available right now"
          description="New times are added regularly. Please check back soon, or send a message on your request."
          action={
            <Button asChild variant="outline">
              <Link href={`/dashboard/requests/${request.id}`}>Back to request</Link>
            </Button>
          }
        />
      ) : (
        <Section title="Pick a time" description={`Up to ${settings.maxDaysAhead} days ahead. Bookings need at least ${settings.minNoticeHours} hours' notice.`}>
          <BookingForm
            requestId={request.id}
            groups={groups}
            timezoneLabel={`${formatTimeZoneName(settings.timezone)} · ${settings.timezone}`}
            formats={formats.map((f) => ({ value: f, label: formatLabel(f) }))}
          />
        </Section>
      )}
    </div>
  );
}
