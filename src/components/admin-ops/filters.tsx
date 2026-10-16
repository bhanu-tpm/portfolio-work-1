import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Plain GET filter form for admin list pages. Works without JavaScript; the
 * page re-validates every parameter on the server.
 */
export function FilterForm({
  action,
  children,
  hasFilters,
  label = "Filters",
}: {
  action: string;
  children: React.ReactNode;
  hasFilters: boolean;
  label?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      role="search"
      aria-label={label}
      className="mb-4 grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end"
    >
      {children}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
        <Button type="submit">Apply</Button>
        {hasFilters ? (
          <Button asChild variant="outline">
            <Link href={action}>Clear</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}

const controlClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 lg:w-auto lg:min-w-40";

export function FilterSelect({
  name,
  label,
  value,
  options,
  allLabel = "All",
}: {
  name: string;
  label: string;
  value?: string;
  options: readonly { value: string; label: string }[];
  allLabel?: string;
}) {
  const id = `filter-${name}`;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} name={name} defaultValue={value ?? ""} className={controlClass}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterInput({
  name,
  label,
  value,
  type = "text",
  placeholder,
  maxLength = 80,
}: {
  name: string;
  label: string;
  value?: string;
  type?: "text" | "search" | "date";
  placeholder?: string;
  maxLength?: number;
}) {
  const id = `filter-${name}`;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        maxLength={type === "date" ? undefined : maxLength}
        className={controlClass}
      />
    </div>
  );
}

/** Shown when a read fails (e.g. Supabase unreachable) so the page degrades instead of crashing. */
export function QueryError({ what }: { what: string }) {
  return (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden />
      <AlertTitle>Couldn&apos;t load {what}</AlertTitle>
      <AlertDescription>Please refresh the page. If this keeps happening, check the server logs.</AlertDescription>
    </Alert>
  );
}

/** Horizontal-scrolling wrapper for wide tables on small screens. */
export function TableWrap({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
