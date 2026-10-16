import type { Metadata } from "next";
import { Briefcase, ShieldCheck, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { PortfolioItem, SiteProfile } from "@/lib/db/types";
import { EmptyState, PageHeader, Section } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmActionForm } from "@/components/content-admin/action-forms";
import { deletePortfolioItem } from "./actions";
import { KIND_LABELS, PortfolioItemDialog } from "./item-dialog";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Portfolio" };

const EMPTY_PROFILE: SiteProfile = {
  full_name: "",
  headline: "",
  short_bio: "",
  long_bio: "",
  approach: "",
  photo_url: null,
  contact_email: null,
  contact_phone: null,
  location: null,
  social_links: [],
  credibility_points: [],
};

export default async function AdminPortfolioPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: profile, error: profileError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("site_profile").select("*").eq("id", 1).maybeSingle<SiteProfile>(),
    supabase.from("portfolio_items").select("*").order("kind").order("sort_order"),
  ]);
  const list = (items ?? []) as PortfolioItem[];
  const nextSort = list.reduce((m, i) => Math.max(m, i.sort_order + 10), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Portfolio"
        description="Your public profile, expertise, experience and qualifications."
      />

      <Alert className="mb-6">
        <ShieldCheck aria-hidden />
        <AlertTitle>Keep it factual</AlertTitle>
        <AlertDescription>
          Everything here is shown publicly to prospective clients. Only list experience, qualifications and certifications
          you actually hold and can verify — never fabricated credentials, testimonials or results.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        <Section title="Profile" description="Shown on the home and portfolio pages.">
          {profileError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>The profile could not be loaded. Please refresh the page.</AlertDescription>
            </Alert>
          ) : (
            <ProfileForm profile={{ ...EMPTY_PROFILE, ...(profile ?? {}) }} />
          )}
        </Section>

        <Section
          title="Portfolio items"
          description="Lower sort order appears first within each type."
          actions={<PortfolioItemDialog defaultSortOrder={nextSort} />}
        >
          {itemsError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>Portfolio items could not be loaded. Please refresh the page.</AlertDescription>
            </Alert>
          ) : list.length === 0 ? (
            <EmptyState icon={Briefcase} title="No portfolio items yet" description="Add your expertise, experience and qualifications." />
          ) : (
            <ul className="divide-y">
              {list.map((item) => (
                <li key={item.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium tracking-wide text-teal uppercase">{KIND_LABELS[item.kind]}</span>
                      {!item.is_visible ? <StatusBadge tone="neutral">Hidden</StatusBadge> : null}
                      <span className="text-xs text-muted-foreground">Order {item.sort_order}</span>
                    </div>
                    <p className="mt-1 font-medium">{item.title}</p>
                    {item.subtitle || item.period ? (
                      <p className="text-sm text-muted-foreground">{[item.subtitle, item.period].filter(Boolean).join(" · ")}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <PortfolioItemDialog item={item} />
                    <ConfirmActionForm
                      action={deletePortfolioItem}
                      fields={{ id: item.id }}
                      triggerLabel="Delete"
                      triggerIcon={<Trash2 aria-hidden />}
                      title="Delete this item?"
                      description={`"${item.title}" will be removed from your portfolio.`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
