# Task 3 Spreadsheet — Setup Instructions

The Task 3 spreadsheet tells each student which city's temperature to fetch. You set this up once before deployment. The URL goes into your Vercel environment variables — not into the SA dashboard.

---

## How it works

```
You run a script → CSV file created locally
You upload CSV to Google Sheets → Google gives you a public URL
You put that URL in Vercel as TASK3_SHEET_CSV_URL
When SA creates a session → platform auto-fetches the sheet and freezes the data
Student receives the sheet URL in their question paper → actor fetches it, finds their row
```

Students never type the URL manually — it is embedded in their question paper automatically.

---

## Step 1 — Generate the CSV

Run this once from the project root:

```bash
npx ts-node --project tsconfig.node.json scripts/generate-spreadsheet.ts
```

This creates `scripts/task3-spreadsheet.csv`. It assigns a city to every student in the roster, seeded by PRN so the assignment is deterministic and reproducible. Pune is excluded (students can just look outside). Dinesh Wadhwani (PRN 1234) is hardcoded to Indore.

---

## Step 2 — Upload to Google Sheets

1. Go to **Google Sheets → Blank spreadsheet**
2. **File → Import → Upload** → select `scripts/task3-spreadsheet.csv`
3. Import settings:
   - Separator: **Comma**
   - Convert text to numbers and dates: **NO** ← critical, see PRN note below
   - Click **Import data**

---

## Step 3 — Format PRN column as plain text (critical)

Google Sheets will try to convert PRN values like `23070122004` to numbers, which drops leading zeros and breaks student lookups.

After import:
1. Select column A (PRN column)
2. **Format → Number → Plain text**
3. Check a few cells — they should show `23070122004` not `2.307e10` or `23070122`

---

## Step 4 — Make the sheet publicly readable

1. Click **Share** (top right)
2. Under "General access" → change to **"Anyone with the link" → Viewer**
3. Click Done

---

## Step 5 — Get the CSV export URL

**This is the most important step. You need the CSV export URL, not the share link.**

The share link opens a webpage. The CSV export URL returns raw CSV. They are different.

**How to get the CSV export URL:**

Look at your sheet's browser URL:
```
https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXXXXXXXX/edit#gid=0
```

Copy the Sheet ID (the long string between `/d/` and `/edit`).

Build the export URL:
```
https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXXXXXXXX/export?format=csv&gid=0
```

**Test it:** open this URL in a new incognito browser tab. You should see raw CSV text — comma-separated values, no HTML, no webpage. If you see a Google login page or a webpage, the sheet is not public. Go back to Step 4.

---

## Step 6 — Add to Vercel environment variables

1. Go to your Vercel project → **Settings → Environment Variables**
2. Add a new variable:
   - **Name:** `TASK3_SHEET_CSV_URL`
   - **Value:** the full CSV export URL from Step 5
   - **Environment:** Production (and Preview if you want)
3. Click **Save**
4. **Redeploy** your project (Vercel does not apply new env vars to existing deployments)

That's it. The SA dashboard will never ask you for this URL. When an SA creates a session, the platform reads `TASK3_SHEET_CSV_URL` from the environment, fetches the sheet, and freezes a copy into the session.

---

## Step 7 — Verify it worked

When the SA creates a session in the dashboard, the response will include `_sheet_rows_loaded: 231` (or however many students are in the sheet). If this is 0 or you get an error, the URL is wrong or the sheet is not public.

---

## Column reference

| Column | Format | Example |
|---|---|---|
| PRN | Text (quoted in CSV) | `"23070122004"` |
| Name | Text | `"Aarohi Kondpalle"` |
| City | City name | `"Nagpur"` |
| Latitude | Decimal number | `21.1458` |
| Longitude | Decimal number | `79.0882` |

---

## How cities are assigned

The generator assigns cities using `sha256('city:' + prn)` — deterministic, unique per student, not guessable from the PRN. Adjacent seats get different cities. Pune excluded.

---

## What students do with this

Their question paper (returned by `GET /api/v1/paper`) contains `task3.sheet_csv_url`. Their Apify actor must:

1. Fetch the CSV from that URL
2. Find the row where PRN matches theirs (trimmed string comparison)
3. Read City, Latitude, and Longitude
4. Call Open-Meteo using **the lat/lon from the sheet** — not by geocoding the city name
5. POST city name and temperature to `/api/v1/submit/task3`

The server grades temperature against the coordinates stored in the student's frozen paper — which came from the sheet snapshot taken at session creation. So even if multiple Indian cities share a name, the coordinates are unambiguous.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Session creation fails with "TASK3_SHEET_CSV_URL is not set" | Missing env var | Add it in Vercel Settings → Env Vars → redeploy |
| Session creation fails with "could not fetch spreadsheet" | Sheet not public or wrong URL | Check Step 4 and Step 5 |
| `_sheet_rows_loaded: 0` | CSV parsed but no rows found | Check column headers match exactly: PRN, Name, City, Latitude, Longitude |
| Students get "PRN not found in spreadsheet" | PRN coerced to integer, losing leading zeros | Re-format column A as Plain Text in Sheets |
| Many students fail temperature check | Wrong coordinates in sheet | Check the CSV output from the generator script |

