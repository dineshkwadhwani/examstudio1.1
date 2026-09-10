# CA1 Practical Examination Platform — Complete Handoff Document

**Project:** Exam Studio — CA1 Practical Examination Platform  
**Course:** F0003 Autonomous AI Systems and Agent-Based Computing  
**Institution:** Symbiosis Institute of Technology, Pune  
**Domain:** examstudioca2.thecoachdinesh.com  
**Owner:** Dinesh Wadhwani (dinesh.k.wadhwani@gmail.com)  
**Document version:** September 2026 — captures full state at time of writing

---

## 1. Purpose

A reusable web-based platform for conducting **API-integration practical examinations**. Students answer a conceptual MCQ section, receive individually parameterised practical tasks, write and deploy code, and submit answers via a REST API. The platform verifies answers mechanically and produces per-student records and institutional attainment reports.

---

## 2. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript) | `app/` directory, server components for data, client components for interactivity |
| Database | Supabase Postgres | Pooled connection (port 6543 / pgBouncer transaction mode) |
| Hosting | Vercel | Cron job for auto-close + verification |
| Auth | JWT cookie via `jose` | Cookie name: `ca1_session`, 24h expiry, httpOnly, sameSite=lax |
| Passwords | bcryptjs (cost 12) | Never stored in plaintext anywhere |
| API keys | SHA-256 hash stored | Raw key shown once at generation, never stored |
| Styling | Tailwind CSS v4 | Dark theme for SA dashboard, light for students |

---

## 3. Environment Variables

```env
SUPABASE_URL                        # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY           # Server-side only — bypasses RLS
SESSION_SECRET                      # Min 32 chars — JWT signing key
APIFY_API_TOKEN                     # Dinesh's personal Apify token — for run verification
NEXT_PUBLIC_APP_URL                 # https://examstudioca2.thecoachdinesh.com
TASK3_SHEET_CSV_URL                 # Google Sheets CSV export URL for Task 3 city data
CRON_SECRET                         # Optional — authorises /api/cron/verify calls
```

**Important:** `TASK3_SHEET_CSV_URL` is read server-side at session creation time. The SA dashboard does not ask for this URL — it is pulled from the environment automatically. Format: `https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0`

**Critical:** `SUPABASE_SERVICE_ROLE_KEY` must never reach browser. All DB access is server-side via service role.

---

## 4. Assessment Design (Frozen)

### 4.1 Structure

| Section | Items | Marks | CO | Bloom's |
|---|---|---|---|---|
| A — MCQ | 10 × 0.5 | 5 | CO3, CO4 | L1–L2 |
| B — Task 1: API key + paper retrieval | — | 2 | CO4 | L3 |
| B — Task 2: Corpus word count via Apify | — | 3 | CO4 | L3 |
| B — Task 3: City temperature via Apify | — | 5 | CO4 | L3 |
| **Total** | | **15** | | |

### 4.2 Task 2 component breakdown

| Component | Marks | Rule |
|---|---|---|
| `count_total` exactly correct | 1.5 | Exact match, zero tolerance |
| `count_scoped` exactly correct | 1.0 | Exact match, zero tolerance |
| Valid Apify run within window | 0.5 | Gate |

### 4.3 Task 3 component breakdown

| Component | Marks | Rule |
|---|---|---|
| City matches spreadsheet PRN row | 2.0 | Case-insensitive, trimmed string match |
| Temperature within ±2.0 °C of server reading | 3.0 | Tolerance ±2.0 °C |

Temperature provider: **Open-Meteo**, field `current.temperature_2m`, no API key required. **Same provider used server-side and student-side.**

### 4.4 Bloom's distribution — report honestly

This instrument spans L1–L3. **67% at L3 Apply, 33% at L1–L2.** Never report as "L3 only."

### 4.5 CO coverage

- **CO3:** Evidenced at L1–L2 via MCQ only (slots 1–6). No L3 CO3 in this instrument.
- **CO4:** Evidenced at L1–L3 via MCQ (slots 7–10) and all three tasks.
- **CO3 at L3+** is evidenced by the take-home assignment (already conducted). Record both instruments in the course assessment plan.

---

## 5. Session Architecture (Key Design Decision)

**One cohort, one exam definition, two sessions.** The SA creates two separate exam sessions (one for each batch). Only one session can be `running` at any time — enforced by a unique index:

