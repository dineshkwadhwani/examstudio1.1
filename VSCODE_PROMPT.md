# Exam Studio — Complete VS Code / Cursor Project Prompt

Paste this entire document into Cursor or VS Code Copilot Chat at the start of a new session. It contains everything needed to understand, build, extend, or debug this project without asking any clarifying questions.

---

## What this project is

**Exam Studio** — a web-based practical examination platform built for Symbiosis Institute of Technology, Pune. The current exam is F0003 CA1 (Autonomous AI Systems and Agent-Based Computing), 15 marks, 50 minutes, ~230 students across two sequential batches.

**What students do:**
1. Register with their institutional email and PRN
2. Answer 10 MCQ questions — each answer saved to the server the moment they click, no submit button
3. Generate an exam API key (shown once, stored as a hash)
4. Write and deploy an Apify actor that:
   - Fetches their question paper via the exam API
   - Crawls a 250,000-word corpus and counts word occurrences
   - Fetches a city temperature from Open-Meteo
   - POSTs both results to the exam API
5. View their results after the exam closes

**What the platform does:**
- Grades all submissions mechanically — no human reads code
- Verifies Apify runs against the platform's own token
- Detects shared Apify accounts and flags them
- Produces per-student answer records and institutional reports

---

## Technology stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, App Router, TypeScript, strict mode |
| Database | Supabase Postgres, pooled connection (port 6543) |
| Hosting | Vercel (cron job every 1 min) |
| Auth | JWT cookie via `jose`, cookie name `ca1_session`, 24h expiry |
| Passwords | bcryptjs, cost 12 |
| Styling | Tailwind CSS v4 with custom utility classes in `globals.css` |
| DB client | Supabase JS SDK, service role key, lazy singleton, never client-side |

---

## Project setup from scratch

If starting from the zip file (`examstudio-final.zip`), do exactly this:

```bash
# 1. Unzip
unzip examstudio-final.zip
cd examstudio

# 2. Install dependencies
npm install

# 3. Copy env file and fill it in
cp .env.example .env.local
# Edit .env.local — see Environment Variables section below

# 4. Run dev server
npm run dev
# App runs at http://localhost:3000

# 5. Generate SA password hash (do this before setting up Supabase)
node scripts/generate-sa-hash.js
# Copy the UPDATE statement it prints

# 6. Generate corpus (do this once before exam)
npx ts-node --project tsconfig.node.json scripts/generate-corpus.ts
# Creates public/corpus/ — commit this to git

# 7. Generate Task 3 spreadsheet
npx ts-node --project tsconfig.node.json scripts/generate-spreadsheet.ts
# Creates scripts/task3-spreadsheet.csv — upload to Google Sheets
```

---

## Environment variables

Create `.env.local` for development. Add these to Vercel for production.

```env
# Supabase — find in your project → Settings → API
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# JWT signing key — any random string, minimum 32 characters
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=replace-with-a-long-random-string-minimum-32-characters

# Apify — Dinesh's personal API token, for verifying student run IDs
# Find at: https://console.apify.com/account/integrations
APIFY_API_TOKEN=your-apify-api-token-here

# App public URL
NEXT_PUBLIC_APP_URL=https://examstudioca2.thecoachdinesh.com

# Task 3 spreadsheet — Google Sheets CSV export URL
# Format: https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0
# This is read server-side at session creation — never entered in the UI
TASK3_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv&gid=0
```

**Critical rules:**
- `SUPABASE_SERVICE_ROLE_KEY` must never reach the browser — server routes only
- `TASK3_SHEET_CSV_URL` is read automatically when SA creates a session — do not add a URL input to the UI

---

## Supabase setup

Run these in order in the Supabase SQL editor:

**Step 1:** Run `supabase/migrations/001_ca1_schema.sql` — creates all 17 tables, RLS, indexes

**Step 2:** Run `supabase/migrations/002_ca1_seed.sql` — seeds SA account (placeholder hash), exam definition, 40 MCQ questions, 231-student roster

**Step 3:** Fix the SA password hash:
```bash
node scripts/generate-sa-hash.js
```
Copy the `UPDATE` statement it outputs and run it in Supabase SQL editor.

