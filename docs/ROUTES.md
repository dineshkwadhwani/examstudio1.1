# Pages and API routes

## Student pages

| Page | Purpose |
|---|---|
| `/login`, `/register`, `/change-password` | Authentication and password lifecycle. |
| `/dashboard` | Current exam/session, key, MCQ/task status, registration options. |
| `/mcq` | Per-click MCQ answer saving. |
| `/my-exams` | Registered/completed session history. |
| `/assessments`, `/assessments/[id]` | Merged CA1 assessment list and paper view. |
| `/results` | Original practical exam result/debrief after release. |
| `/profile` | Safe student profile fields. |
| `/team` | Student team membership and project access. |
| `/project`, `/project/guidelines`, `/project/artifacts`, `/project/results` | CA3 project workflow, guidance, artifact submission, and published results. |

## Super Admin/staff pages

| Page | Purpose |
|---|---|
| `/sa/login` | Staff login. |
| `/sa/dashboard` | CA1 live board and CA3 summary tiles. |
| `/sa/session` | Session list/configuration/reference data. |
| `/sa/students`, `/sa/students/[id]` | Student list/detail, reports, overrides, exceptions. |
| `/sa/flags` | Integrity flag resolution. |
| `/sa/assessments`, `/sa/assessments/[id]`, `/sa/assessments/results` | Legacy/merged assessment administration. |
| `/sa/ca1` and children | CA1 assessment/cohort/students/results administration. |
| `/sa/teams`, `/sa/teams/[id]`, `/sa/teams/[id]/artifacts` | CA3 team approval/editing and individual review. |
| `/sa/projects` | CA3 tabs: Teams, projects, Evaluate, Results, Insights, Schedule. |
| `/sa/ca3-results` | Per-student CA3 result table/export/status filters. |
| `/sa/schedule` | Presentation schedule. |
| `/sa/student-overview` | Cross-assessment student overview. |

## API groups

### Authentication and student cookie APIs

`/api/auth/register`, `/login`, `/logout`, `/change-password`; `/api/me/profile`, `/status`, `/exams`, `/exam-registrations`, `/assessments`, `/assessments/[id]`, `/paper`, `/mcq`, `/keys`, `/task1`, `/submit-test`, `/team`, `/artifacts`, `/artifacts/submit`, `/artifacts/upload`, `/artifacts/presentation-date`, `/ca3-results`.

### Exam API-key APIs

`/api/v1/paper`, `/api/v1/status`, `/api/v1/submit/task1`, `/task2`, `/task3`. These use `X-API-Key` and are constrained by session state and key ownership.

### Staff/Super Admin APIs

`/api/sa/session`, `/session/stats`, `/students`, `/students/delete`, `/roster`, `/flags`, `/override`, `/student-overview`, `/schedule`, `/teams`, `/teams/[id]`, `/projects`, `/projects/[teamId]`, `/ca3-stats`, `/ca3-results`, `/ca3-insights`, `/assessments`, `/assessments/[id]`, `/assessments/[id]/questions`, `/assessment-assignments`, `/assessment-cohorts`, `/assessment-cohorts/[id]`, `/assessment-cohorts/[id]/import`, `/assessment-cohorts/[id]/template`, `/assessment-results`, and `/assessment-results/[id]`.

Staff route authorization is per handler. Team/evaluation mutation routes require Super Admin; roster/student/flags/session routes may allow staff/invigilator according to the handler.

### Scheduled route

`GET /api/cron/verify` closes elapsed sessions and runs due verification. Protect it with the configured deployment secret and monitor failures.
