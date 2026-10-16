# Career Consultation Platform

A personal-brand platform for delivering career and education consultations to students, graduates and
early-career professionals. It covers the full lifecycle: requirements gathering, review, scheduling, the
consultation itself, AI-assisted preparation and outcome drafting, explicit approval, and secure delivery of
the final document.

> Personal learning / proof-of-concept project. All sample content is fictional placeholder text.

## Highlights

- **Public site:** home page, services, portfolio, blog (search, categories, tags, RSS, SEO metadata), contact form with spam protection, privacy notice.
- **Client dashboard:** structured consultation requests with attachments, status tracking and clarification threads, appointment booking and change requests, published outcomes with PDF download, optional AI career guidance assistant and resume review, profile and privacy controls.
- **Admin dashboard:** request lifecycle, private notes, AI intake summaries, clients, appointments and availability, outcome editor with versions, AI drafting, resource suggestions, approval and publication, blog CMS, portfolio editor, category management, settings, AI usage, notifications and audit log.
- **Security:** Supabase Auth, server-side authorization on every page, action and route, Row-Level Security on every table, private storage with short-lived signed URLs, a database exclusion constraint against double booking, and a database-enforced outcome approval state machine.
- **AI with a human in charge:** structured, schema-validated outputs; data minimisation; prompt-injection containment; usage tracking with budget and rate limits. Every AI feature can be switched off independently and the core service keeps working without AI.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): architecture, schema, routes, AI design
- [docs/SETUP.md](docs/SETUP.md): environment variables, Supabase/OpenAI/Resend setup, local development, deployment, operations
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md): code patterns for contributors

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys at minimum
npm run dev
npm test                     # unit + RLS tests (no Docker required)
```