```sql
CREATE UNIQUE INDEX ca1_one_active_session
  ON ca1_exam_sessions (status)
  WHERE status = 'running';
```

**Workflow for two batches:**
1. SA creates Session 1 → opens registration → starts → closes → creates Session 2 → opens registration → starts → closes.
2. Students register against whichever session is `registration_open` or `running`.
3. The two batches run sequentially with no interaction time — one corpus, shared.

**One corpus** (`/public/corpus/`) serves both batches. Per-student target words already ensure batch 1 answers don't help batch 2.

---

## 6. Session State Machine

```
setup → registration_open → running → closed → archived
```

| Status | Students can | Cannot |
|---|---|---|
| `setup` | nothing | — |
| `registration_open` | register, login, generate API key | answer MCQ, fetch paper, submit |
| `running` | everything | — |
| `closed` | view results | submit |
| `archived` | view results (read-only) | — |

**API key generation is permitted from `registration_open` onward** — moves the key-generation spike out of the 50-minute window.

**Auto-close:** `GET /api/cron/verify` (called every minute by Vercel Cron) closes any session where `now > ends_at`.

---

## 7. Database Schema (All tables prefixed `ca1_`)

### Tables created by `001_ca1_schema.sql`:

```
ca1_exam_definitions      — exam config (duration, marks, email domain)
ca1_exam_tasks            — task definitions per exam
ca1_task_components       — grading rubric per task
ca1_mcq_slots             — 10 concept slots per exam
ca1_mcq_questions         — 4 variants per slot = 40 questions
ca1_exam_sessions         — one per batch, includes frozen snapshot fields
ca1_roster                — PRN + name only, validated at registration
ca1_students              — registered students (PRN is FK to roster)
ca1_api_keys              — hashed key + prefix, one per student
ca1_question_papers       — issued papers, frozen at first fetch
ca1_mcq_assignments       — per-student question+option assignments
ca1_submissions           — one row per student per task (upsert model)
ca1_submission_attempts   — append-only attempt history
ca1_flags                 — integrity events
ca1_exceptions            — invigilator-recorded exceptions
ca1_staff                 — SA and invigilator accounts
ca1_audit_log             — append-only event log
```

### Key constraint: effective marks

```sql
COALESCE(override_marks, marks_awarded)
```
Every report uses this expression. Never use `marks_awarded` directly.

### Key indexes

```sql
-- Prevents two sessions running simultaneously
CREATE UNIQUE INDEX ca1_one_active_session ON ca1_exam_sessions (status) WHERE status = 'running';

-- Prevents same Apify account claiming same task twice (across students)
CREATE UNIQUE INDEX ca1_uniq_apify_user_task ON ca1_submissions (apify_user_id, task_no)
  WHERE apify_user_id IS NOT NULL AND verification_status <> 'failed';

-- Prevents same run ID submitted twice for same task
CREATE UNIQUE INDEX ca1_uniq_run_task ON ca1_submissions (submitted_run_id, task_no)
  WHERE submitted_run_id IS NOT NULL;

-- Fast API key lookup
CREATE INDEX ca1_api_keys_hash_idx ON ca1_api_keys (key_hash);
```

### RLS

All tables have `ENABLE ROW LEVEL SECURITY` with deny-all policies for anon/authenticated roles. All access is via service role key in server-side routes. The service role key must never reach client-side code.

### Missing from schema (must add manually)

Two Postgres RPC functions needed by `app/api/mcq/route.ts`:

```sql
CREATE OR REPLACE FUNCTION increment_times_served(qid BIGINT) RETURNS void AS $$
  UPDATE ca1_mcq_questions SET times_served = times_served + 1 WHERE id = qid;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_times_correct(qid BIGINT) RETURNS void AS $$
  UPDATE ca1_mcq_questions SET times_correct = times_correct + 1 WHERE id = qid;
$$ LANGUAGE sql;
```

---

## 8. Seed Data (`002_ca1_seed.sql`)

### Super Admin

- **Email:** dinesh.k.wadhwani@gmail.com
- **Password:** Din@16285
- **Role:** sa
- **Hash in seed file:** PLACEHOLDER — must be replaced before use.

