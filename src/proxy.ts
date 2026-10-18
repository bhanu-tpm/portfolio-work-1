import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { DEFAULT_LOCALE, isAppPath } from "@/i18n/config";

/**
 * - English public pages live at unprefixed URLs (/services) and are rewritten
 *   internally to the [lang] segment (/en/services).
 * - Hindi pages are served as-is from /hi/...
 * - /en/... is redirected to the unprefixed URL so each page has one address.
 * - Dashboard, admin, API and auth callbacks are not localised.
 * Every request also refreshes the Supabase session cookie.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === `/${DEFAULT_LOCALE}` || pathname.startsWith(`/${DEFAULT_LOCALE}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || "/";
    return NextResponse.redirect(url, 308);
  }

  const localised = pathname === "/hi" || pathname.startsWith("/hi/");
  if (localised || isAppPath(pathname)) return updateSession(request);

  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return updateSession(request, url);
}

export const config = {
  matcher: [
    // Skip Next internals, metadata files and static assets.
    "/((?!_next/static|_next/image|favicon.ico|apple-icon|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
