# Reports, debriefs, and exception recording

Implemented staff reports at `/sa/reports`, post-exam CO/Bloom's panels on the staff dashboard, exception recording on student detail pages, and MCQ answer debriefs on `/results`.

## Database deployment

The configured `.env.local` Supabase project is connected with verified TLS. On 2026-09-09, migrations 001–003 were applied successfully and the seeded staff placeholder password hash was initialized. The seed produced one exam definition, three tasks, 40 MCQ questions, and 233 roster entries.

For a fresh project, run these scripts in the Supabase SQL editor in order (already applied to the configured project):

1. `supabase/migrations/001_ca1_schema.sql`
2. `supabase/migrations/002_ca1_seed.sql`
3. `supabase/migrations/003_reports_and_enrollment.sql`
4. Generate and apply the staff password hash as documented in the original setup instructions. The seed hash is a placeholder.

For an existing CA1 database, apply only migration 003. It adds a nullable course attainment percentage and a student-to-session foreign key. Students with issued papers are backfilled from the paper's session. Students without papers are deliberately not guessed from registration timestamps or the shared spreadsheet: assign their `ca1_students.session_id` using verified batch attendance records. Reports display a warning counting unassigned students across the database.

Deploy migration 003 before this code. Registration now records the chosen open session. Student status, MCQ answers, paper retrieval, task submissions, and key generation use the student's assigned session. This prevents another batch's lifecycle from changing their result visibility or allowing changes to a completed exam. MCQs are available during registration and running, as specified in the latest project prompt.

`SUPABASE_URL` must remain the HTTPS project API URL for the Supabase JS SDK. A pooled Postgres URL on port 6543 is a separate `DATABASE_URL` for SQL migration tooling, not a replacement for `SUPABASE_URL`. The service-role SDK key alone cannot execute arbitrary migrations.

The original pre-exam setup still applies: generate the corpus and reference table, publish the Task 3 spreadsheet, configure the cron secret and hosting, then create a session. This implementation has not been deployed to Vercel. The migrations added the CA1 tables without altering unrelated existing application tables.

## Reports

- `GET /api/sa/reports/marks-sheet?session_id=N`: XLSX with string PRNs, effective task marks, totals, percentages, and count/mean/median/population standard deviation/min/max.
- `GET /api/sa/reports/student-pdf?student_id=N`: paginated PDF containing served option order, responses and rationale, practical parameters, submitted and expected values, grading details, explicit overrides, run IDs, and stored server weather reference.
- `GET /api/sa/reports/co-attainment?session_id=N`: CO averages and threshold counts plus Bloom's marks distribution.
- `POST /api/sa/reports/co-attainment`: Super Admin only; `{ session_id, co_attainment_threshold }`, percentage 0–100 or null. Updates the exam definition for all its sessions and records an audit event.
- `GET /api/sa/reports/item-analysis?session_id=N`: slot difficulty, discrimination, and per-question-variant option distributions.

All report GET routes require staff authentication and a closed or archived session. Responses are private and not cached. Pending/deferred verification makes reports provisional. Missing/ungraded tasks count as zero; `override_marks ?? marks_awarded` always takes precedence, including a zero override. Enrolled students without papers or submissions are included.

Difficulty is correct answers divided by all enrolled students, in percent. Discrimination uses the top and bottom `floor(n/3)` students ranked by effective overall exam marks; PRN breaks ties reproducibly. It is null for cohorts smaller than three. Options are grouped by original question variant and option key, since shuffled display positions are not comparable. Empty cohorts return null summary averages. Threshold counts use an inclusive `>=` comparison; null means the course owner has not supplied a threshold.

PDFs escape unsupported standard-font characters as `[U+XXXX]` rather than dropping text. The existing question bank must remain immutable after use: the original schema retains question IDs and option order, not historical copies of edited question text.

## Exceptions and student debrief

`POST /api/sa/exceptions` requires staff authentication and accepts `{ student_id, kind, detail }`. Kinds: shared_lab_account, machine_failure, network_failure, extension. Details are required and limited to 5,000 characters. Recording an exception creates an administrative record and an audit event, not an integrity flag or an automatic time/mark adjustment. Existing integrity flags remain available for staff resolution.

`GET /api/me/mcq-results` requires a student cookie and checks that student's assigned session before loading correct answers. It returns original options in served order, the student's selection, the correct key, rationale, and marks only after closure/archive.

## Validation

Run `npm test` for calculation, export, authentication and debrief-gating regression tests. Run `npx tsc --noEmit` and `npm run build`. When Turbopack cannot start its local worker in a restricted environment, `npm run build -- --webpack` is available.

Full repository lint currently includes pre-existing React effect errors and a CommonJS script import error; new report modules can be checked independently with:

```sh
npx eslint app/api/sa/reports app/api/sa/exceptions app/api/me/mcq-results app/sa/reports components/reports lib/reports.ts lib/report-math.ts lib/student-pdf.ts tests/reports.test.mjs
```

## Verified database connection and migration commands

A PostgreSQL client is now installed as a development dependency. The public Supabase root certificate is bundled in `supabase/certs/prod-ca-2021.crt`, downloaded from the link in Supabase's official dashboard source. Scripts load `.env.local` before `.env` and verify both the CA chain and pooler hostname. URL SSL parameters cannot weaken that verification. No system-wide trust settings are modified.

Copy the exact **Session pooler** URL from this project's Supabase **Connect** panel into `DATABASE_URL` in `.env.local`. Keep the host exactly as supplied; the `aws-0`/`aws-1` portion and region must match the project. Replace the password placeholder with the URL-encoded database password. The SDK's HTTPS `SUPABASE_URL` remains unchanged.

```sh
npm run db:check    # Read-only connection and schema-presence check
npm run db:plan     # List local SQL files and checksums, without connecting
npm run db:migrate  # Apply pending migrations atomically; records checksums
```

The runner uses a transaction-scoped advisory lock (compatible with transaction pooling), records migrations in `ca1_schema_migrations`, detects edits to applied migrations, and rolls back the batch if a migration fails. Re-running skips applied files. An existing manually migrated CA1 database without this history is rejected for reconciliation rather than re-seeded. The seed's placeholder staff password still requires the documented staff-password initialization step.

Connection resolved on 2026-09-09: the official CA fixed `SELF_SIGNED_CERT_IN_CHAIN`; correcting the pooler host from `aws-0` to `aws-1` and using the supplied Session pooler URL fixed tenant routing. Authenticated access passed with certificate verification enabled. All three migrations were applied using `npm run db:migrate`, and the documented seeded staff password was initialized and verified without displaying credentials.
