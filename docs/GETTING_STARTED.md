# Getting started on a new machine

Step-by-step guide to clone and run the project on a fresh laptop. For full details on every service and
environment variable, see [SETUP.md](SETUP.md).

The public site runs without any external services. Sign-in, dashboards and booking need a (free) Supabase project.

## 1. Install the tools

- **Git:** <https://git-scm.com>
- **Node.js:** LTS version, 20.9 or newer: <https://nodejs.org>
- **Editor (optional):** VS Code

Check they are installed:

```bash
git --version
node --version
```

## 2. Clone and run

```bash
git clone https://github.com/bhanu-tpm/portfolio-work-1.git
cd portfolio-work-1
npm install
cp .env.example .env.local      # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Open <http://localhost:3000> (English) or <http://localhost:3000/hi> (Hindi).

If the repository is private, Git asks you to sign in: use the GitHub account that owns the repository.

## 3. Set your Git identity

Once per machine, so your commits use your personal name and email:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## 4. Connect a database (for the full app)

1. Create a free project at <https://supabase.com>.
2. From *Project Settings → API*, copy these into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
3. In the Supabase *SQL editor*, run each file in `supabase/migrations/` in filename order, then
   `supabase/seed.sql` if you want the sample content.
4. In *Authentication → URL configuration*, add `http://localhost:3000/**` as a redirect URL.
5. Restart `npm run dev` and sign up at `/signup`.
6. Make that account the administrator (in the SQL editor):

   ```sql
   select public.grant_admin('you@example.com');
   ```

AI features (OpenAI key) and email sending (Resend) are optional. Without them the app shows
"not configured" for those features. See [SETUP.md](SETUP.md) sections 3 and 4.

## 5. Save and push changes

```bash
git add -A
git commit -m "Describe your change"
git push
```

API keys belong only in `.env.local`, which Git ignores, so they are never pushed.