**To generate the real hash:**
```bash
node scripts/generate-sa-hash.js
# Then run the UPDATE statement it outputs in Supabase SQL editor
```

### Exam definition

- Code: `F0003-CA1-2026`
- Duration: 50 minutes
- MCQ: 10 questions × 0.5 marks
- Email domain: `sitpune.edu.in`

### MCQ bank

40 questions across 10 slots (4 variants per slot). All questions written and seeded. Slots:

| Slot | CO | Concept | Bloom's |
|---|---|---|---|
| 1 | CO3 | Word vs contextual embeddings | L2 |
| 2 | CO3 | Chunking and chunk size effects | L2 |
| 3 | CO3 | Vector database indexing | L1 |
| 4 | CO3 | Cosine vs Euclidean similarity | L1 |
| 5 | CO3 | Retrieval vs context stuffing | L2 |
| 6 | CO3 | RAG pipeline component ordering | L2 |
| 7 | CO4 | Workflow vs agent (schedule ≠ autonomy) | L2 |
| 8 | CO4 | Tools and function calling | L1 |
| 9 | CO4 | Human-in-the-loop vs fully autonomous | L2 |
| 10 | CO4 | Short-term vs long-term memory | L1 |

### Student roster

231 entries: 230 students (deduped from provided list) + Dinesh Wadhwani (PRN: `1234`).

Excluded from roster (no PRN or not a student):
- Nilima Zade — faculty, no PRN
- Hotchand Wadhwani — PRN `123123`, personal gmail (not a sitpune student)

Duplicates resolved (kept one entry each):
- Arun Tati (PRN 23070122048)
- Devaki Joshi (PRN 23070122083)
- Devashree Kale (PRN 23070122084)
- Kushagra (PRN 23070122122)

---

## 9. API Reference

### Authentication

| Endpoint | Auth | Notes |
|---|---|---|
| `POST /api/auth/register` | None | Validates PRN vs roster; requires open session |
| `POST /api/auth/login` | None | `role: 'student'` or `'staff'` in body |
| `POST /api/auth/logout` | Session cookie | Clears cookie |
| `POST /api/auth/change-password` | Session cookie | Required when `must_change_password: true` |

### Student — session cookie auth

| Endpoint | Method | Notes |
|---|---|---|
| `/api/keys` | GET | Check if key exists (prefix only, never full key) |
| `/api/keys` | POST | Generate API key — shown once in response |
| `/api/mcq` | GET | Get assigned questions (assigns on first call) |
| `/api/mcq` | POST | `{slot_no, answer_key}` — saves answer, returns `{recorded: true}` |

### Exam API — `X-API-Key` header

| Endpoint | Method | Notes |
|---|---|---|
| `/api/v1/paper` | GET | Returns question paper; idempotent; rate-limited 30/min |
| `/api/v1/submit/task2` | POST | Word count submission; returns 202; max 10 attempts |
| `/api/v1/submit/task3` | POST | Temperature submission; returns 202; max 10 attempts |
| `/api/v1/status` | GET | Task status (uses API key) |

### SA — session cookie auth (staff role required)

| Endpoint | Method | Notes |
|---|---|---|
| `/api/sa/session` | GET | List all sessions |
| `/api/sa/session` | POST | `action:` `create` / `transition` / `set_reference_table` / `toggle_apify_relax` |
| `/api/sa/session/stats` | GET | Live board numbers |
| `/api/sa/students` | GET | List (with `?search=`) or detail (`?id=`) |
| `/api/sa/flags` | GET | All flags |
| `/api/sa/flags` | POST | Resolve a flag |
| `/api/sa/override` | POST | `action:` `override_marks` or `reset_password` |

### Cron

| Endpoint | Auth | Notes |
|---|---|---|
| `/api/cron/verify` | `Authorization: Bearer $CRON_SECRET` | Auto-closes expired sessions; runs pending verifications |

---

## 10. Paper Generation

### Seed

```
seed = sha256(prn + ':' + session_id)  →  hex string
seed_int = BigInt('0x' + seed)
```

### Target word

```
word = word_pool[ seed_int % len(word_pool) ]
```

### Scoped page

```
page = 1 + ((seed_int >> 16) % 5)
```

### MCQ question selection

For each slot:
```
question_id = question_ids_for_slot[ sha256(seed + ':mcq:' + slot_no)_as_int % count ]
```

