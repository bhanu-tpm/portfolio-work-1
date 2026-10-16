/**
 * Images hosted in the project's Supabase Storage are optimised by next/image
 * (see remotePatterns in next.config.ts). Any other https URL is rendered
 * unoptimised rather than failing.
 */
export function shouldOptimize(url: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(base && url.startsWith(`${base.replace(/\/$/, "")}/storage/v1/object/public/`));
}
