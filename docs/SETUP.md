# Setup, development and deployment

## 1. Prerequisites

- Node.js 20.9+ (developed on Node 24) and npm
- A Supabase project (free tier is fine)
- Optional: an OpenAI or Google Gemini API key (AI features), a Resend account with a verified domain (email), a Vercel account (hosting)

The app runs without OpenAI and Resend. AI features show "not configured", and notifications are
recorded with status `skipped` instead of being sent. It never pretends a missing service works.

## 2. Supabase

1. **Create a project** at <https://supabase.com>. From *Project Settings → API* copy:
   - the project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - the publishable/anon key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - the secret/service-role key → `SUPABASE_SECRET_KEY` (server only, never exposed to the browser)
2. **Apply the migrations** in `supabase/migrations` in filename order. Either:
   - **CLI:** `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`, or
   - **Dashboard:** paste each file into the *SQL editor* and run it, in order.
3. **Optional starter content:** run `supabase/seed.sql` in the SQL editor. It contains placeholder
   categories, weekday availability, two sample blog posts and placeholder profile text. Replace all of it from the admin dashboard.
4. **Auth settings** (*Authentication → URL configuration*):
   - Site URL: your deployed URL (e.g. `https://consult.example.com`), or `http://localhost:3000` for local development.
   - Redirect URLs: add `http://localhost:3000/**` and `https://<your-domain>/**`.
   - Keep *Confirm email* enabled. Confirmation and password-reset links go to `/auth/confirm`, which supports
     both the default PKCE `code` links and `token_hash` email templates.
   - For production email delivery from Supabase Auth, configure custom SMTP (*Authentication → Emails → SMTP*);
     Resend provides SMTP credentials.
5. **Create the administrator account:** sign up through `/signup`, confirm the email, then run this in the SQL editor:
   ```sql
   select public.grant_admin('you@yourdomain.com');
   ```
   Nobody can make themselves an administrator through the app: the function can't be called through the API.
6. **Storage:** the migrations create the buckets (`request-files`, `outcome-documents` and `resumes` are private; `public-media` is public).
   No storage policies are needed: private files are only accessed by server code after authorization checks.

## 3. AI: OpenAI or Google Gemini (optional)

- Set `OPENAI_API_KEY` and `AI_ENABLED=true`.
- `OPENAI_MODEL` defaults to `gpt-5-mini`. Use any current model that supports structured outputs in the
  Responses API, and check OpenAI's model list when deploying. The admin can also override the model in *Admin → Settings*.
- Update `AI_INPUT_PRICE_PER_MTOK` / `AI_OUTPUT_PRICE_PER_MTOK` to match your model's current pricing. They only
  feed the cost estimates and the monthly budget cap.
- `AI_WEB_SEARCH=true` lets resource suggestions use OpenAI's web search tool. Only links the search actually cited are shown;
  everything else is marked as an unverified suggestion.
- Requests are sent with `store: false`. Client names, emails, phone numbers and links are removed before sending.

### Google Gemini instead of OpenAI (free tier available)

- Create a key at <https://aistudio.google.com> (*Get API key*; no card needed for the free tier).
- Set `AI_PROVIDER=gemini`, `GEMINI_API_KEY` and `AI_ENABLED=true`. `OPENAI_API_KEY` is then not needed.
- `GEMINI_MODEL` defaults to `gemini-flash-latest` (Google's alias for its current Flash model). The admin model
  override in *Admin → Settings* applies to whichever provider is selected, so clear it when switching providers.
- Cost estimates default to 0 for Gemini (free tier), so the monthly budget never blocks it. On a paid plan, set
  `GEMINI_INPUT_PRICE_PER_MTOK` / `GEMINI_OUTPUT_PRICE_PER_MTOK`.
- Differences from OpenAI: there is no web search (`AI_WEB_SEARCH` is ignored), and because Gemini has no moderation
  endpoint, each assistant message is first classified by Gemini itself, so it uses two requests of the free quota.
- Free-tier terms allow Google to use requests to improve its products. The privacy notice switches to that wording
  automatically when `AI_PROVIDER=gemini`.
- When the free quota runs out, users see "temporarily unavailable" and the AI usage log records the quota error.

## 4. Resend (optional)

1. Verify a sending domain in Resend.
2. Set `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Consultations <hello@yourdomain.com>`) and `ADMIN_NOTIFICATION_EMAIL`.
3. Individual notification types can be switched off in *Admin → Settings*. Delivery status is visible in *Admin → Notifications*.

## 5. Local development

```bash
npm install
cp .env.example .env.local     # then fill in values
npm run dev                    # http://localhost:3000
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Unit + database/RLS tests (Vitest; DB tests run the real migrations in PGlite, no Docker needed) |
| `npm run test:db` | Only the database/RLS tests |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | Typecheck then production build |
| `npm run test:e2e` | Playwright smoke tests against `next start` (run `npm run build` first). Uses Microsoft Edge by default; set `PLAYWRIGHT_CHANNEL=chromium` after `npx playwright install chromium` |

## 6. Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel (framework preset: Next.js).
2. Add every variable from `.env.example` in *Project → Settings → Environment Variables*, with `NEXT_PUBLIC_SITE_URL`
   set to the production URL.
3. Set `CRON_SECRET` to a long random string. `vercel.json` schedules `/api/cron/reminders`, which sends appointment
   reminders and applies the retention policy. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
   The default schedule is daily at 02:30 UTC (08:00 IST), which works on the Hobby plan; reminders then go out once a
   day for appointments within the reminder window. On Pro, change the schedule in `vercel.json` to `0 * * * *` (hourly).
4. Deploy, then update the Supabase Auth Site URL and redirect URLs to the production domain.
5. Check: sign up, grant admin, submit a request, accept it, book a slot, create, approve and publish an outcome,
   then download it as the client.

## 7. Operations

- **Backups:** Supabase Pro includes daily backups and point-in-time recovery as an add-on. On the free tier, schedule
  `npx supabase db dump --data-only > backup.sql` (and a schema dump) from a trusted machine or CI, and store the dumps
  encrypted. Storage objects are not included in database dumps; back them up separately if needed.
- **Error monitoring:** server errors are logged with `console.error` and appear in Vercel function logs. For alerting,
  add Sentry (`@sentry/nextjs`) or a log drain.
- **Audit trail:** admin actions, approvals, publications, downloads and settings changes are in *Admin → Audit log*.
- **Retention:** configured in *Admin → Settings → Privacy* and applied by the cron job.
- **Key rotation:** rotating the Supabase secret key or the OpenAI key only requires updating the environment variables and redeploying.