### MCQ option order shuffle

```
option_order = Fisher-Yates shuffle using sha256(seed + ':slot:' + slot_no)_as_int
```

### Idempotency

```sql
INSERT INTO ca1_question_papers (...) VALUES (...)
  ON CONFLICT (student_id) DO NOTHING;
SELECT * FROM ca1_question_papers WHERE student_id = $1;
```

If two simultaneous first-calls race, the constraint fires on the second. Both reads return the same row.

---

## 11. Corpus

### Location

`/public/corpus/` → served as static files by Next.js/Vercel from CDN edge.

### Structure

```
/public/corpus/index.html        links to pages only, no content
/public/corpus/page1.html        ~50,000 words
/public/corpus/page2.html
/public/corpus/page3.html
/public/corpus/page4.html
/public/corpus/page5.html
/public/corpus/reference-table.json   (gitignored, used by SA to configure session)
/public/corpus/manifest.json          (gitignored)
```

**Total: ~250,000 words across 5 pages.**

### Generator

```bash
npx ts-node --project tsconfig.node.json scripts/generate-corpus.ts
```

Outputs:
- The 6 HTML files (index + 5 pages)
- `reference-table.json` — word → `{total, pages: {1:.., 2:.., 3:.., 4:.., 5:..}}`
- `manifest.json` — array of `{filename, url, hash, page_no}`

### Word pool

The generator uses a 150+ word AI/ML vocabulary pool (see `scripts/generate-corpus.ts`). All words are lowercase, no punctuation in filler, words space-separated.

### Reference table upload

After generating, the SA must upload the reference table to the session via:
```
POST /api/sa/session
{action: 'set_reference_table', session_id: N, reference_table: {...}, corpus_hash: '...', corpus_manifest: [...]}
```

This is done via the SA Dashboard → session row → "Set Reference Table" (currently described; UI needs a form to paste JSON).

### Corpus constraints (mandatory)

1. No punctuation in filler — space-separated bare words only
2. No pool word appears in markup (class names, IDs, comments, etc.)
3. No inline formatting (`<b>`, `<em>`) inside text
4. Static HTML only — no JS, no CSS frameworks
5. No pool word is a substring of another pool word

---

## 12. Task 3 Spreadsheet

### Generator

```bash
npx ts-node --project tsconfig.node.json scripts/generate-spreadsheet.ts
```

Outputs `scripts/task3-spreadsheet.csv` with columns: `PRN, Name, City, Latitude, Longitude`

### City assignment

- Seeded by `sha256('city:' + prn)`
- Pune is excluded from the pool (students can look outside)
- Dinesh Wadhwani (PRN `1234`) → Indore (hardcoded)
- 50 Indian cities in the pool with accurate lat/lon

### Critical: publish as CSV export URL

```
https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0
```
NOT the share link (returns HTML). Students fetch this CSV directly in their actor.

### PRN handling

PRNs are quoted in CSV (`"23070122004"`) to prevent numeric coercion. Verify the published export preserves them as strings. If not, prefix with a letter or use a text-format column.

---

## 13. Verification and Grading

### Task 1

Self-grading. First successful `GET /api/v1/paper` triggers `awardTask1()` which inserts a `ca1_submissions` row with `verification_status: 'verified'` and `marks_awarded: 2`. Not re-entrant — does nothing if row exists.

### Task 2 verification

Async (fires after `202` response):
1. `verifyRun()` — checks Apify: run exists, `actId` matches, `status === 'SUCCEEDED'`, `finishedAt` within session window
2. `getDatasetItems()` — checks dataset contains submitted `count_total`/`count_scoped`
3. Compare against `t2_expected_total` and `t2_expected_scoped` from `ca1_question_papers`
4. `getActorSource()` — fetches source, sets `key_hardcoded` (never graded — feedback only)
5. Updates `ca1_submissions` with marks and detail

### Task 3 verification

Async (fires after `202` response):
1. `verifyRun()` — same as Task 2
2. `getCurrentTemperature(t3_lat, t3_lon)` — calls Open-Meteo at the coordinates from the student's paper (not their claimed city)
3. City: case-insensitive trimmed string match vs `t3_city`
4. Temperature: `abs(submitted - server_reading) <= 2.0`
5. If Open-Meteo unreachable → `deferred`, re-run by cron
6. `server_reference` JSON stores `{temperature_c, read_at, raw}` — critical for appeals

