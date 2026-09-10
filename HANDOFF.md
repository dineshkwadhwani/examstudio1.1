# CA1 Practical Examination Platform — Complete Handoff Document

**Project:** Exam Studio — CA1 Practical Examination Platform  
**Course:** F0003 Autonomous AI Systems and Agent-Based Computing  
**Institution:** Symbiosis Institute of Technology, Pune  
**Domain:** examstudioca2.thecoachdinesh.com  
**Owner:** Dinesh Wadhwani (dinesh.k.wadhwani@gmail.com)  
**Document version:** September 2026 — v5, captures full state including all design changes

---

## 1. Purpose

A reusable web-based platform for conducting API-integration practical examinations. Students answer a conceptual MCQ section, fetch a personalised question paper, and complete three practical tasks using Apify actors. The platform grades all submissions mechanically — no human reads code.

---

## 2. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript) | `app/` directory, strict mode |
| Database | Supabase Postgres | Pooled connection port 6543 (pgBouncer transaction mode) |
| Hosting | Vercel | Cron job every 1 min for verification and auto-close |
| Auth | JWT cookie via `jose` | Cookie: `ca1_session`, 24h, httpOnly, sameSite=lax |
| Passwords | bcryptjs cost 12 | Never stored in plaintext |
| API keys | SHA-256 hash stored | Raw key shown once only at generation |
| Styling | Tailwind CSS v4 | Custom classes in globals.css |

---

## 3. Environment Variables

```env
SUPABASE_URL                  # https://nzhnyyysrxnxehnichbr.supabase.co
SUPABASE_SERVICE_ROLE_KEY     # Server-side only — never expose to browser
SESSION_SECRET                # Min 32 random chars for JWT signing
APIFY_API_TOKEN               # Dinesh's personal token — for run verification
NEXT_PUBLIC_APP_URL           # https://examstudioca2.thecoachdinesh.com
TASK3_SHEET_CSV_URL           # https://docs.google.com/spreadsheets/d/1qx1N7K_ajp_kbSCGlS0nMUqqdXbc41cNGxQtAO8wkFQ/export?format=csv&gid=187802517
CRON_SECRET                   # Any random string — authorises /api/cron/verify
```

**Critical rules:**
- `SUPABASE_SERVICE_ROLE_KEY` must never reach the browser
- `TASK3_SHEET_CSV_URL` is read server-side automatically at session creation — it is never entered in any UI field
- Use pooled connection string (port 6543) for Vercel, direct (port 5432) only for running migrations locally

---

## 4. Assessment Structure (Frozen)

| Section | Component | Marks | Rule |
|---|---|---|---|
| A — MCQ | 10 questions × 0.5 | 5 | No negative marking |
| B — Task 1 | Magic code colour MCQ | 1 | Exact colour match |
| B — Task 2 | count_total exact | 1.5 | Zero tolerance |
| B — Task 2 | count_scoped exact | 1.5 | Zero tolerance |
| B — Task 2 | Valid Apify run | 1.0 | Gate |
| B — Task 3 | City name match | 2.0 | Case-insensitive trimmed |
| B — Task 3 | Temperature ±2.0°C | 3.0 | Tolerance |
| **Total** | | **15** | |

### Task 1 — Fetch My Magic Code (1 mark)

Student calls `GET /api/v1/paper` with their API key from their own code. The paper response includes a `magic_code` field which is one of four colours: **Red, Blue, Green, Orange** — assigned deterministically by PRN seed. The dashboard shows all four as clickable buttons. Student selects the colour they received. Server checks against stored magic_code → 1 mark or 0.

This tests: authenticated API call + reading and parsing a JSON response.

The `magic_code` is also in the rendered paper so students who call the API themselves can see it. The dashboard colour MCQ is the submission mechanism.

### Task 2 — Corpus Word Count (4 marks)

Student builds an Apify actor that:
1. Fetches corpus index, follows links to all 5 pages
2. Counts target word across entire corpus (count_total)
3. Counts target word on scoped page only (count_scoped)
4. Pushes both to dataset: `Actor.push_data({"count_total": N, "count_scoped": N})`
5. POSTs to `/api/v1/submit/task2` with API key

