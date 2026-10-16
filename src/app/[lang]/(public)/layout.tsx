import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Career Consultation";

/** The public site uses the warm theme; dashboards and admin keep the navy/teal palette. */
export default function PublicLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <div className="site-warm flex min-h-svh flex-1 flex-col bg-background text-foreground">
      <SiteHeader siteName={siteName} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter siteName={siteName} />
    </div>
  );
}
