# Exam Studio — F0003 CA1

CA1 Practical Examination Platform — Autonomous AI Systems and Agent-Based Computing
Symbiosis Institute of Technology, Pune

## Stack
Next.js 15 · TypeScript · Supabase · Vercel · Tailwind CSS · Open-Meteo · Apify

---

## STEP 1: Supabase Setup

1. Create project at https://supabase.com
2. SQL Editor → run `supabase/migrations/001_ca1_schema.sql`
3. SQL Editor → run `supabase/migrations/002_ca1_seed.sql`
4. Fix SA password hash:
   ```bash
   node scripts/generate-sa-hash.js
   # Copy the UPDATE statement it prints and run it in Supabase SQL editor
   ```
5. Add RPC functions in SQL editor:
   ```sql
   CREATE OR REPLACE FUNCTION increment_times_served(qid BIGINT) RETURNS void AS $$
     UPDATE ca1_mcq_questions SET times_served = times_served + 1 WHERE id = qid;
   $$ LANGUAGE sql SECURITY DEFINER;

   CREATE OR REPLACE FUNCTION increment_times_correct(qid BIGINT) RETURNS void AS $$
     UPDATE ca1_mcq_questions SET times_correct = times_correct + 1 WHERE id = qid;
   $$ LANGUAGE sql SECURITY DEFINER;
   ```

## STEP 2: Generate Corpus (run locally once)

```bash
npm install
npx ts-node --project tsconfig.node.json scripts/generate-corpus.ts
```

Outputs to `public/corpus/` (auto-served by Vercel).
Keep `reference-table.json` — you upload it to the SA session before the exam.

## STEP 3: Generate Task 3 Spreadsheet

```bash
npx ts-node --project tsconfig.node.json scripts/generate-spreadsheet.ts
```

Outputs `scripts/task3-spreadsheet.csv`.
Import to Google Sheets → share → get CSV export URL.

## STEP 4: Vercel Environment Variables

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
APIFY_API_TOKEN=your-personal-apify-token
NEXT_PUBLIC_APP_URL=https://examstudioca2.thecoachdinesh.com
```

## STEP 5: Deploy

```bash
vercel --prod
# Then add custom domain examstudioca2.thecoachdinesh.com in Vercel dashboard
```

---

## Exam Day Flow

### Pre-exam (30 min before)
1. Login at /sa/login (dinesh.k.wadhwani@gmail.com / Din@16285 — CHANGE BEFORE EXAM)
2. Create session → paste Google Sheets CSV URL
3. Set reference table → paste reference-table.json contents
4. Open Registration

### Exam start
1. Click Start Exam → 50-minute timer begins
2. Students: /register → /login → /mcq (complete all 10) → /dashboard (generate key) → write actor → submit

### For Batch 2
1. Close Batch 1 session
2. Create new session (same sheet URL, same reference table)
3. Open Registration, then Start Exam

---

## API Reference (for student Apify actors)

```
GET  /api/v1/paper           X-API-Key: exk_live_...   → question paper JSON
POST /api/v1/submit/task2    X-API-Key: ...             → submit word counts
POST /api/v1/submit/task3    X-API-Key: ...             → submit temperature
GET  /api/v1/status          X-API-Key: ...             → task statuses
```

### Task 2 body
```json
{"count_total": 12345, "count_scoped": 678, "actor_id": "...", "run_id": "...", "actor_url": "..."}
```

### Task 3 body
```json
{"city": "Jaipur", "temperature_c": 34.2, "actor_id": "...", "run_id": "...", "actor_url": "..."}
```

---

## Marks
| Component | Marks | Rule |
|---|---|---|
| MCQ (10 × 0.5) | 5 | Correct answer |
| Task 1: paper fetch | 2 | Gate |
| Task 2: total count | 1.5 | Exact |
| Task 2: scoped count | 1.0 | Exact |
| Task 2: run verified | 0.5 | Gate |
| Task 3: city | 2.0 | Exact (case-insensitive) |
| Task 3: temperature | 3.0 | ±2.0°C tolerance |
| **Total** | **15** | |
