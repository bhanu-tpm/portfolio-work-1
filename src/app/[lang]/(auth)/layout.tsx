import Link from "next/link";
import { getI18n } from "@/i18n/server";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Career Consultation";

export default async function AuthLayout({ children }: LayoutProps<"/[lang]">) {
  const { href } = await getI18n();
  return (
    <main
      id="main"
      className="site-warm relative isolate flex min-h-svh flex-1 flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground"
    >
      <div aria-hidden className="blob-a blob-morph absolute -top-24 -left-24 -z-10 size-80 bg-[var(--peach)] opacity-70" />
      <div aria-hidden className="blob-b blob-morph absolute -right-20 -bottom-24 -z-10 size-96 bg-[var(--sage)] opacity-70 [animation-delay:-6s]" />
      <Link href={href("/")} className="mb-8 font-heading text-2xl font-semibold text-foreground">
        {siteName}
      </Link>
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-[0_24px_60px_-30px_oklch(0.4_0.05_45/0.35)] ring-1 ring-border sm:p-8">
        {children}
      </div>
    </main>
  );
}