### Task 3 — City Temperature (5 marks)

Student builds an Apify actor that:
1. Fetches spreadsheet CSV from the URL in their paper
2. Finds their PRN row, reads City, Latitude, Longitude
3. Calls Open-Meteo: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m`
4. Reads `current.temperature_2m`
5. POSTs to `/api/v1/submit/task3` with API key

Must use lat/lon from spreadsheet — not geocode the city name.

### CO and Bloom's

- CO3: evidenced at L1–L2 via MCQ slots 1–6 only. No L3 CO3 in this instrument.
- CO4: evidenced at L1–L3 via MCQ slots 7–10 and all three tasks.
- CO3 at L3+ is evidenced by the take-home assignment (already conducted).
- Bloom's spread: 67% L3, 33% L1–L2. Never report as "L3 only."

---

## 5. Student Journey (How It Works)

**Before exam starts (registration_open):**
1. Student registers with @sitpune.edu.in email and PRN
2. Generates exam API key — shown once, stored as SHA-256 hash
3. "Fetch Paper" button is visible but disabled

**Exam starts (SA transitions to running):**
4. "Fetch Paper" button enables
5. Student clicks it → dashboard calls `GET /api/me/paper` (session cookie)
6. Paper issued and stored → entire dashboard populates at once:
   - Section A: all 10 MCQ questions
   - Section B: Task 1 colour buttons, Task 2 params, Task 3 params
7. Student works in any order — no gates between sections

**Section A — MCQ:**
- Each answer saved per-click to server
- Green tick confirms server recorded it
- Answers changeable at any time while running
- No submit button

**Task 1:**
- Student writes code calling `GET /api/v1/paper` with their API key
- Reads `magic_code` from response (one of Red/Blue/Green/Orange)
- Clicks matching colour on dashboard
- Dashboard calls `POST /api/me/task1`
- 1 mark if correct

**Tasks 2 and 3:**
- Student builds Apify actor, runs it, POSTs result to exam API with X-API-Key header
- Returns 202 immediately — verification is async
- Can resubmit up to 10 times while running — latest submission graded
- Marks hidden until exam closes

**After exam closes:**
- Results page shows full breakdown
- MCQ marks immediate, task marks after verification completes

---

## 6. Architecture Decisions

### Corpus belongs to exam definition, not session

**Corpus fields are on `ca1_exam_definitions`, not `ca1_exam_sessions`.**

This was corrected from an earlier wrong design. The corpus (reference table, manifest, hash, path) is as fixed as the task definitions — it never changes between batches. Storing it in the exam definition means it's loaded once in migration 003 and both sessions inherit it automatically. No upload step ever needed.

### Sheet snapshot is per session

The spreadsheet snapshot IS per-session because it could theoretically differ between batches (different student lists). It is loaded automatically from `TASK3_SHEET_CSV_URL` when the SA creates a session. If the snapshot is empty when SA tries to start, the route now fetches it on the fly at that moment rather than rejecting.

### Paper issued on dashboard button click, not on API call

The "Fetch Paper" button on the dashboard calls `GET /api/me/paper` (session cookie). This issues the paper and displays all task parameters immediately. Students also call `GET /api/v1/paper` separately with their API key as part of Task 1 — that's a separate action for marks, not required to see the paper.

### MCQ no longer gates paper

Section A and Section B are shown simultaneously after paper fetch. No gate. Students can do tasks in any order. A student who only knows MCQ can do Section A and leave; a student who only knows coding can do Section B and skip MCQ.

### Two sessions, one corpus

Both Batch 1 and Batch 2 sessions reference `exam_id = 1` (same exam definition, same corpus). Per-student personalisation comes from the PRN seed — different PRNs always get different target words and cities. Only one session can be `running` at a time (unique index enforces this).

---

## 7. Database Schema

All tables prefixed `ca1_`. Existing project tables (cohorts, assessments, etc.) are unaffected.

### Key structural points

**`ca1_exam_definitions`** — has corpus columns added by migration 003:
```
corpus_path             TEXT    default '/corpus'
corpus_hash             TEXT
corpus_manifest         JSONB
corpus_reference_table  JSONB   ← the word count lookup table
```

**`ca1_exam_sessions`** — does NOT have corpus columns (removed by migration 003):
```
sheet_csv_url     TEXT    ← the Google Sheets export URL
sheet_snapshot    JSONB   ← frozen PRN→city/lat/lon map
sheet_hash        TEXT
```

**`ca1_question_papers`** — has magic_code column added by migration 004:
```
magic_code  TEXT  ← one of: Red, Blue, Green, Orange
```

**`ca1_submissions`** — one row per student per task, upsert model:
```
Effective marks = COALESCE(override_marks, marks_awarded)
Never use marks_awarded directly in any report or display.
```

### All 17 tables

```
ca1_exam_definitions      ca1_exam_tasks          ca1_task_components
ca1_mcq_slots             ca1_mcq_questions       ca1_exam_sessions
ca1_roster                ca1_students            ca1_api_keys
ca1_question_papers       ca1_mcq_assignments     ca1_submissions
ca1_submission_attempts   ca1_flags               ca1_exceptions
ca1_staff                 ca1_audit_log
```

### Key indexes

```sql
-- One running session at a time
CREATE UNIQUE INDEX ca1_one_active_session ON ca1_exam_sessions (status) WHERE status = 'running';

