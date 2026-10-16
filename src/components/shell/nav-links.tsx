"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV_ICONS, type NavIconName } from "./nav-icons";

export interface ShellNavItem {
  href: string;
  label: string;
  icon: NavIconName;
  /** Match only the exact path (for overview pages). */
  exact?: boolean;
}

/**
 * usePathname() is URL data, which can't be prerendered on dynamic routes; the
 * links render immediately without highlighting and the active state streams in.
 */
export function NavLinks(props: { items: ShellNavItem[]; onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavList {...props} pathname={null} />}>
      <ActiveNavLinks {...props} />
    </Suspense>
  );
}

function ActiveNavLinks(props: { items: ShellNavItem[]; onNavigate?: () => void }) {
  return <NavList {...props} pathname={usePathname()} />;
}

function NavList({
  items,
  onNavigate,
  pathname,
}: {
  items: ShellNavItem[];
  onNavigate?: () => void;
  pathname: string | null;
}) {
  return (
    <nav aria-label="Sections" className="grid gap-0.5 px-3">
      {items.map((item) => {
        const active =
          pathname !== null &&
          (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
        const Icon = NAV_ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileShellNav({
  items,
  area,
  children,
}: {
  items: ShellNavItem[];
  area: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label="Open navigation">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col">
        <SheetHeader>
          <SheetTitle>{area}</SheetTitle>
        </SheetHeader>
        <NavLinks items={items} onNavigate={() => setOpen(false)} />
        <div className="mt-auto border-t p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