**Step 4:** Add these two RPC functions (needed by the MCQ route):
```sql
CREATE OR REPLACE FUNCTION increment_times_served(qid BIGINT) RETURNS void AS $$
  UPDATE ca1_mcq_questions SET times_served = times_served + 1 WHERE id = qid;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_times_correct(qid BIGINT) RETURNS void AS $$
  UPDATE ca1_mcq_questions SET times_correct = times_correct + 1 WHERE id = qid;
$$ LANGUAGE sql;
```

**Step 5:** Use the **pooled connection string** (port 6543, transaction mode) for `SUPABASE_URL` — not the direct connection. This is critical for Vercel serverless. Find it in Supabase → Settings → Database → Connection Pooling.

---

## Complete file tree

```
examstudio/
│
├── .env.example                   ← copy to .env.local and fill in
├── vercel.json                    ← cron every 1 min + corpus CDN cache headers
├── next.config.ts                 ← empty, no custom config needed
├── tsconfig.json                  ← strict TypeScript, @/* path alias
├── tsconfig.node.json             ← for ts-node scripts (commonjs)
├── package.json
│
├── app/
│   ├── layout.tsx                 ← root layout, Inter font
│   ├── page.tsx                   ← redirects / → /login
│   ├── globals.css                ← ALL custom Tailwind classes (see below)
│   │
│   ├── login/page.tsx             ← student login form
│   ├── register/page.tsx          ← student registration form
│   ├── change-password/page.tsx   ← shown when must_change_password = true
│   ├── dashboard/page.tsx         ← main student screen, polls /api/me/status every 8s
│   ├── mcq/page.tsx               ← 10 questions, per-click save, SaveTick component
│   ├── results/page.tsx           ← shown after exam closes, reads /api/me/status
│   │
│   ├── sa/
│   │   ├── login/page.tsx         ← staff login (role: 'staff' in body)
│   │   ├── dashboard/page.tsx     ← live board + session controls, polls every 5s
│   │   ├── students/page.tsx      ← searchable/sortable student list
│   │   ├── students/[id]/page.tsx ← full student detail: MCQ, tasks, overrides, timeline
│   │   ├── flags/page.tsx         ← integrity flags with resolution form
│   │   └── session/
│   │       ├── page.tsx           ← Suspense wrapper (required for useSearchParams)
│   │       └── SessionConfigClient.tsx ← reference table upload form
│   │
│   └── api/
│       ├── auth/
│       │   ├── register/route.ts  ← POST: validates PRN vs roster, creates student
│       │   ├── login/route.ts     ← POST: handles role: 'student' | 'staff'
│       │   ├── logout/route.ts    ← POST: clears cookie
│       │   └── change-password/route.ts ← POST: updates hash, re-issues session
│       │
│       ├── keys/route.ts          ← GET: returns prefix | POST: generates key (shown once)
│       ├── mcq/route.ts           ← GET: assigns + returns questions | POST: saves answer
│       ├── me/status/route.ts     ← GET: session-cookie version of status (for dashboard)
│       │
│       ├── v1/                    ← exam API, all use X-API-Key header
│       │   ├── paper/route.ts     ← GET: MCQ gate, idempotent, rate-limited 30/min
│       │   ├── status/route.ts    ← GET: task status
│       │   └── submit/
│       │       ├── task2/route.ts ← POST: word count submission, returns 202
│       │       └── task3/route.ts ← POST: temperature submission, returns 202
│       │
│       ├── sa/                    ← all require staff session cookie
│       │   ├── session/route.ts   ← GET: list | POST: create/transition/set_reference_table/toggle_apify_relax
│       │   ├── session/stats/route.ts ← GET: live board numbers
│       │   ├── students/route.ts  ← GET: list (?search=) or detail (?id=N)
│       │   ├── flags/route.ts     ← GET: all flags | POST: resolve flag
│       │   └── override/route.ts  ← POST: override_marks | reset_password
│       │
│       └── cron/verify/route.ts   ← GET: auto-closes expired sessions, runs verifications
│
├── components/ui/
│   ├── Alert.tsx                  ← {type: 'error'|'success'|'info'|'warning', message: string}
│   ├── Countdown.tsx              ← live countdown timer, turns red under 5 minutes
│   └── SaveTick.tsx               ← green tick or red X, shows 2s after server response
│
├── lib/
│   ├── types.ts                   ← all TypeScript interfaces (ExamSession, Student, etc.)
│   ├── db.ts                      ← lazy Supabase singleton proxy + audit() helper
│   ├── session.ts                 ← JWT cookie: createSession, getSession, requireStudent/Staff/SA
│   ├── api.ts                     ← response helpers: ok/err/forbidden/badRequest/serverError
│   │                                 + resolveApiKey, getActiveSession, getOpenSession, sha256
│   ├── paper.ts                   ← makeSeed, pickWord, pickPage, buildRenderedPaper,
│   │                                 shuffleOptions, pickQuestion — all deterministic
│   ├── apify.ts                   ← getRun, getDatasetItems, getActorSource, verifyRun
│   ├── weather.ts                 ← getCurrentTemperature (Open-Meteo, no key)
│   └── grading.ts                 ← awardTask1, gradeTask2, gradeTask3, runPendingVerifications
│
└── scripts/
    ├── generate-corpus.ts         ← creates public/corpus/ (5 HTML pages + reference-table.json)
    ├── generate-spreadsheet.ts    ← creates scripts/task3-spreadsheet.csv (upload to Google Sheets)
    └── generate-sa-hash.js        ← prints bcrypt hash + UPDATE SQL for the SA account
```

