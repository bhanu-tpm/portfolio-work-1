import { LoadingBlock } from "@/components/shared/page";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      <LoadingBlock label="Loading appointment…" rows={3} />
    </div>
  );
}
