"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { fmt } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="site-warm flex flex-1 flex-col items-center justify-center bg-background px-4 py-24 text-center text-foreground">
      <h1 className="text-3xl font-semibold">{t.common.error.title}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        {t.common.error.body}
        {error.digest ? <span className="mt-2 block text-xs">{fmt(t.common.error.reference, { digest: error.digest })}</span> : null}
      </p>
      <Button className="mt-6 rounded-full" onClick={reset}>
        {t.common.error.retry}
      </Button>
    </main>
  );
}