### Deferred verifications

Cron (`/api/cron/verify`) processes `pending` and `deferred` rows every minute. Each run processes up to 20 rows.

### Collision rules

| Condition | Action |
|---|---|
| Same `run_id`, same task, different student | Reject second with `409 run_already_submitted` |
| Same `apify_user_id`, same task, different student | Reject second with `409 apify_account_already_used`, flag both at `review` severity |
| Same student resubmitting | Permitted; upsert overwrites; `first_submitted_at` preserved; `attempt_count` incremented |
| Student changes Apify account mid-exam | Permitted; logs `info` flag; previous account released |
| Same `actor_id`, different students | Accept both; `info` flag (public template is innocent) |

### Break-glass: `relax_apify_verification`

If Apify degrades mid-exam, SA toggles this on the session. When `true`, `verifyRun()` immediately returns `ok: true` without calling Apify. Carries 8/15 marks — this is the only remedy short of voiding the exam.

---

## 14. MCQ Behaviour

### Section gating

`GET /api/v1/paper` returns `403 {error: 'mcq_incomplete'}` until all 10 MCQs have `answered_key IS NOT NULL`.

### Per-click saving

Each `POST /api/mcq` commits the answer immediately. No submit button. No draft state. A green tick renders only on server `200` — never optimistically.

### Changeability

Answers may be changed freely while `running`. `answer_history` retains all selections with timestamps. Final marks computed from `answered_key` at `ends_at`.

### No correct-answer reveal during exam

`POST /api/mcq` response includes `is_correct: null` during the exam. Correct answers only visible in SA student detail view.

---

## 15. Authentication Details

### Student registration validation

- Email: `^[A-Za-z0-9._%+-]+@sitpune\.edu\.in$` (configurable via `email_domain` field)
- PRN: must exist in `ca1_roster` and be unclaimed
- Phone: `^[6-9]\d{9}$` — contact only, never an auth factor
- Password: min 8 chars, no complexity rules

### Password reset (staff-mediated)

`POST /api/sa/override` with `{action: 'reset_password', student_id: N}` returns:
```json
{
  "temp_password": "Tmp@XXXXXXXX",
  "warning": "Shown once only. Relay in person."
}
```
Sets `must_change_password: true`. Student must change on next login. Nothing stored in plaintext.

### API key format

`exk_live_` + 48 hex chars. Stored as `sha256(raw_key)`. Prefix (`exk_live_xxxx`) shown on dashboard. Full key shown once at generation.

---

## 16. File Structure

```
examstudio/
├── .env.example
├── vercel.json                    # Cron: /api/cron/verify every 1 min; corpus cache headers
├── next.config.ts
├── package.json
├── tsconfig.json
├── tsconfig.node.json             # For ts-node scripts
│
├── app/
│   ├── layout.tsx                 # Root layout, Inter font
│   ├── page.tsx                   # Redirects / → /login
│   ├── globals.css
│   │
│   ├── login/page.tsx             # Student login (role=student)
│   ├── register/page.tsx          # Student registration
│   ├── change-password/page.tsx   # Forced change on must_change_password
│   ├── dashboard/page.tsx         # Student main screen — key gen, task status
│   ├── mcq/page.tsx               # 10 MCQ questions with per-click save
│   │
│   ├── sa/
│   │   ├── login/page.tsx         # Staff login (role=staff)
│   │   ├── dashboard/page.tsx     # SA live board + session controls
│   │   ├── students/page.tsx      # Sortable/searchable student list
│   │   ├── students/[id]/page.tsx # Full student detail view
│   │   └── flags/page.tsx         # Flag review queue
│   │
│   └── api/
│       ├── auth/{register,login,logout,change-password}/route.ts
│       ├── keys/route.ts
│       ├── mcq/route.ts
│       ├── v1/
│       │   ├── paper/route.ts
│       │   ├── status/route.ts
│       │   └── submit/{task2,task3}/route.ts
│       ├── sa/
│       │   ├── session/route.ts
│       │   ├── session/stats/route.ts
│       │   ├── students/route.ts
│       │   ├── flags/route.ts
│       │   └── override/route.ts
│       └── cron/verify/route.ts
│
├── components/
│   └── ui/
│       ├── Alert.tsx              # {type: error|success|info|warning, message}
│       ├── Countdown.tsx          # Live countdown, turns red at <5 min
│       └── SaveTick.tsx           # Green tick (saved) or red X (save failed)
│
├── lib/
│   ├── types.ts                   # All TypeScript interfaces
│   ├── db.ts                      # Supabase service role client + audit()
│   ├── session.ts                 # JWT cookie auth; requireStudent/requireStaff/requireSA
│   ├── api.ts                     # Response helpers; resolveApiKey; sha256; generateApiKey
│   ├── paper.ts                   # makeSeed; pickWord; pickPage; buildRenderedPaper; shuffleOptions; pickQuestion
│   ├── apify.ts                   # getRun; getDatasetItems; getActorSource; verifyRun
│   ├── weather.ts                 # getCurrentTemperature (Open-Meteo)
│   └── grading.ts                 # awardTask1; gradeTask2; gradeTask3; runPendingVerifications
│
├── scripts/
│   ├── generate-corpus.ts         # Outputs public/corpus/ + reference-table.json + manifest.json
│   ├── generate-spreadsheet.ts    # Outputs scripts/task3-spreadsheet.csv
│   └── generate-sa-hash.js        # Outputs bcrypt hash for seed SQL UPDATE
│
└── supabase/
    └── migrations/
        ├── 001_ca1_schema.sql     # All tables, RLS, indexes
        └── 002_ca1_seed.sql       # SA, exam definition, tasks, MCQ bank (40 Qs), roster (231 entries)
```

