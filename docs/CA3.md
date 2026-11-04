# CA3 teams and evaluation

## Rubric

| Category | Maximum | Mode |
|---|---:|---|
| Multi-Agent Architecture & Agentic Design | 8 | Groq suggestion + human confirmation |
| Design | 8 | Groq suggestion + human confirmation |
| Live Demo | 6 | Manual |
| Project Presentation | 8 | Manual |
| Documentation | 5 | Groq suggestion + human confirmation |
| Code Review & Engineering Practice | 5 | Groq suggestion + human confirmation |
| Project total | 40 | Shared before contribution allocation |
| Individual contribution | 5 | GitHub score + human override |
| Member maximum | 45 | Project marks + contribution |

The differential categories are Multi-Agent Design, Design, and Documentation. A member’s contribution score scales that member’s share of the team’s awarded 21 marks in those three categories. Live Demo, Presentation, and Code Review remain shared team marks. The implementation is in `lib/ca3-scoring.ts`; the rubric is in `lib/ca3-rubric.ts`.

## Team/artifact lifecycle

Teams can be draft, pending approval, approved, or rejected. Artifacts are separate and normally move:

`draft → submitted → presented → evaluation_complete`.

The Super Admin can mark Presented even for incomplete student submission; the server first fills/submits the artifact in the same action and then marks it Presented. Presented and Evaluation Complete lock student artifact edits. Evaluation Complete requires Presented. Scores can still be edited and saved after completion; completion is a workflow marker, not a score lock.

Other artifact statuses accepted by the database include `locked` for historical final locking. Results publication is controlled by `ca1_ca3_config`.

## Artifact fields and storage

Artifacts include synopsis, design document, input/output definitions, repository URL, project URL, execution trace, demo video URL, presentation date, category scores, evaluator notes, AI feedback, contribution scores, and evaluation metadata. Synopsis/design PDFs are stored in the private `ca3-artifacts` bucket and read through authenticated signed file routes.

## GitHub analysis

`lib/github-analysis.ts`:

- Parses `github.com/owner/repo` and optional `/tree/branch` URLs.
- Loads the repository default branch, the submitted branch hint, and all visible branches.
- Deduplicates commits by SHA.
- Attributes commits by GitHub login, with normalized commit author/committer name fallback when the GitHub API login is absent.
- Calculates commits, active days, additions/deletions, pull requests, reviews/comments, files owned, and authoring.
- Saves raw stats in `ca1_github_contribution_stats` and system score in `ca1_project_individual_scores`.

Current weights total 100%:

`commits 25% · active days 10% · changes 10% · PRs 10% · reviews/comments 10% · files owned 25% · authoring 10%`.

The analysis is evidence-based, not proof of intent. Wrong usernames, unlinked commit emails, private/unreachable repositories, pagination limits, or activity beyond the visible API window can produce zero/low values. Always inspect raw stats and the repository history before a manual override.

## Groq evaluation

`lib/ca3-ai-evaluation.ts` extracts PDFs and repository snapshots, builds a category-specific rubric prompt, requests JSON from Groq, clamps scores to category maximums, and stores evaluator-facing feedback. It installs a minimal server `DOMMatrix` fallback before importing `pdf-parse` to avoid the server-side DOMMatrix error.

Automated categories are Multi-Agent Design, Design, Documentation, and Code Review. Batch actions are exposed through the Evaluate tab with Submitted, Presented, Evaluation Complete, or All status selection, skip-already-evaluated behavior, optional Re-evaluate, 60-second spacing, rate-limit retries, and visible logs.

## Super Admin pages

- `/sa/projects` — CA3 tabs: Teams, CA3 Projects, Evaluate, Results, Insights, Schedule.
- `/sa/teams/[id]/artifacts` — individual review, GitHub analysis, category scoring, contribution scores, Save Scores, Evaluation Complete.
- `/sa/ca3-results` — per-student alphabetic results, filters, export, status tiles.
- `/sa/teams`, `/sa/schedule`, `/sa/dashboard` — team, date, and dashboard operations.
- `/sa/projects` Insights — projects not evaluated, partial evaluation, evaluated-zero items, missing GitHub IDs, and GitHub ID with zero score; cards link to review.