-- Apify account per task (across students)
CREATE UNIQUE INDEX ca1_uniq_apify_user_task ON ca1_submissions (apify_user_id, task_no)
  WHERE apify_user_id IS NOT NULL AND verification_status <> 'failed';

-- Run ID per task
CREATE UNIQUE INDEX ca1_uniq_run_task ON ca1_submissions (submitted_run_id, task_no)
  WHERE submitted_run_id IS NOT NULL;
```

### RPC functions (must be added manually in Supabase SQL editor)

```sql
CREATE OR REPLACE FUNCTION increment_times_served(qid BIGINT) RETURNS void AS $$
  UPDATE ca1_mcq_questions SET times_served = times_served + 1 WHERE id = qid;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_times_correct(qid BIGINT) RETURNS void AS $$
  UPDATE ca1_mcq_questions SET times_correct = times_correct + 1 WHERE id = qid;
$$ LANGUAGE sql;
```

---

## 8. Migration Files

Run in order. All are in `supabase/migrations/`.

| File | What it does | Run condition |
|---|---|---|
| `001_ca1_schema.sql` | Creates all 17 tables, RLS deny-all, indexes | Fresh setup only |
| `002_ca1_seed.sql` | SA account (placeholder hash), exam def, MCQ bank (40 questions), roster (231 students) | Fresh setup only |
| `003_ca1_corpus.sql` | Adds corpus columns to exam_definitions, populates reference table from generated corpus, creates Batch 1 and Batch 2 sessions | Run once after corpus generated |
| `004_ca1_task1_magic_code.sql` | Updates mark structure (T1→1, T2→4 with 1.5/1.5/1.0), adds magic_code to question_papers, updates task components | Run once |

### If migrations 001 and 002 already ran — apply this patch first

```sql
-- Add corpus columns to exam definitions
ALTER TABLE ca1_exam_definitions
  ADD COLUMN IF NOT EXISTS corpus_path            TEXT  NOT NULL DEFAULT '/corpus',
  ADD COLUMN IF NOT EXISTS corpus_hash            TEXT  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS corpus_manifest        JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS corpus_reference_table JSONB NOT NULL DEFAULT '{}';

-- Remove corpus columns from sessions
ALTER TABLE ca1_exam_sessions
  DROP COLUMN IF EXISTS reference_table,
  DROP COLUMN IF EXISTS corpus_manifest,
  DROP COLUMN IF EXISTS corpus_hash,
  DROP COLUMN IF EXISTS corpus_path;

-- Add magic_code to question papers
ALTER TABLE ca1_question_papers
  ADD COLUMN IF NOT EXISTS magic_code TEXT NOT NULL DEFAULT 'Blue';
