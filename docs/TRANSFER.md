# Machine-transfer guide

## Requirements

- Node.js compatible with the installed Next.js 16.3.4 toolchain.
- npm.
- A Supabase project and service-role API key.
- Optional: Vercel CLI, PostgreSQL client, GitHub token, Groq keys.

## Fresh checkout

```bash
git clone <repository-url> examstudio1.1
cd examstudio1.1
npm install
cp .env.example .env.local
npx tsc --noEmit
npm run lint
npm run dev
```

The local application uses the port printed by Next.js (normally `http://localhost:3000`). Some historical screenshots use port 3001; do not hard-code that assumption.

## Environment variables

Required server variables are listed in [ENVIRONMENT.md](ENVIRONMENT.md). Copy values through a password manager or deployment provider; never commit `.env.local`, paste secrets into chat, or put service-role/Groq/API tokens in client code.

## Database

For a new database, apply migrations in numeric order from `supabase/migrations/001_ca1_schema.sql` through `036_ca3_evaluation_complete_status.sql`, including both files beginning with `030_`. See [DATABASE.md](DATABASE.md) for the duplicate `030` filenames and the legacy-source prerequisites.

The current repository does not provide a migration runner in `package.json`. Apply SQL through Supabase SQL Editor or an approved migration runner. Before production migration:

1. Export a database backup.
2. Verify the target project and environment.
3. Apply one migration at a time and record the result.
4. Check constraints and row counts.
5. Never re-run a data mutation blindly unless the migration is explicitly idempotent.

## Run locally

```bash
npm run dev
npx tsc --noEmit
npm run lint
npm run build
```

Tests are plain Node tests and are not wired into an npm script:

```bash
node --test tests/*.mjs
```

## Production handoff

- Configure all server variables in Vercel for the correct environment.
- Redeploy after changing environment variables.
- Confirm the Supabase URL is the HTTPS project URL used by `@supabase/supabase-js`.
- Confirm the database pooler URL, if used by external tooling, is separate from `SUPABASE_URL`.
- Test `/sa/login`, `/sa/dashboard`, student login, and one read-only report.
- Confirm the deployed build includes the current migrations and no `.env.local` content.

## Handoff checklist

- [ ] Git working tree reviewed; unrelated local changes preserved.
- [ ] `.env.local` transferred securely, not committed.
- [ ] Dependencies installed from lockfile.
- [ ] TypeScript and lint pass, or failures recorded.
- [ ] Supabase project and migration state identified.
- [ ] Staff credentials transferred through a secure channel.
- [ ] Groq/GitHub/Apify quotas and tokens verified.
- [ ] Storage bucket `ca3-artifacts` exists and is private.
- [ ] CA1 corpus files and reference table are present.
- [ ] Vercel environment values and custom domain verified.