---

## globals.css — custom Tailwind classes

These classes are used throughout. They must exist in `app/globals.css` under `@layer components`:

| Class | Description |
|---|---|
| `.card` | White rounded panel with border, padding 1.25rem |
| `.btn-primary` | Blue button (#2563eb), bold, hover darker |
| `.btn-secondary` | Gray button, border, hover lighter |
| `.btn-danger` | Red button (#dc2626), hover darker |
| `.input` | Full-width text input with blue focus ring |
| `.label` | Form label, 0.875rem, medium weight |
| `.badge` | Base badge (inline-flex, rounded-full, small) |
| `.badge-green` | Green badge (bg #dcfce7, text #166534) |
| `.badge-yellow` | Yellow badge (bg #fef9c3, text #854d0e) |
| `.badge-red` | Red badge (bg #fee2e2, text #991b1b) |
| `.badge-blue` | Blue badge (bg #dbeafe, text #1e40af) |
| `.badge-gray` | Gray badge (bg #f3f4f6, text #6b7280) |

---

## Database — 17 tables (all prefixed `ca1_`)

| Table | Purpose |
|---|---|
| `ca1_exam_definitions` | Exam config: duration, marks, email domain |
| `ca1_exam_tasks` | Task definitions (T1, T2, T3) with CO/Bloom's |
| `ca1_task_components` | Grading rubric per task (exact/tolerance/gate) |
| `ca1_mcq_slots` | 10 concept slots per exam |
| `ca1_mcq_questions` | 40 questions: 4 variants × 10 slots |
| `ca1_exam_sessions` | One per batch — contains frozen sheet_snapshot and reference_table |
| `ca1_roster` | PRN + name only — validated at registration |
| `ca1_students` | Registered students, password hashes |
| `ca1_api_keys` | SHA-256 hashed keys, one per student |
| `ca1_question_papers` | Issued papers, frozen at first GET /paper |
| `ca1_mcq_assignments` | Per-student question + shuffled option order |
| `ca1_submissions` | One row per student per task — upsert model |
| `ca1_submission_attempts` | Append-only history of every attempt |
| `ca1_flags` | Integrity events (shared accounts, reused runs) |
| `ca1_exceptions` | Invigilator-recorded exceptions |
| `ca1_staff` | SA and invigilator accounts |
| `ca1_audit_log` | Append-only event log |

**Key constraints:**
```sql
-- Only one session running at a time
CREATE UNIQUE INDEX ca1_one_active_session ON ca1_exam_sessions (status) WHERE status = 'running';

-- Apify account can claim each task once (across different students)
CREATE UNIQUE INDEX ca1_uniq_apify_user_task ON ca1_submissions (apify_user_id, task_no)
  WHERE apify_user_id IS NOT NULL AND verification_status <> 'failed';

-- Same run ID cannot be submitted twice for the same task
CREATE UNIQUE INDEX ca1_uniq_run_task ON ca1_submissions (submitted_run_id, task_no)
  WHERE submitted_run_id IS NOT NULL;
```

**Always use effective marks:**
```typescript
// NEVER use marks_awarded directly
const marks = COALESCE(override_marks, marks_awarded)  // SQL
const marks = sub.override_marks ?? sub.marks_awarded  // TypeScript
```

---

## Assessment structure

| Section | Items | Marks | CO | Bloom's |
|---|---|---|---|---|
| A — MCQ | 10 × 0.5 | 5 | CO3, CO4 | L1–L2 |
| B — Task 1: paper retrieval | — | 2 | CO4 | L3 |
| B — Task 2: corpus word count | — | 3 | CO4 | L3 |
| B — Task 3: city temperature | — | 5 | CO4 | L3 |
| **Total** | | **15** | | |

**Task 2 breakdown:** count_total exact match (1.5) + count_scoped exact match (1.0) + valid Apify run (0.5)

**Task 3 breakdown:** city name match case-insensitive (2.0) + temperature within ±2.0°C (3.0)

**Weather provider:** Open-Meteo, `current.temperature_2m`, no API key. Server uses the same provider and coordinates from the frozen paper — not the student's submitted city string.

**CO3 at L3+** is evidenced by the take-home assignment (already conducted), not this instrument. This instrument covers CO3 at L1–L2 (MCQ only) and CO4 at L1–L3 (MCQ + all tasks).

---

## Session lifecycle

```
setup → registration_open → running → closed → archived
```

| Status | Students can do |
|---|---|
| `setup` | Nothing |
| `registration_open` | Register, log in, generate API key, do MCQ |
| `running` | Everything including fetching paper and submitting |
| `closed` | View results only |
| `archived` | View results (read-only, forever) |

**API key generation** is permitted from `registration_open` onward — before the exam starts. This moves the key-generation spike out of the 50-minute exam window.

**Auto-close:** the cron job (`/api/cron/verify`) runs every minute, closes any session where `now > ends_at`, and processes pending verifications.

**Only one session can be running at a time** — enforced by the unique index.

---

## Paper generation — fully deterministic

All paper parameters are derived from `sha256(prn + ':' + session_id)`:

```typescript
seed = sha256(prn + ':' + session_id)           // hex string

// Target word
target_word = word_pool[ parseInt(seed.slice(0,12), 16) % pool_length ]

// Scoped page (1–5)
scoped_page = 1 + parseInt(seed.slice(4,16), 16) % 5

// MCQ question per slot
question_id = question_ids[ seedInt(seed + ':mcq:' + slot_no) % count ]

// MCQ option shuffle (Fisher-Yates seeded)
option_order = shuffle(options, seed + ':slot:' + slot_no)
```

Paper issuance is **idempotent** — repeat calls to `GET /paper` return the identical paper:
```sql
INSERT INTO ca1_question_papers (...) ON CONFLICT (student_id) DO NOTHING;
SELECT * FROM ca1_question_papers WHERE student_id = $1;
```

---

## API reference

### Student endpoints — session cookie auth

```
POST /api/auth/register       { name, prn, email, phone, password }
POST /api/auth/login          { email, password, role: 'student' }
POST /api/auth/logout
POST /api/auth/change-password { new_password }
GET  /api/keys                → { has_key, key_prefix }
POST /api/keys                → { api_key, prefix, shown_once: true }  ← SHOWN ONCE
GET  /api/mcq                 → array of 10 questions (assigns on first call)
POST /api/mcq                 { slot_no, answer_key } → { recorded: true }
GET  /api/me/status           → { exam_status, mcq, paper, tasks, total_marks, exam_ends_at }
```

### Exam API — X-API-Key header

```
GET  /api/v1/paper            → rendered_paper JSON (MCQ must be complete first)
GET  /api/v1/status           → same shape as /api/me/status
POST /api/v1/submit/task2     { count_total, count_scoped, actor_id, run_id, actor_url }
POST /api/v1/submit/task3     { city, temperature_c, actor_id, run_id, actor_url }
```

All exam API endpoints return:
- `401` — missing or invalid API key
- `403 exam_not_started` — no running session
- `403 exam_ended` — past ends_at
- `403 mcq_incomplete` — for /paper only, MCQ not done yet
- `202 received` — submission accepted (verification is async)

### SA endpoints — session cookie, staff role required

```
GET  /api/sa/session                          → array of sessions
POST /api/sa/session  { action: 'create', label, exam_id }
POST /api/sa/session  { action: 'transition', session_id, new_status }
POST /api/sa/session  { action: 'set_reference_table', session_id, reference_table, corpus_hash }
POST /api/sa/session  { action: 'toggle_apify_relax', session_id }
GET  /api/sa/session/stats                    → live board numbers
GET  /api/sa/students                         → student list
GET  /api/sa/students?id=N                    → full student detail
GET  /api/sa/flags                            → all flags
POST /api/sa/flags    { flag_id, resolution } → resolve
POST /api/sa/override { action: 'override_marks', submission_id, override_marks, reason }
POST /api/sa/override { action: 'reset_password', student_id }  → { temp_password }
```

### Cron

```
GET /api/cron/verify   Authorization: Bearer $CRON_SECRET
```

---

## Corpus

- ~250,000 words across 5 static HTML pages
- Located at `public/corpus/page1.html` through `page5.html`
- `public/corpus/index.html` links to pages only (no filler words)
- All words lowercase, space-separated, no punctuation in filler
- Served as static CDN files — never through a serverless function
- Generated by: `npx ts-node --project tsconfig.node.json scripts/generate-corpus.ts`
- Generator outputs `reference-table.json` — upload this to the session via the SA dashboard

**After generating**, upload the reference table:
1. SA Dashboard → session row → click "Ref table: Not set" → opens `/sa/session`
2. Paste contents of `public/corpus/reference-table.json`
3. Paste contents of `public/corpus/manifest.json` (optional)
4. Click Upload

---

## Key design decisions — do not change without reading HANDOFF.md

1. **Grade outputs not process.** No human reads code. Mechanical grading makes 230 marks comparable.
2. **Reference answers frozen at paper issue.** `reference_table` and `sheet_snapshot` are frozen into the session row at creation. Grading reads these — never live data.
3. **Zero tolerance on word counts.** The corpus is deterministic — exact match is achievable.
4. **±2.0°C tolerance on temperature.** Two API calls at different times legitimately differ.
5. **No draft state anywhere.** Each MCQ answer committed on click. No submit button.
6. **Green tick renders on server 200 only.** Never optimistically on click.
7. **Resubmission permitted** while running; latest submission graded; max 10 per task. Returns 202 — no feedback loop to exploit.
8. **Apify account sharing:** first claim credited; second rejected 409; both parties flagged for review.
9. **Key hardcoding** is detected (grep actor source for `exk_live`) and reported in the debrief, but **never graded** — detection is inconsistent.
10. **No outbound email.** Password reset is staff-mediated — SA generates a one-time temp password shown once.
11. **Section A must be complete** before `GET /paper` succeeds (MCQ gate, enforced server-side).
12. **TASK3_SHEET_CSV_URL is read from env**, not from the SA dashboard UI. Do not add a URL input field.

---

## Coding conventions

### Always use these helpers from `lib/api.ts`
```typescript
return ok(data)                           // 200
return ok(data, 201)                      // 201
return err('machine_code', 'Human message.', 404)
return forbidden()                        // 403
return badRequest('Specific message.')    // 400
return serverError()                      // 500
return conflict('error_code', 'message') // 409
```

### Always use these for session checks
```typescript
const session = await requireStudent()   // throws 'UNAUTHORIZED' if not student
const staff = await requireStaff()       // throws 'UNAUTHORIZED' if not staff
const sa = await requireSA()             // throws 'UNAUTHORIZED' if not SA
```

### Always use `db` from `lib/db.ts`
```typescript
import { db, audit } from '@/lib/db'
// db is a lazy proxy — safe to import at module level, initialises on first use
```

### Always audit meaningful actions
```typescript
await audit('student:' + prn, 'paper_fetched', 'student:' + studentId, { word, page })
await audit('staff:' + email, 'marks_overridden', 'submission:' + id, { marks, reason })
```

### Never import server modules in client components
Files with `'use client'` must only use `fetch()` to talk to routes. Never import from `lib/db`, `lib/session`, or `lib/grading` in client components.

### TypeScript conventions
- Strict mode is on — no implicit `any`
- Use `unknown` with type narrowing instead of `any`
- All route files use `NextRequest` from `next/server`
- All types are in `lib/types.ts`

---

## SA credentials (seeded)

```
Email:    dinesh.k.wadhwani@gmail.com
Password: Din@16285
```

⚠ The hash in `002_ca1_seed.sql` is a placeholder. Run `node scripts/generate-sa-hash.js` and paste the UPDATE statement before first use.

---

## Deployment checklist

**One-time setup:**
- [ ] Supabase: run `001_ca1_schema.sql` → `002_ca1_seed.sql` → two RPC functions → SA hash UPDATE
- [ ] Run corpus generator → commit `public/corpus/` to git
- [ ] Run spreadsheet generator → upload to Google Sheets → share publicly → get CSV export URL
- [ ] Add all 6 env vars to Vercel
- [ ] Deploy to Vercel — picks up `vercel.json` cron config automatically
- [ ] SA login works at `/sa/login`

**Per-exam-session setup:**
- [ ] SA Dashboard → "+ New Session" → type label → click Create (sheet snapshot auto-loads from env)
- [ ] Check session shows correct student row count after creation
- [ ] Upload reference table at `/sa/session`
- [ ] Check "Ref table: Set ✓" on dashboard
- [ ] Open registration
- [ ] Brief students: register before exam, Apify account ready, VS Code open
- [ ] Start exam
- [ ] After exam: wait for verifications to clear → Close → Archive

---

## What still needs to be built

### 1. Report generation (`/api/sa/reports/`)

`pdf-lib` and `xlsx` are already installed.

**`GET /api/sa/reports/marks-sheet?session_id=N`** → returns XLSX download
- One row per student: PRN, Name, MCQ marks, T1, T2, T3, Total, %
- All task marks use `COALESCE(override_marks, marks_awarded)`
- Summary: count, mean, median, std dev, max, min

**`GET /api/sa/reports/student-pdf?student_id=N`** → returns PDF download
- Header: institution, course, exam, date, PRN, name
- Section A: each of 10 MCQ slots with question as served, student answer, correct answer, mark
- Section B: per task — params, submitted values, expected values, component marks
- Appendix: Apify run IDs, T3 server temperature reading

**`GET /api/sa/reports/co-attainment?session_id=N`** → returns JSON
- Per CO: marks available, class average marks, attainment %, students above threshold
- Note: threshold not yet provided by course owner — add a `co_attainment_threshold` config field

**`GET /api/sa/reports/item-analysis?session_id=N`** → returns JSON
- Per MCQ slot: difficulty index (% answered correctly), discrimination (top third minus bottom third)
- Per option: distribution of student selections

Add a reports UI page at `/sa/reports/page.tsx` with download buttons.

### 2. Exception recording UI

Add `POST /api/sa/exceptions` route and a form on the student detail page (`/sa/students/[id]/page.tsx`) for invigilators to record:
- `kind`: `shared_lab_account | machine_failure | network_failure | extension`
- `detail`: free text
- Stored in `ca1_exceptions` table, exempt from integrity flag rules

### 3. MCQ debrief for students

After exam closes, students should see correct answers and rationale.
- Add `GET /api/me/mcq-results` — returns full MCQ detail (correct_key, rationale) only when session is `closed` or `archived`
- Add a debrief accordion to `/results/page.tsx`

### 4. Bloom's / CO attainment reports UI

Show the CO attainment table and Bloom's distribution in the SA dashboard after the exam closes. The data comes from the item analysis and marks sheet endpoints above.

---

## Common mistakes to avoid

**Don't add a Google Sheet URL field to the SA dashboard.** It comes from `TASK3_SHEET_CSV_URL` in env. The session creation route reads it automatically.

**Don't use `marks_awarded` directly in reports.** Always `COALESCE(override_marks, marks_awarded)`.

**Don't use the direct Supabase connection string (port 5432).** Use the pooled connection (port 6543). Transaction-mode pooling — no prepared statements.

**Don't store full API keys or passwords anywhere.** API keys stored as SHA-256 hash. Passwords as bcrypt. Full key shown once only at generation.

**Don't add a Submit button for MCQs.** Each click commits immediately to the server. The green tick confirms it. No submit, no draft state.

**Don't add `/api/v1/status` calls from the student dashboard.** That endpoint requires the API key, which the dashboard never has after generation. Use `/api/me/status` (session cookie auth) for dashboard polling.

**Don't create a second session while one is running.** The unique index will reject the Start transition. The SA must Close the running session first.

**Don't return marks to the student during the exam.** `/api/me/status` and `/api/v1/status` return `marks: null` while the session is `running`. Marks are only shown when `closed` or `archived`. There must be no feedback loop students can exploit for resubmission.

