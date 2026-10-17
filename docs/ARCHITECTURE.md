# Architecture

AI-assisted career consultation platform. One consultant (the administrator) serves many clients
(students, graduates, early-career professionals). AI is an assistant to the consultant, never the
decision maker.

## 1. Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components, Server Actions, `proxy.ts`) |
| Language / UI | TypeScript, React 19, Tailwind CSS 4, shadcn/ui (Radix) |
| Auth | Supabase Auth (email + password, email confirmation, password recovery) |
| Database | Supabase Postgres, SQL migrations in `supabase/migrations`, Row-Level Security on every table |
| Files | Private Supabase Storage buckets (`request-files`, `outcome-documents`, `resumes`); public bucket `public-media` for blog covers and the profile photo |
| AI | OpenAI Responses API or Google Gemini (`AI_PROVIDER`) through a server-only provider abstraction (`src/lib/ai`) |
| Email | Resend (optional; every send is recorded in `notifications` with its delivery status) |
| Validation | Zod 4 on every server action and route handler |
| Tests | Vitest (unit), PGlite (real Postgres in WASM) for migrations + RLS, Playwright (smoke e2e) |
| Hosting | Vercel (cron for reminders) + Supabase |

## 2. High-level design

```
Browser ──► proxy.ts (session refresh, optimistic redirects)
        ──► Server Components (read via Data Access Layer, RLS-enforced user client)
        ──► Server Actions / Route Handlers (Zod validation → authorization → DB / storage / AI / email)

src/lib/
  env.ts              typed env access; features report "not configured" instead of faking it
  supabase/           server client (user session, RLS), admin client (service role, server only), anon client (public cached reads)
  auth/dal.ts         getCurrentUser / requireUser / requireAdmin (verified JWT claims + role lookup)
  validation/         Zod schemas shared by forms and server
  booking/slots.ts    deterministic slot generation (timezone aware, buffers, blocked periods)
  ai/                 provider client, intake analyzer, outcome drafter, resource suggester,
                      career assistant, resume reviewer, redaction, moderation, usage tracking
  email/              Resend transport + templates + notification recorder
  rate-limit.ts       Postgres-backed fixed-window limiter (works across serverless instances)
  audit.ts            audit log writer
  storage.ts          upload validation, private upload/download helpers
  pdf/outcome-pdf.ts  outcome → PDF (pdf-lib)
```

### Authorization layers (defense in depth)

1. **proxy.ts** – optimistic redirect for `/dashboard/*` and `/admin/*` without a session (UX only).
2. **Data Access Layer** – every page, action and route handler calls `requireUser()` / `requireAdmin()`,
   which verifies the JWT (`auth.getClaims()`) and reads roles from `user_roles`.
3. **Row-Level Security** – clients can only read their own rows; admin-only tables (notes, AI analyses,
   audit logs, settings) have no client policies at all. Admin access is granted through
   `public.authorize(permission)` which checks `user_roles` + `role_permissions`.
4. **Storage** – private buckets have no client policies. Files are uploaded and downloaded only by
   server code after ownership/approval checks; downloads use 60-second signed URLs.

Admins cannot self-register. An existing account is promoted with `select public.grant_admin('email')`
in the Supabase SQL editor.

### Cache Components

Public content (portfolio, categories, published posts) is read with an anon client inside
`'use cache'` functions tagged (`cacheTag`) and invalidated with `updateTag` from admin actions.
Everything session-dependent renders at request time behind `loading.tsx` / `<Suspense>` boundaries.

## 3. Database schema (summary)

See `supabase/migrations/*.sql` for the full definition.

| Table | Purpose | Client access |
| --- | --- | --- |
| `profiles` | one row per auth user, contact + consent flags | own row (read/update limited columns) |
| `user_roles`, `role_permissions` | RBAC (`admin`, `client`) | read own roles |
| `consultation_categories` | configurable services + intake questions | public read (active only) |
| `consultation_requests` | original client submission (immutable for client) | read own, insert own |
| `request_messages` | client-visible clarification thread | read/insert own |
| `request_status_history` | trigger-maintained status audit | read own |
| `admin_notes` | private consultant notes | none |
| `files` | private file metadata (bucket + path) | read own request attachments / resumes |
| `availability_rules`, `blocked_periods` | weekly hours, blocked ranges | none (slots are computed server side) |
| `appointments` | bookings; **exclusion constraint** on buffered time range prevents double booking | read own |
| `consultation_outcomes` | outcome lifecycle (draft → approved → published → superseded) | read own (status only) |
| `outcome_versions` | immutable content versions + optional PDF | read own **published** version only |
| `blog_posts`, `blog_categories`, `blog_tags`, `blog_post_tags` | CMS | public read of published posts |
| `site_profile`, `portfolio_items` | portfolio/home content | public read (visible items) |
| `ai_runs` | every AI call: feature, model, status, tokens, latency, cost estimate | none |
| `ai_generations` | AI output (original + edited), review status, reviewer | none |
| `ai_conversations`, `ai_messages` | career assistant history | own (delete = clear history) |
| `resume_reviews` | resume feedback | own |
| `notifications` | email/in-app notifications + delivery status | read own |
| `audit_logs` | admin actions, publication, downloads | none |
| `app_settings` | booking, AI, email, privacy settings (JSON) | none |
| `contact_messages` | contact form | none |
| `rate_limits` | limiter buckets | none |