---

## 17. What Is Complete vs What Is Pending

### ✅ Complete and functional

- All database migrations and seed data
- All backend API routes (auth, MCQ, paper, task2, task3, SA, cron)
- All library modules (db, session, api, paper, apify, weather, grading, types)
- Student-facing pages: login, register, change-password, dashboard, MCQ
- SA pages: login, dashboard (live board + session controls), students list, flags
- Shared UI components: Alert, Countdown, SaveTick
- Corpus generator script
- Task 3 spreadsheet generator script
- SA hash generator script
- vercel.json (cron + corpus cache headers)
- `.env.example`

### ⚠ Known gaps and pending work

#### Dashboard status polling bug

`app/dashboard/page.tsx` has a structural issue: `GET /api/v1/status` requires an `X-API-Key` header, but the dashboard doesn't know the raw key (only the prefix is stored after generation). The status polling loop is incomplete — it calls `/api/keys` to check key existence but then can't call `/api/v1/status`.

**Fix options:**
- Add a separate `/api/me/status` endpoint that uses the session cookie instead of the API key, mirroring what `/api/v1/status` returns.
- Or, store status in client-side state and update it after each MCQ answer and key generation.

Recommended: add `GET /api/me/status` (session cookie auth) that returns the same shape as `/api/v1/status`. The student dashboard should call that.

#### SA student detail page

`app/sa/students/[id]/page.tsx` exists as a file but its content was not confirmed complete in this session. The API (`GET /api/sa/students?id=N`) returns the full data payload. The page needs to render:
- Identity block
- Section A: each question as served, options in display order, student answer, correct answer, mark, change history
- Paper as issued (verbatim `rendered_paper`)
- Per-task: submitted payload, attempt history, expected vs submitted values, component marks, Apify detail, server reference (T3), source snapshot, key_hardcoded indicator
- Override control (marks + reason)
- Flags and exceptions
- Timeline (audit log)

#### SA results page

No `/app/results` page for students. Currently, marks only appear on the dashboard after the session closes. A clean `/results` page showing the full breakdown (Section A question-by-question, Section B component-by-component) would be better UX.

#### Reference table upload UI

The SA dashboard shows a "Ref table: Not set ⚠" indicator per session, but there is no UI form to paste and submit the reference table JSON. Currently it must be done via a direct `POST /api/sa/session` call with `action: 'set_reference_table'`. A simple textarea form on the dashboard would complete this.

#### PDF report generator

Not built. The spec calls for:
- Per-student answer script (PDF) — the institutional submission artefact
- Consolidated marks sheet (XLSX)
- CO attainment report
- Bloom's distribution report
- Item analysis report
- Session integrity report

