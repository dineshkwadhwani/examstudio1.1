import { db } from './db'

const GITHUB_API = 'https://api.github.com'
const MAX_COMMITS_PER_MEMBER = 100
const WEIGHTS = {
  commits: 25,
  activeDays: 25,
  changes: 10,
  pullRequests: 15,
  reviews: 15,
  filesOwned: 10,
} as const

type GithubCommit = { sha: string; commit?: { author?: { date?: string } } }
type GithubCommitDetail = { sha: string; stats?: { additions?: number; deletions?: number }; files?: Array<{ filename: string }> }
type GithubPullRequest = { user?: { login?: string }; merged_at?: string | null }
type GithubReview = { user?: { login?: string }; body?: string | null }
type MemberActivity = {
  student_id: number; github_username: string; commit_count: number; additions: number; deletions: number;
  active_days: Set<string>; first_commit_at: string | null; last_commit_at: string | null; prs_opened: number;
  prs_reviewed: number; review_comments: number; files: Set<string>
}

async function github<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_ANALYSIS_TOKEN
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  })
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) throw new Error('GITHUB_RATE_LIMIT')
    if (response.status === 404) throw new Error('GITHUB_REPOSITORY_NOT_FOUND')
    throw new Error('GITHUB_API_ERROR')
  }
  return response.json() as Promise<T>
}

function parseRepository(value: string) {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('GITHUB_URL_INVALID') }
  if (url.hostname.toLowerCase() !== 'github.com') throw new Error('GITHUB_URL_INVALID')
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 2) throw new Error('GITHUB_URL_INVALID')
  return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') }
}

function ratio(value: number, maximum: number) {
  return maximum > 0 ? value / maximum : 0
}

export async function analyzeGithubTeam(teamId: number, repositoryUrl: string, members: Array<{ student_id: number; github_username: string }>) {
  const { owner, repo } = parseRepository(repositoryUrl)
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  const perMember = new Map<string, MemberActivity>()

  for (const member of members) {
    const username = member.github_username.trim()
    const commits = await github<GithubCommit[]>(`${base}/commits?author=${encodeURIComponent(username)}&per_page=${MAX_COMMITS_PER_MEMBER}`)
    const activity = { student_id: member.student_id, github_username: username, commit_count: commits.length, additions: 0, deletions: 0, active_days: new Set<string>(), first_commit_at: null as string | null, last_commit_at: null as string | null, prs_opened: 0, prs_reviewed: 0, review_comments: 0, files: new Set<string>() }
    for (const commit of commits) {
      const timestamp = commit.commit?.author?.date ?? null
      if (timestamp) {
        activity.active_days.add(timestamp.slice(0, 10))
        if (!activity.first_commit_at || timestamp < activity.first_commit_at) activity.first_commit_at = timestamp
        if (!activity.last_commit_at || timestamp > activity.last_commit_at) activity.last_commit_at = timestamp
      }
      const detail = await github<GithubCommitDetail>(`${base}/commits/${commit.sha}`)
      activity.additions += detail.stats?.additions ?? 0
      activity.deletions += detail.stats?.deletions ?? 0
      for (const file of detail.files ?? []) activity.files.add(file.filename)
    }
    const pullRequests = await github<GithubPullRequest[]>(`${base}/pulls?state=all&per_page=100`)
    activity.prs_opened = pullRequests.filter(pull => pull.user?.login?.toLowerCase() === username.toLowerCase()).length
    for (const pull of pullRequests.slice(0, 100)) {
      const number = (pull as GithubPullRequest & { number?: number }).number
      if (!number) continue
      const reviews = await github<GithubReview[]>(`${base}/pulls/${number}/reviews?per_page=100`)
      const authoredReviews = reviews.filter(review => review.user?.login?.toLowerCase() === username.toLowerCase())
      activity.prs_reviewed += authoredReviews.length > 0 ? 1 : 0
      activity.review_comments += authoredReviews.filter(review => Boolean(review.body?.trim())).length
    }
    perMember.set(username.toLowerCase(), activity)
  }

  const fileOwners = new Map<string, Set<string>>()
  for (const [username, activity] of perMember) for (const file of activity.files) {
    const owners = fileOwners.get(file) ?? new Set<string>()
    owners.add(username)
    fileOwners.set(file, owners)
  }
  const stats = [...perMember.values()].map(activity => ({
    ...activity,
    files_owned: [...activity.files].filter(file => fileOwners.get(file)?.size === 1).length,
  }))
  const max = (key: 'commit_count' | 'active_days' | 'additions' | 'deletions' | 'prs_opened' | 'prs_reviewed' | 'review_comments' | 'files_owned') => Math.max(...stats.map(stat => key === 'active_days' ? stat.active_days.size : Number(stat[key])), 0)
  const result = stats.map(stat => {
    const changes = stat.additions + stat.deletions
    const maxChanges = Math.max(...stats.map(item => item.additions + item.deletions), 0)
    const weighted = ratio(stat.commit_count, max('commit_count')) * WEIGHTS.commits
      + ratio(stat.active_days.size, max('active_days')) * WEIGHTS.activeDays
      + ratio(changes, maxChanges) * WEIGHTS.changes
      + ratio(stat.prs_opened, max('prs_opened')) * WEIGHTS.pullRequests
      + ratio(stat.prs_reviewed + stat.review_comments, max('prs_reviewed') + max('review_comments')) * WEIGHTS.reviews
      + ratio(stat.files_owned, max('files_owned')) * WEIGHTS.filesOwned
    return { ...stat, contribution_percentage: weighted, system_score: Math.round((weighted / 100 * 5) * 100) / 100 }
  })

  for (const stat of result) {
    await db.from('ca1_github_contribution_stats').upsert({ team_id: teamId, student_id: stat.student_id, github_username: stat.github_username, commit_count: stat.commit_count, additions: stat.additions, deletions: stat.deletions, active_days: stat.active_days.size, first_commit_at: stat.first_commit_at, last_commit_at: stat.last_commit_at, prs_opened: stat.prs_opened, prs_reviewed: stat.prs_reviewed, review_comments: stat.review_comments, files_owned: stat.files_owned, contribution_percentage: stat.contribution_percentage, computed_at: new Date().toISOString() }, { onConflict: 'team_id,student_id' })
    await db.from('ca1_project_individual_scores').upsert({ team_id: teamId, student_id: stat.student_id, max_marks: 5, system_score: stat.system_score, updated_at: new Date().toISOString() }, { onConflict: 'team_id,student_id' })
  }
  return { repository: `${owner}/${repo}`, weights: WEIGHTS, members: result.map(stat => ({ ...stat, active_days: stat.active_days.size, files: undefined })) }
}
