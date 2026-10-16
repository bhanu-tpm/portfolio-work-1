# Code conventions

Read `docs/ARCHITECTURE.md` first. This file lists the concrete patterns used in the codebase.

## Next.js 16 specifics (differs from older Next.js)

- `cacheComponents: true`. Any component that reads cookies/headers/searchParams/params or does an
  uncached DB call must render inside a `<Suspense>` boundary. Every route segment under `/dashboard`
  and `/admin` has a `loading.tsx`, which provides that boundary for pages. Do **not** read the session
  at the top level of a layout.
- Public, shared content is read through `src/lib/content.ts` (`'use cache'` + `cacheTag`). After an
  admin changes public content, call `refreshPublicContent("posts" | "portfolio" | "profile" | "categories")`
  from `src/lib/admin-cache.ts` inside the Server Action (uses `updateTag`, Server Actions only).
- Page props use the generated global helpers: `PageProps<"/route/[id]">`, `LayoutProps<"/route">`,
  `RouteContext<"/api/x/[id]">` for route handlers. `params` and `searchParams` are Promises.
- Middleware is `src/proxy.ts`. `forbidden()` is experimental and not used; non-admins get `notFound()`.
- Run `npx next typegen` after adding routes, then `npx tsc --noEmit`.

## Languages (public site)

- Public routes live under `src/app/[lang]/`. Never hard-code public links: use `href("/path")` from
  `getI18n()` / `useI18n()` (or `localePath(locale, path)`). Links to `/dashboard`, `/admin`, `/api` stay as-is.
- Put new public text in `src/i18n/dictionaries/en/<area>.ts` and the Hindi version in `hi/<area>.ts`
  (typed with the English type), registered in `dictionaries/index.ts`. Use `fmt(str, { name })` for `{name}`
  placeholders.
- Admin-authored content: show it through the helpers in `src/lib/localize.ts`.
- Each page's `generateMetadata` returns localised text and `alternates: languageAlternates("/path")`.
- Hindi style: simple, friendly Hindi; avoid gendered first-person verbs; "आप" for the reader.

## Files and encoding

- Edit files with the Edit/Write tools. Do **not** rewrite files with Windows PowerShell
  `Get-Content`/`Set-Content` — it corrupts UTF-8 and adds a BOM.
- Use `@/` imports. Utilities: `cn` from `"cn"`.

## Authorization

- Pages: `await requireUser(path)` / `await requireAdmin()` from `@/lib/auth/dal`.
- Server Actions and route handlers: `await assertUser()` / `await assertAdmin()` (throw `AuthorizationError`).
- Read client data with `await createClient()` (`@/lib/supabase/server`) — runs under RLS as the user.
- `createAdminClient()` bypasses RLS: use only after an explicit authorization check, for system writes
  (notifications, files, AI records, bookings) and storage.

## Server Actions

```ts
"use server";
export async function doThing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = someSchema.safeParse(values);          // Zod schema in src/lib/validation/schemas.ts
  if (!parsed.success) return validationFailure(parsed.error, values);
  try {
    const user = await assertAdmin();
    // ... work ...
    await audit(user.id, "thing.changed", "thing", id);  // admin actions are audited
    revalidatePath("/admin/things");
    return { ok: true, message: "Saved." };
  } catch (err) {
    return failure(err);                                  // safe message; logs unexpected errors
  }
}
```

- Throw `UserFacingError("...")` for messages that are safe to show.
- `redirect()` must be called **outside** `try/catch`.
- Side effects that shouldn't delay the response (emails, AI) go in `after(() => ...)` from `next/server`.
- Emails: `notify({...})` from `@/lib/email/notify` — never throws, records delivery status.

## Forms (client components)

`useActionState(action, initialActionState)` with the helpers in `@/components/shared/form`:
`TextField`, `TextAreaField`, `NativeSelectField`, `CheckboxField`, `FormMessage`, `SubmitButton`.
They show field errors from `state.fieldErrors` and keep values from `state.values`.
Destructive actions use `AlertDialog` confirmation (`@/components/ui/alert-dialog`).

## UI

- Layout helpers: `PageHeader`, `Section`, `EmptyState`, `DefinitionList`, `LoadingBlock`, `AiLabel`
  (`@/components/shared/page`), `StatusBadge` (`@/components/shared/status-badge`), `Markdown`.
- Status labels/tones and date formatting: `@/lib/format` (timezone default Asia/Kolkata).
- Palette tokens: `primary` (navy), `teal`, `secondary`, `accent`, `muted`, `success`, `warning`, `destructive`.
- Mobile first: stack on small screens, `sm:`/`md:` for wider layouts. Tables need an
  `overflow-x-auto` wrapper or a stacked card layout on mobile.
- Every input has a label; icons that convey meaning have `aria-label`, decorative ones `aria-hidden`.

## AI

All AI calls go through `runAiFeature()` (`@/lib/ai/run`) which handles flags, budget, rate limits
and usage records, and never throws. Feature logic lives in `@/lib/ai/features.ts`. AI output is
always labelled (`AiLabel`) and never auto-applied to approvals/publication.

## Tests

`npm test` (Vitest). DB/RLS tests in `tests/db` run the real migrations in PGlite.