```

Then run 003 and 004 normally.

---

## 9. Seeded Data

### Super Admin

```
Email:    dinesh.k.wadhwani@gmail.com
Password: Din@16285
Role:     sa
```

**The hash in 002_ca1_seed.sql is a placeholder.** Run `node scripts/generate-sa-hash.js` and paste the UPDATE statement into Supabase SQL editor before first login.

### Exam definition

- Code: `F0003-CA1-2026`
- Duration: 50 minutes
- MCQ: 10 × 0.5 marks
- Email domain: `sitpune.edu.in`

### MCQ bank — 40 questions, 10 slots × 4 variants

| Slot | CO | Concept | Bloom's |
|---|---|---|---|
| 1 | CO3 | Word vs contextual embeddings | L2 |
| 2 | CO3 | Chunking and chunk size effects | L2 |
| 3 | CO3 | Vector database indexing | L1 |
| 4 | CO3 | Cosine vs Euclidean similarity | L1 |
| 5 | CO3 | Retrieval vs context stuffing | L2 |
| 6 | CO3 | RAG pipeline component ordering | L2 |
| 7 | CO4 | Workflow vs agent | L2 |
| 8 | CO4 | Tools and function calling | L1 |
| 9 | CO4 | Human-in-the-loop vs fully autonomous | L2 |
| 10 | CO4 | Short-term vs long-term memory | L1 |

### Roster

231 entries: 230 students + Dinesh Wadhwani (PRN: 1234).

---

## 10. API Reference

### Student — session cookie auth

```
POST /api/auth/register        { name, prn, email, phone, password }
POST /api/auth/login           { email, password, role: 'student' }
POST /api/auth/logout
POST /api/auth/change-password { new_password }
GET  /api/keys                 → { has_key, key_prefix }
POST /api/keys                 → { api_key, prefix, shown_once: true }  ← shown once
GET  /api/mcq                  → 10 questions with shuffled options
POST /api/mcq                  { slot_no, answer_key } → { recorded: true }
GET  /api/me/status            → { exam_status, mcq, paper, tasks, total_marks, exam_ends_at }
GET  /api/me/paper             → renders and returns paper (session cookie version of v1/paper)
POST /api/me/task1             { colour: 'Red'|'Blue'|'Green'|'Orange' } → { recorded: true }
```

### Exam API — X-API-Key header

```
GET  /api/v1/paper             → rendered paper JSON (idempotent, rate-limited 30/min)
POST /api/v1/submit/task1      { colour } → 202
POST /api/v1/submit/task2      { count_total, count_scoped, actor_id, run_id, actor_url } → 202
POST /api/v1/submit/task3      { city, temperature_c, actor_id, run_id, actor_url } → 202
GET  /api/v1/status            → task status
```

### SA — session cookie, staff role

```
GET  /api/sa/session                            → list all sessions
POST /api/sa/session  { action: 'create', label, exam_id }
POST /api/sa/session  { action: 'transition', session_id, new_status }
POST /api/sa/session  { action: 'toggle_apify_relax', session_id }
GET  /api/sa/session/stats                      → live board numbers
GET  /api/sa/students                           → list
GET  /api/sa/students?id=N                      → full detail
GET  /api/sa/flags                              → all flags
POST /api/sa/flags    { flag_id, resolution }
POST /api/sa/override { action: 'override_marks', submission_id, override_marks, reason }
POST /api/sa/override { action: 'reset_password', student_id } → { temp_password }
POST /api/sa/override { action: 'run_verifications' }          → { processed, pending_after }
POST /api/sa/override { action: 'requeue_deferred' }           → { requeued }
GET  /api/cron/verify  Authorization: Bearer $CRON_SECRET
```

---

## 11. Paper Generation (Deterministic)

```
seed        = sha256(prn + ':' + session_id)
magic_code  = COLOURS[ BigInt(seed + ':magic') % 4 ]        → Red/Blue/Green/Orange
target_word = word_pool[ BigInt(seed) % pool_length ]
scoped_page = 1 + (BigInt(seed) >> 16n) % 5n               → 1–5
MCQ question per slot: BigInt(seed + ':mcq:' + slot_no) % question_count
MCQ option shuffle: Fisher-Yates seeded by (seed + ':slot:' + slot_no)
```

Paper insert is idempotent via `ON CONFLICT (student_id) DO NOTHING`.

---

## 12. Corpus

- ~250,000 words, 5 static HTML pages at `/public/corpus/page1.html` through `page5.html`
- `index.html` links to pages only — no filler words
- All words lowercase, space-separated, no punctuation
- Served from CDN — never through a serverless function
- Reference table, manifest, and hash stored in `ca1_exam_definitions` — loaded once by migration 003

**Generator:** `npm run generate:corpus`
Outputs: HTML pages + `public/corpus/reference-table.json` + `public/corpus/manifest.json`

**After regeneration:** re-run migration 003 or manually UPDATE `ca1_exam_definitions` with new corpus data.

---

## 13. Task 3 Spreadsheet

- Google Sheet: `https://docs.google.com/spreadsheets/d/1qx1N7K_ajp_kbSCGlS0nMUqqdXbc41cNGxQtAO8wkFQ/`
- CSV export URL (this is what's in the env var): `https://docs.google.com/spreadsheets/d/1qx1N7K_ajp_kbSCGlS0nMUqqdXbc41cNGxQtAO8wkFQ/export?format=csv&gid=187802517`
- Columns: PRN, Name, City, Latitude, Longitude
- PRN column formatted as plain text — critical to prevent Google coercing to integers
- Sheet is publicly readable (Anyone with link → Viewer)
- Snapshot frozen into session at creation. If snapshot is empty when SA tries to start exam, the transition route fetches it on the fly.

**Generator:** `npm run generate:spreadsheet`

---

## 14. Verification and Grading

### Task 1 (magic code)
Graded synchronously in `/api/me/task1` and `/api/v1/submit/task1`. Checks submitted colour against `ca1_question_papers.magic_code`. Returns immediately with result. 1 mark if correct, 0 if wrong. Can be resubmitted.

### Task 2 (word count)
Async after 202 response:
1. Verify Apify run: exists, actId matches, status SUCCEEDED, finishedAt within session window
2. Check dataset contains submitted counts
3. Compare count_total and count_scoped against frozen expected values from question paper
4. Fetch actor source, set key_hardcoded flag (feedback only, never graded)

Marks: count_total (1.5) + count_scoped (1.5) + valid run (1.0) = 4.0

### Task 3 (temperature)
Async after 202 response:
1. Verify Apify run (same as Task 2)
2. Server calls Open-Meteo at paper's lat/lon (not student's submitted city string)
3. City: case-insensitive trimmed match
4. Temperature: abs(submitted - server_reading) <= 2.0

