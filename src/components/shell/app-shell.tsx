import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/dal";
import { signOut } from "@/app/[lang]/(auth)/actions";
import { NavLinks, MobileShellNav, type ShellNavItem } from "./nav-links";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Career Consultation";

export function AppShell({
  nav,
  area,
  children,
}: {
  nav: ShellNavItem[];
  area: "Client" | "Admin";
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-1">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <Link href="/" className="font-heading text-lg font-semibold text-primary">
            {siteName}
          </Link>
        </div>
        <p className="px-5 pt-5 pb-2 text-[0.7rem] font-medium tracking-wider text-muted-foreground uppercase">{area}</p>
        <NavLinks items={nav} />
        <div className="mt-auto border-t p-3">
          <Suspense fallback={<div className="h-10" />}>
            <UserFooter />
          </Suspense>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <Link href="/" className="font-heading font-semibold text-primary">
            {siteName}
          </Link>
          <MobileShellNav items={nav} area={area}>
            <Suspense fallback={null}>
              <UserFooter />
            </Suspense>
          </MobileShellNav>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

async function UserFooter() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user.profile?.full_name || "Account"}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="icon" aria-label="Sign out">
          <LogOut />
        </Button>
      </form>
    </div>
  );
}
