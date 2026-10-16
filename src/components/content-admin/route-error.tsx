"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/page";

/** Body for `error.tsx` boundaries in the content admin. */
export function RouteError({ error, retry, what }: { error: Error & { digest?: string }; retry: () => void; what: string }) {
  useEffect(() => {
    console.error(`[admin/${what}]`, error);
  }, [error, what]);
  return (
    <EmptyState
      icon={AlertTriangle}
      title={`The ${what} page could not be loaded`}
      description="This is usually temporary. Try again, and check the server logs if it keeps happening."
      action={
        <Button type="button" onClick={() => retry()}>
          Try again
        </Button>
      }
    />
  );
}
