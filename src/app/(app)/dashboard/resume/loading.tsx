import { LoadingBlock } from "@/components/shared/page";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <LoadingBlock label="Loading resume reviews…" rows={3} />
    </div>
  );
}