Marks: city (2.0) + temperature (3.0) = 5.0

### Deferred submissions
If Apify or Open-Meteo unreachable → status = 'deferred'. Cron retries every minute. SA can also trigger manually from dashboard (Run verifications now button) or requeue all deferred via dashboard.

### Collision rules
| Condition | Action |
|---|---|
| Same run_id, same task, different students | Reject second 409 |
| Same apify_user_id, same task, different students | Reject second 409, flag both |
| Same student resubmitting | Permitted, upsert, first_submitted_at preserved |

### Break-glass
SA toggles `relax_apify_verification` on session → Apify checks skipped. Use only if Apify degrades mid-exam.

---

## 15. Session Lifecycle

```
setup → registration_open → running → closed → archived
```

| Status | Students can do |
|---|---|
| setup | Nothing |
| registration_open | Register, login, generate API key |
| running | Everything — fetch paper, MCQ, tasks |
| closed | View results |
| archived | View results (permanent) |

**Key generation** is permitted from `registration_open` — moves the spike out of the 50-minute window.

**Auto-close:** cron closes session when `now > ends_at`.

**Two sessions** (Batch 1 and Batch 2) are pre-created by migration 003. SA just transitions them — no need to create new ones from dashboard.

**Starting exam:** transition route checks that sheet_snapshot is non-empty. If empty (happens with migration-created sessions that predate the env var), it fetches the sheet from `TASK3_SHEET_CSV_URL` on the fly and saves it before proceeding.

---

## 16. File Structure

