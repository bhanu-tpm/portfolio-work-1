import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { EDUCATION_STATUSES } from "@/lib/validation/schemas";
import { DefinitionList, PageHeader, Section } from "@/components/shared/page";
import { ConfirmActionButton } from "@/components/student/confirm-action-button";
import { clearAssistantHistory } from "../assistant/actions";
import { deleteAllResumeReviews } from "../resume/actions";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile and privacy" };

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");
  const privacy = await getSettings("privacy");
  const p = user.profile;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Profile and privacy" description="Manage your details, notifications and AI preferences." />

      <Section title="Account">
        <DefinitionList
          items={[
            { label: "Email address", value: user.email },
            {
              label: "AI consent",
              value: p?.ai_consent
                ? `Given${p.ai_consent_at ? ` on ${formatDateTime(p.ai_consent_at)}` : ""}`
                : "Not given",
            },
          ]}
        />
        <p className="mt-4 text-sm">
          To change your password,{" "}
          <Link href="/forgot-password" className="underline underline-offset-4">
            request a password reset link
          </Link>
          .
        </p>
      </Section>

      <Section title="Profile" description="Used to pre-fill new consultation requests.">
        <ProfileForm
          educationStatuses={EDUCATION_STATUSES}
          defaults={{
            fullName: p?.full_name ?? "",
            phone: p?.phone ?? "",
            educationStatus: p?.education_status ?? "",
            organization: p?.organization ?? "",
            course: p?.course ?? "",
            emailNotifications: p?.email_notifications ?? true,
            aiConsent: p?.ai_consent ?? false,
          }}
        />
      </Section>

      <Section
        title="AI data"
        description={`AI assistant conversations are deleted automatically after ${privacy.assistantRetentionDays} days of inactivity and resume reviews after ${privacy.resumeRetentionDays} days. You can delete them now.`}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <ConfirmActionButton
            variant="outline"
            triggerLabel="Clear AI assistant history"
            title="Delete your AI assistant history?"
            description="All of your AI career guidance conversations will be permanently deleted. Summaries you already shared with a consultation request are kept on that request."
            confirmLabel="Delete history"
            action={clearAssistantHistory}
          />
          <ConfirmActionButton
            variant="outline"
            triggerLabel="Delete all resume reviews"
            title="Delete all resume reviews?"
            description="All resume feedback and uploaded resume PDFs will be permanently deleted."
            confirmLabel="Delete all"
            action={deleteAllResumeReviews}
          />
        </div>
      </Section>

      <Section title="Your data rights">
        <p className="text-sm text-muted-foreground">
          You can ask for a copy of your personal data, its correction, or the deletion of your account and
          associated records at any time.{" "}
          <Link href="/contact" className="underline underline-offset-4">
            Contact me
          </Link>{" "}
          from your account email address and I&apos;ll respond as soon as possible. See the{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            privacy notice
          </Link>{" "}
          for details.
        </p>
      </Section>
    </div>
  );
}
