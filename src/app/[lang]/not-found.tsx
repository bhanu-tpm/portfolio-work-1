import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t, href } = await getI18n();
  return (
    <main id="main" className="site-warm flex flex-1 flex-col items-center justify-center bg-background px-4 py-24 text-center text-foreground">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-3xl font-semibold">{t.common.notFound.title}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{t.common.notFound.body}</p>
      <div className="mt-6 flex gap-3">
        <Button asChild className="rounded-full">
          <Link href={href("/")}>{t.common.notFound.home}</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/dashboard">{t.common.notFound.dashboard}</Link>
        </Button>
      </div>
    </main>
  );
}