Key invariants enforced in the database:

- `appointments`: `EXCLUDE USING gist (tstzrange(blocked_from, blocked_until) WITH &&)` for active statuses,
  one active appointment per request.
- `consultation_outcomes`: `published` requires an approver and a published version equal to the approved
  version; inserting a new version into an approved outcome resets it to `draft` (approval is invalidated).
- `consultation_requests`: reference code generated in the database; status changes recorded by trigger.

## 3a. Languages (English and Hindi)

- The public website (home, services, portfolio, blog, contact, privacy, AI-guidance preview, sign-in/up) is
  bilingual. English lives at unprefixed URLs (`/services`), Hindi under `/hi` (`/hi/services`).
  `src/proxy.ts` rewrites English requests to the `app/[lang]` segment with `lang=en` and redirects `/en/...`
  to the unprefixed URL. The client dashboard and admin are English-only and have their own root layout
  (`app/(app)/layout.tsx`).
- Fixed site text lives in dictionaries (`src/i18n/dictionaries/{en,hi}/<area>.ts`). Hindi files are typed
  against the English ones, so a missing translation fails type-checking. Server Components use
  `getI18n()` (reads the locale via `next/root-params`); Client Components use `useI18n()`.
- Admin-authored content has optional Hindi columns (`*_hi`, migration `20261015000100_hindi_content.sql`).
  `src/lib/localize.ts` shows the Hindi value when present and falls back to English otherwise; untranslated
  blog posts are labelled "अंग्रेज़ी में".
- Every page declares `hreflang` alternates and the sitemap lists both languages. `<html lang>` is `en-IN`
  or `hi-IN`. Noto Sans/Serif Devanagari are loaded with `unicode-range`, so they only download for Hindi text.
- Hindi copy avoids gendered first-person verbs (करता/करती) so it reads correctly for any consultant.

## 4. Routes

### Public
`/` · `/services` · `/portfolio` · `/blog` · `/blog/[slug]` · `/contact` · `/privacy` · `/assistant` (preview)
· `/login` · `/signup` · `/forgot-password` · `/reset-password` · `/auth/confirm`

### Client (`/dashboard`, authenticated)
overview · `requests` · `requests/new` · `requests/[id]` · `appointments` · `appointments/book` ·
`outcomes` · `outcomes/[id]` · `assistant` · `resume` · `settings`

### Admin (`/admin`, admin role)
overview · `requests` · `requests/[id]` (submission, AI analysis, notes, status, messages) · `clients` ·
`clients/[id]` · `appointments` · `availability` · `outcomes` · `outcomes/[id]` (editor, AI draft, versions,
approval, publish) · `blog` · `blog/new` · `blog/[id]` · `portfolio` · `categories` · `settings` · `ai-usage` · `audit`

### Route handlers
- `GET /api/outcomes/[id]/download` – ownership + publication check, audit, 60 s signed URL redirect
- `GET /api/files/[id]` – request attachment / resume download (owner or admin)
- `GET /api/cron/reminders` – appointment reminders (`CRON_SECRET`)
- `GET /auth/confirm` – email confirmation / recovery token exchange

Mutations are Server Actions co-located under `src/app/**/actions.ts` (including the career
assistant turn: auth → consent → moderation → rate limit → model → persistence).

## 5. AI design

- **Provider abstraction** (`src/lib/ai/provider.ts`): `generateStructured({ schema, system, input })`
  with timeout, SDK retries for transient errors, Zod validation of the parsed output, one repair retry
  on malformed output, and a typed `AiError` with a user-friendly message.
- **Every call** is wrapped by `runAiFeature()` which checks the feature flag + per-user rate limit,
  records an `ai_runs` row (model, tokens, latency, estimated cost, error) and never throws into the
  core workflow.
- **Data minimisation**: `redact()` removes emails, phone numbers, URLs and the client's name before text
  leaves the server; admin private notes are never sent unless the admin explicitly selects them for the
  outcome draft.
- **Prompt injection**: untrusted text is wrapped in delimited blocks and the system prompt states it is
  data. Models get no tools; output is schema-validated and only ever stored as a draft/suggestion.
- **Human control**: AI analyses are labelled, editable, dismissible; AI outcome drafts become versions that
  still need explicit approval and publication by the admin.
- **Kill switches**: `AI_ENABLED` env + per-feature toggles in `app_settings.ai`. Booking, dashboards and
  outcome management work with AI disabled.

## 6. Implementation phases

1. Foundation: project, migrations, auth, public pages, categories, intake, admin requests.
2. Scheduling: availability, slot engine, safe booking, client dashboard, notifications.
3. AI: provider, intake analyzer, outcome drafting, validation, usage tracking.
4. Outcomes: editor, approval, versions, PDF storage, authenticated downloads.
5. Content + student AI: blog CMS, portfolio editor, career assistant, resume review, limits.
6. Testing + deployment docs.