```
examstudio/
├── .env.example
├── vercel.json                      ← cron every 1 min + corpus CDN cache headers
├── next.config.ts
├── tsconfig.json
├── tsconfig.node.json               ← for ts-node scripts
├── package.json
│
├── public/corpus/                   ← generated corpus (commit to git)
│   ├── index.html
│   ├── page1.html … page5.html
│   ├── reference-table.json         ← gitignored (loaded into DB by migration 003)
│   └── manifest.json                ← gitignored
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx                     ← redirects / → /login
│   ├── globals.css                  ← card, btn-primary/secondary/danger, badge-*, input, label
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── change-password/page.tsx
│   ├── dashboard/page.tsx           ← fetch paper button + all sections together
│   ├── mcq/page.tsx                 ← per-click save, SaveTick
│   ├── results/page.tsx             ← shown after exam closes
│   │
│   ├── sa/
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx       ← live board, session controls, verification panel
│   │   ├── students/page.tsx
│   │   ├── students/[id]/page.tsx   ← full detail: MCQ, tasks, overrides, timeline
│   │   ├── flags/page.tsx
│   │   └── session/
│   │       ├── page.tsx             ← Suspense wrapper
│   │       └── SessionConfigClient.tsx
│   │
│   └── api/
│       ├── auth/{register,login,logout,change-password}/route.ts
│       ├── keys/route.ts
│       ├── mcq/route.ts
│       ├── me/
│       │   ├── status/route.ts      ← session-cookie status for dashboard polling
│       │   ├── paper/route.ts       ← session-cookie paper fetch for Fetch Paper button
│       │   └── task1/route.ts       ← session-cookie Task 1 colour submission
│       ├── v1/
│       │   ├── paper/route.ts       ← X-API-Key, idempotent
│       │   ├── status/route.ts
│       │   └── submit/
│       │       ├── task1/route.ts   ← colour submission via API key
│       │       ├── task2/route.ts
│       │       └── task3/route.ts
│       ├── sa/
│       │   ├── session/route.ts     ← create/transition/toggle_apify_relax
│       │   ├── session/stats/route.ts
│       │   ├── students/route.ts
│       │   ├── flags/route.ts
│       │   └── override/route.ts    ← override_marks, reset_password, run_verifications, requeue_deferred
│       └── cron/verify/route.ts
│
├── components/ui/
│   ├── Alert.tsx
│   ├── Countdown.tsx
│   └── SaveTick.tsx
│
├── lib/
│   ├── types.ts                     ← all interfaces including ExamDefinition with corpus fields
│   ├── db.ts                        ← lazy Supabase singleton + audit()
│   ├── session.ts                   ← JWT cookies, requireStudent/Staff/SA
│   ├── api.ts                       ← ok/err/forbidden/badRequest/serverError helpers
│   ├── paper.ts                     ← makeSeed, pickWord, pickPage, pickMagicCode,
│   │                                   buildRenderedPaper, shuffleOptions, pickQuestion
│   ├── apify.ts                     ← getRun, getDatasetItems, getActorSource, verifyRun
│   ├── weather.ts                   ← getCurrentTemperature (Open-Meteo)
│   └── grading.ts                   ← gradeTask2, gradeTask3, runPendingVerifications
│
├── scripts/
│   ├── generate-corpus.ts           ← npm run generate:corpus
│   ├── generate-spreadsheet.ts      ← npm run generate:spreadsheet
│   └── generate-sa-hash.js          ← node scripts/generate-sa-hash.js
│
└── supabase/migrations/
    ├── 001_ca1_schema.sql
    ├── 002_ca1_seed.sql
    ├── 003_ca1_corpus.sql           ← corpus into exam_def + creates Batch 1 & 2 sessions
    └── 004_ca1_task1_magic_code.sql ← mark changes + magic_code column
```

---

## 17. Known Issues and Pending Fixes

### Issue 1 — Task 2/3 parameters not showing on dashboard (ACTIVE BUG)

The dashboard shows "page ? count" placeholder instead of the student's actual scoped page number. The `paper` state variable is not being populated after fetch, so task parameters (target word, scoped page, corpus URL, sheet URL, submit endpoints) are not displayed.

**Fix:** In `app/dashboard/page.tsx`, the `fetchPaper()` function calls `GET /api/me/paper` and sets `setPaper(data)`. Verify this is working. The paper data should be displayed in Task 2 and Task 3 cards showing actual values, not placeholders. Check that the response shape matches what the component expects.

