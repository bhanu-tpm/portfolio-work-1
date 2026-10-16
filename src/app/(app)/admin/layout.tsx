import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import type { ShellNavItem } from "@/components/shell/nav-links";
import { requireAdmin } from "@/lib/auth/dal";
import { LoadingBlock } from "@/components/shared/page";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

const NAV: ShellNavItem[] = [
  { href: "/admin", label: "Overview", icon: "overview", exact: true },
  { href: "/admin/requests", label: "Requests", icon: "requests" },
  { href: "/admin/clients", label: "Clients", icon: "clients" },
  { href: "/admin/appointments", label: "Appointments", icon: "appointments" },
  { href: "/admin/availability", label: "Availability", icon: "availability" },
  { href: "/admin/outcomes", label: "Outcomes", icon: "outcomes" },
  { href: "/admin/blog", label: "Blog", icon: "blog" },
  { href: "/admin/portfolio", label: "Portfolio", icon: "portfolio" },
  { href: "/admin/categories", label: "Categories", icon: "categories" },
  { href: "/admin/messages", label: "Contact messages", icon: "messages" },
  { href: "/admin/notifications", label: "Notifications", icon: "notifications" },
  { href: "/admin/ai-usage", label: "AI usage", icon: "usage" },
  { href: "/admin/audit", label: "Audit log", icon: "audit" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

/** Defence in depth: every admin page and action also calls requireAdmin/assertAdmin. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell nav={NAV} area="Admin">
      <Suspense fallback={<LoadingBlock rows={4} />}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </AppShell>
  );
}