These would be built under `/api/sa/reports/` with PDF output via `pdf-lib` (already in `package.json`) and XLSX via `xlsx` (also installed).

#### Tailwind CSS class definitions

`app/globals.css` needs utility class definitions for the custom classes used throughout (`card`, `btn-primary`, `btn-secondary`, `btn-danger`, `badge-green`, `badge-yellow`, `badge-red`, `badge-blue`, `badge-gray`, `input`, `label`). Without these, the UI will not render correctly. These are Tailwind `@layer components` definitions.

#### `tsconfig.node.json`

Scripts use `ts-node`. A `tsconfig.node.json` is referenced but was not created in this session. Needs:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist"
  },
  "include": ["scripts/**/*"]
}
```

#### `app/results/page.tsx`

The file was listed in the directory but content was not confirmed. Student results view after exam close.

---

## 18. Deployment Steps (Complete)

### Step 1: Supabase setup

1. Create a new Supabase project
2. In SQL editor: run `001_ca1_schema.sql` first, then `002_ca1_seed.sql`
3. Run `node scripts/generate-sa-hash.js` locally → paste the `UPDATE` statement into SQL editor
4. Copy **pooled connection string** (port 6543, transaction mode) for `DATABASE_URL`
5. Copy **service role key** and project URL

### Step 2: Generate corpus

```bash
npx ts-node --project tsconfig.node.json scripts/generate-corpus.ts
```
This creates `/public/corpus/` files. They are served as static assets automatically.

### Step 3: Generate spreadsheet

```bash
npx ts-node --project tsconfig.node.json scripts/generate-spreadsheet.ts
```
Upload `scripts/task3-spreadsheet.csv` to Google Sheets. Publish as CSV export URL.

### Step 4: Deploy to Vercel

1. Push to GitHub
2. Import repo in Vercel dashboard
3. Set all env vars from `.env.example`
4. Deploy — Vercel picks up `vercel.json` for cron config automatically

### Step 5: SA first login

1. Go to `https://examstudioca2.thecoachdinesh.com/sa/login`
2. Email: `dinesh.k.wadhwani@gmail.com` / Password: `Din@16285`

### Step 6: Create exam session

1. SA Dashboard → "+ New Session"
2. Label: e.g. "Batch 1 — Div A"
3. The sheet URL is read from `TASK3_SHEET_CSV_URL` env var automatically
4. Click Create → system fetches and freezes the sheet snapshot
5. Upload reference table: paste contents of `public/corpus/reference-table.json` into the session (currently via direct API call — UI form pending)
6. Transition: Setup → Registration Open → Running

### Step 7: After the exam

1. Wait for cron to process all pending verifications
2. Set session to Closed → Archive
3. Generate reports (when built)
4. Create Session 2 for Batch 2, repeat

---

## 19. Pre-Exam Checklist