### Issue 2 — Task descriptions need improvement

Task 2 and Task 3 descriptions in `ca1_exam_tasks.config` are minimal. Students see incomplete instructions.

**Fix:** Run this SQL to update descriptions:

```sql
UPDATE ca1_exam_tasks
SET config = jsonb_set(config, '{description}',
'"Build and deploy an Apify actor that crawls the word corpus and counts your assigned target word. Your actor must: (1) Fetch the corpus index page from the URL in your paper, follow all page links to crawl every content page. (2) Count how many times your target word appears across the ENTIRE corpus — store as count_total. Count how many times it appears on your SCOPED PAGE only — store as count_scoped. Use lowercase matching, split on whitespace, exact whole-word matches only. (3) Push both counts to the actor default dataset: Actor.push_data({\"count_total\": N, \"count_scoped\": N}). (4) POST to the submit endpoint in your paper with header X-API-Key: your-exam-api-key. Your APIFY_ACTOR_ID and APIFY_ACTOR_RUN_ID are injected as environment variables by Apify — read them from os.environ, do not hardcode them. Actor must run on Apify platform — local runs produce no run ID and will be rejected."'
)
WHERE task_no = 2
AND exam_id = (SELECT id FROM ca1_exam_definitions WHERE code = 'F0003-CA1-2026');

UPDATE ca1_exam_tasks
SET config = jsonb_set(config, '{description}',
'"Build and deploy an Apify actor that finds your assigned city in a spreadsheet and fetches its current air temperature. Your actor must: (1) Fetch the spreadsheet CSV from the URL in your paper. Parse the CSV, find the row where the PRN column matches YOUR PRN exactly (trim whitespace when comparing). Read the City, Latitude, and Longitude from that row. (2) Call the Open-Meteo weather API — no API key needed: https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m — use the latitude and longitude from the spreadsheet, NOT geocoded from the city name. Read current.temperature_2m from the JSON response. (3) Push result to actor dataset: Actor.push_data({\"city\": \"CityName\", \"temperature_c\": 31.4}). (4) POST to the submit endpoint in your paper with header X-API-Key: your-exam-api-key. Read APIFY_ACTOR_ID and APIFY_ACTOR_RUN_ID from environment variables."'
)
WHERE task_no = 3
AND exam_id = (SELECT id FROM ca1_exam_definitions WHERE code = 'F0003-CA1-2026');
```

### Issue 3 — Sheet snapshot empty on migration-created sessions

Sessions created by migration 003 have empty `sheet_snapshot` because the env var wasn't set at migration time. The transition route (running → registration_open) now fetches the sheet on the fly if snapshot is empty. Verify this works correctly.

### Issue 4 — PDF/XLSX reports not built

`pdf-lib` and `xlsx` are in package.json but report endpoints don't exist yet. Needed:
- `GET /api/sa/reports/marks-sheet?session_id=N` → XLSX
- `GET /api/sa/reports/student-pdf?student_id=N` → PDF
- `GET /api/sa/reports/co-attainment?session_id=N` → JSON/table
- `GET /api/sa/reports/item-analysis?session_id=N` → JSON

### Issue 5 — Exception recording UI not built

`ca1_exceptions` table exists but no UI form for invigilators to record exceptions. Add to SA student detail page.

---

## 18. SA Dashboard — What You See

When logged in as SA at `/sa/login`:

**Live board** (auto-refreshes every 5s):
- Registered count, MCQ complete, papers fetched
- Task 1/2/3 submitted counts
- Pending verification count (with "Run verifications now" button if > 0)
- Flags open count
- Time remaining countdown (when running)

**Sessions panel:**
- Two sessions pre-created: "Batch 1 — Sept 2026" and "Batch 2 — Sept 2026"
- Each shows status and transition buttons
- "Corpus ✓" badge (always green — corpus loaded in exam definition)
- Apify verification toggle (break-glass)

**Session transitions:**
```
setup → [Open Registration] → registration_open → [Start Exam] → running → [Close] → closed → [Archive] → archived
```

Only one session running at a time. Starting a second while first is running returns an error.

---

