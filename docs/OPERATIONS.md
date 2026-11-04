# Operations runbook

## Before an exam

1. Confirm environment variables and staff login.
2. Confirm corpus files/reference table and Task 3 sheet URL.
3. Confirm roster count and intended assessment/session.
4. Create the session and verify its frozen sheet snapshot.
5. Open registration; confirm the student dashboard lists the open session.
6. Start the session only after the cohort is ready.

## During CA1/CA2

- Monitor the SA dashboard and session stats.
- Students must have a student account and explicit session registration.
- A student cannot take a session twice because paper/assignment/submission keys are session-scoped and unique.
- Do not delete or recreate sessions to fix a single student; inspect the student/session rows first.

## Closing and results

1. Close the session.
2. Allow the post-exam verification delay for Apify runs.
3. Resolve pending/deferred verification or record exceptions.
4. Run reports only after the session is closed/archived.
5. Release results explicitly.

## CA3 evaluation

1. Ensure the project artifact is Submitted or Presented. The Super Admin can use Present to normalize a missed student submission.
2. Run GitHub analysis after confirming public/reachable repository and exact usernames.
3. Inspect raw counts for zero/missing members; rerun after correcting IDs.
4. Run category evaluations from Evaluate, respecting 60-second spacing and status filters.
5. Review AI suggestions and evidence; enter final scores/notes.
6. Save Scores whenever scores change. Evaluation Complete is a workflow marker and can be re-clicked after score edits.
7. Use Insights to find missing evaluations, evaluated-zero items, missing usernames, and username-with-zero-score cases.
8. Verify the Results table and publication setting before student visibility.

## GitHub zero-score triage

Check, in order:

1. Team artifact repository URL is correct and accessible.
2. Member has a non-empty exact GitHub username.
3. The username is not duplicated between active members.
4. Commit author/committer login matches, or commit metadata name matches the registered roster name.
5. Activity exists on a visible branch; the analyzer checks default, submitted hint, and visible branches but is limited to API pagination caps.
6. Rerun Analyze GitHub and inspect stored raw stats.
7. Apply a manual score only when evidence supports it, documenting the reason.

## Common errors

- `DOMMatrix is not defined`: current server evaluation installs a minimal fallback before `pdf-parse`; check `lib/ca3-ai-evaluation.ts` and rebuild.
- `The team must submit its artifacts`: check artifact status; current automated evaluation accepts Submitted, Presented, and Evaluation Complete.
- `23514 total_override`: member totals are capped at 45 by migrations 030/031.
- `23514 evaluation_status`: do not re-run migration 034; it may already be applied. Use the current evaluation endpoint/schema.
- Hydration warning with `data-new-gr-c-s-check-loaded`: usually a browser extension (Grammarly-like) mutating `<body>` before hydration; test incognito/extension-disabled.
