import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import type { ShellNavItem } from "@/components/shell/nav-links";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

const NAV: ShellNavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "overview", exact: true },
  { href: "/dashboard/requests", label: "Consultation requests", icon: "requests" },
  { href: "/dashboard/appointments", label: "Appointments", icon: "appointments" },
  { href: "/dashboard/outcomes", label: "Consultation outcomes", icon: "outcomes" },
  { href: "/dashboard/assistant", label: "AI career guidance", icon: "assistant" },
  { href: "/dashboard/resume", label: "Resume review", icon: "resume" },
  { href: "/dashboard/settings", label: "Profile and privacy", icon: "settings" },
];

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <AppShell nav={NAV} area="Client">
      {children}
    </AppShell>
  );
}
