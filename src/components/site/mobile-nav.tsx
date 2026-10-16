"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/provider";
import { LanguageSwitcher } from "./language-switcher";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const { t, href } = useI18n();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="lg:hidden" aria-label={t.common.header.openMenu}>
          <Menu />
        </Button>
      </SheetTrigger>
      {/* The sheet renders in a portal outside the public layout, so it opts into the warm theme itself. */}
      <SheetContent side="right" className="site-warm w-72 bg-background text-foreground">
        <SheetHeader>
          <SheetTitle>{t.common.header.menu}</SheetTitle>
        </SheetHeader>
        <nav aria-label={t.common.header.mobileNav} className="grid gap-1 px-4">
          <Link href={href("/")} onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 hover:bg-muted">
            {t.common.nav.home}
          </Link>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
          <LanguageSwitcher className="mt-4 self-start" />
          <Button asChild size="lg" className="mt-4 rounded-full">
            <Link href="/dashboard/requests/new" onClick={() => setOpen(false)}>
              {t.common.header.book}
            </Link>
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