- [ ] Run `001_ca1_schema.sql` and `002_ca1_seed.sql` in Supabase
- [ ] Run `generate-sa-hash.js` and update the SA password hash
- [ ] Run corpus generator; verify 5 pages exist in `/public/corpus/`
- [ ] Run spreadsheet generator; upload to Google Sheets; get CSV export URL
- [ ] Deploy to Vercel; confirm cron fires (check function logs)
- [ ] SA login works; create and configure session; upload reference table
- [ ] Confirm reference table shows "Set ✓" in session list
- [ ] Test student registration with a dummy PRN from the roster
- [ ] Test full student flow: register → login → MCQ → key → paper fetch → mock task2 submit → mock task3 submit
- [ ] Verify SA live board updates
- [ ] Test password reset flow (SA overrides, student sees must_change_password)
- [ ] Confirm Apify env variable names on current platform (they've been renamed before)
- [ ] Confirm Open-Meteo returns data for a sample city
- [ ] Brief students: Apify account must exist with one successful build before exam
- [ ] Brief students: VS Code + AI assistant ready before exam
- [ ] Assigned seating; invigilators know how to reset passwords and record exceptions

---

## 20. Design Principles (Do Not Reverse Without Understanding)

1. **Grade outputs, not process.** No human reads code. Mechanical grading makes 230 results comparable.
2. **Reference answers computed at paper issue, never recomputed.** `reference_table` and `sheet_snapshot` are frozen into the session row. Disputes and regrades use the frozen values.
3. **Zero tolerance on counts; tolerance only where the world genuinely moves.** Exact match on word counts (corpus is fixed and deterministic); ±2 °C on temperature (two API calls at different times legitimately differ).
4. **External API latency never sits in the student's critical path.** Submit returns `202` immediately; verification is async.
5. **Flag, don't auto-punish, where the system cannot identify the guilty party.** On Apify account sharing, first claim wins mechanically and both are flagged for review.
6. **No draft state anywhere.** Each MCQ answer committed on click. No submit button. A student cannot lose work.
7. **Ticks render on server 200 only.** Never optimistically. A tick that lies about a failed write is worse than no tick.
8. **Resubmission is permitted; no feedback loop to exploit.** 202 pending, marks hidden until close. There is nothing to brute-force.
9. **Key hardcoding detected but never graded.** Detection is inconsistent; marks must not attach to unevenly measured properties.
10. **No outbound email.** Password reset is staff-mediated. In-person invigilator reset is explicitly permitted during `running`.

---

## 21. Known Limitations (Accepted)

1. Section B rewards plumbing speed over conceptual depth — balanced by the take-home assignment.
2. Ctrl+F can shortcut word counting. Mitigated by scale (250K words), scoped count, and the 2.5/15 mark weight.
3. Hardcoded answer constants inside an actor pass all checks. Source snapshot + source IP are forensic evidence if suspicion arises.
4. Deploying code into a friend's own Apify account defeats all collision checks. Invigilation is the control.
5. Apify is a single point of failure for 8/15 marks. Break-glass switch exists.
6. Password reset is not instant (staff-mediated). In-person invigilator path during exam mitigates this.
7. MCQs cannot evidence CO3 above L2. Take-home assignment carries L3+.

---

## 22. Frozen Decisions (26 total)

| # | Decision |
|---|---|
| 1 | Total marks: 15 (Section A: 5, Section B: 10) |
| 2 | Duration: 50 minutes, single batch-wide clock, SA-started |
| 3 | MCQ: 10 × 0.5 marks, no negative marking |
| 4 | MCQ selection: slot-based, 10 slots × 4 variants, seeded by PRN |
| 5 | Section gating: MCQ must be complete before `GET /paper` |
| 6 | Bloom's: L1–L3 spread; 67% L3. Never "L3 only" |
| 7 | CO3 at L3+: take-home assignment (already done), not this instrument |
| 8 | Weather provider: Open-Meteo, `current.temperature_2m`, no key. Same server-side |
| 9 | Temperature tolerance: ±2.0 °C |
| 10 | Count tolerance: zero — exact match |
| 11 | Corpus: ~250K words, 5 pages, one corpus for both batches |
| 12 | Task 2 and Task 3 require Apify actor with run verification |
| 13 | Paper fetch: idempotent; repeat calls return identical paper |
| 14 | Late paper fetch: permitted while `running`; same `ends_at` |
| 15 | Late submission: hard reject after `ends_at` |
| 16 | Email domain: `@sitpune.edu.in`, configurable |
| 17 | Password policy: min 8 chars, no complexity rules |
| 18 | Account recovery: no outbound email; SA/invigilator generates one-time temp password shown once |
| 19 | Phone: mandatory at registration; contact/ID only, never auth |
| 20 | Key hardcoding: detected, reported as feedback, **never graded** |
| 21 | Account sharing: first claim credited; second rejected; all parties flagged |
| 22 | Table prefix: `ca1_` |
| 23 | Answer persistence: per-click commit; no draft; green tick on server 200 only |
| 24 | MCQ changeability: free while `running`; change history retained |
| 25 | Task resubmission: permitted while `running`; latest graded; max 10 attempts; `first_submitted_at` preserved |
| 26 | Two batches: two sessions, same exam definition, same corpus; only one `running` at a time |

---

## 23. Unresolved / Still Required From Course Owner

- **CO attainment threshold and banding convention** (e.g. ≥60% = attainment level 1, etc.) — needed for the CO attainment report
- **Results page design** — what should students see when the exam closes?
- **Report formats** — which reports does the institution need for NAAC/NBA? (PDF per student, XLSX cohort sheet, CO attainment table are assumed)

---

*End of handoff document. This file lives at `/home/claude/examstudio/HANDOFF.md` and in the project output.*