## 19. Design Principles (Do Not Reverse)

1. **Grade outputs not process.** No human reads code.
2. **Reference answers frozen at paper issue.** Grading reads `t2_expected_total`, `t2_expected_scoped`, `t3_city`, `t3_lat`, `t3_lon`, `magic_code` from the paper row — never recomputes.
3. **Zero tolerance on word counts. ±2.0°C on temperature.**
4. **No draft state.** MCQ per-click. No submit button.
5. **Ticks on server 200 only.** Never optimistic.
6. **Resubmission permitted.** 202 pending, marks hidden. No feedback loop.
7. **Key hardcoding detected, never graded.**
8. **No outbound email.** Staff-mediated password reset.
9. **Corpus belongs to exam definition, not session.**
10. **Sheet URL in env var, never in UI.**
11. **No MCQ gate.** Section A and B shown together after paper fetch.
12. **Task 1 is the magic code colour — not the paper fetch itself.**

---

## 20. Pre-Exam Checklist

- [ ] All 4 migrations run in Supabase (plus patch if needed)
- [ ] Two RPC functions added (increment_times_served, increment_times_correct)
- [ ] SA password hash updated (node scripts/generate-sa-hash.js)
- [ ] Corpus generated and committed (`npm run generate:corpus`)
- [ ] Spreadsheet generated, uploaded to Google Sheets, shared publicly
- [ ] `TASK3_SHEET_CSV_URL` set in Vercel env vars and verified (open URL in incognito — should show raw CSV)
- [ ] All env vars set in Vercel, redeployed
- [ ] SA login works
- [ ] Both sessions visible on SA dashboard with "Corpus ✓"
- [ ] Open registration on Batch 1 session
- [ ] Test student registration with PRN 1234 (Dinesh Wadhwani)
- [ ] Test paper fetch — verify target word, magic code, Task 2 and Task 3 params all visible
- [ ] Test Task 1 colour selection
- [ ] Test mock Task 2 and Task 3 submissions (202 received)
- [ ] Verify SA live board updates
- [ ] Test "Run verifications now" button
- [ ] Brief students: register before exam, generate API key before exam, have Apify account ready with one successful build

---

## 21. Frozen Decisions

| # | Decision |
|---|---|
| 1 | Total marks: 15 |
| 2 | Duration: 50 minutes, SA-started, single batch-wide clock |
| 3 | MCQ: 10 × 0.5, no negative marking |
| 4 | MCQ: slot-based, 10 slots × 4 variants, seeded by PRN |
| 5 | No MCQ gate — paper fetch reveals everything at once |
| 6 | Task 1: magic code colour (Red/Blue/Green/Orange), 1 mark |
| 7 | Task 2: 1.5 + 1.5 + 1.0 = 4 marks |
| 8 | Task 3: 2.0 + 3.0 = 5 marks |
| 9 | Bloom's: L1–L3 spread, 67% L3, never "L3 only" |
| 10 | CO3 L3+: take-home assignment, not this instrument |
| 11 | Weather: Open-Meteo, current.temperature_2m, no key, ±2.0°C |
| 12 | Count tolerance: zero |
| 13 | Corpus: 250K words, 5 pages, same for both batches |
| 14 | Corpus stored in exam_definitions not sessions |
| 15 | Sheet URL in TASK3_SHEET_CSV_URL env var, never in UI |
| 16 | Paper fetch: idempotent, repeat returns identical paper |
| 17 | Paper issued on dashboard button click AND on API call (both idempotent) |
| 18 | Task resubmission: permitted while running, latest graded, max 10 |
| 19 | Apify account sharing: first claim wins, second rejected, both flagged |
| 20 | Key hardcoding: detected, feedback only, never graded |
| 21 | No outbound email. Staff-mediated password reset |
| 22 | Table prefix: ca1_ |
| 23 | Two sessions pre-created by migration 003 |
| 24 | Email domain: @sitpune.edu.in |
| 25 | Password: min 8 chars, no complexity rules |
| 26 | Phone: mandatory, contact/ID only, never auth factor |

---

*End of handoff. Project is at v5. Next priority: fix dashboard paper state bug (Issue 1) and run task description SQL (Issue 2).*
