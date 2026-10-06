import { db } from '@/lib/db'
import { forbidden, ok, serverError } from '@/lib/api'
import { requireSA } from '@/lib/session'

type MarkedSubmission = { student_id: number; task_no: number; marks_awarded: number | null; override_marks: number | null; session_id: number }
type McqAssignment = { student_id: number; is_correct: boolean | null; session_id: number }

export async function GET() {
  try { await requireSA() } catch { return forbidden('Super Admin access required.') }

  const [studentsResult, submissionsResult, mcqsResult, sessionsResult, membershipsResult, projectScoresResult, individualScoresResult] = await Promise.all([
    db.from('ca1_students').select('id, prn, name').order('name'),
    db.from('ca1_submissions').select('student_id, task_no, marks_awarded, override_marks, session_id'),
    db.from('ca1_mcq_assignments').select('student_id, is_correct, session_id'),
    db.from('ca1_exam_sessions').select('id, created_at').order('created_at', { ascending: false }),
    db.from('ca1_team_members').select('student_id, team_id').is('left_at', null),
    db.from('ca1_project_scores').select('team_id, final_score'),
    db.from('ca1_project_individual_scores').select('student_id, final_score'),
  ])

  if (studentsResult.error || submissionsResult.error || mcqsResult.error || sessionsResult.error || membershipsResult.error || projectScoresResult.error || individualScoresResult.error) {
    return serverError('Could not load the student overview.')
  }

  const sessionRank = new Map((sessionsResult.data ?? []).map((session, index) => [session.id, index]))
  const submissions = (submissionsResult.data ?? []) as MarkedSubmission[]
  const mcqs = (mcqsResult.data ?? []) as McqAssignment[]
  const projectScoresByTeam = new Map<number, Array<number | null>>()
  for (const score of projectScoresResult.data ?? []) {
    const scores = projectScoresByTeam.get(score.team_id) ?? []
    scores.push(score.final_score === null ? null : Number(score.final_score))
    projectScoresByTeam.set(score.team_id, scores)
  }
  const teamByStudent = new Map<number, number>()
  for (const membership of membershipsResult.data ?? []) teamByStudent.set(membership.student_id, membership.team_id)
  const individualScoreByStudent = new Map((individualScoresResult.data ?? []).map(score => [score.student_id, score.final_score === null ? null : Number(score.final_score)]))

  return ok((studentsResult.data ?? []).map(student => {
    const studentSubmissions = submissions.filter(submission => submission.student_id === student.id)
    const studentMcqs = mcqs.filter(assignment => assignment.student_id === student.id)
    const sessionIds = [...new Set([
      ...studentSubmissions.map(submission => submission.session_id),
      ...studentMcqs.map(assignment => assignment.session_id),
    ])].sort((a, b) => (sessionRank.get(a) ?? Number.MAX_SAFE_INTEGER) - (sessionRank.get(b) ?? Number.MAX_SAFE_INTEGER))
    const latestSessionId = sessionIds[0]
    const ca2Submissions = studentSubmissions.filter(submission => submission.session_id === latestSessionId)
    const ca2Mcqs = studentMcqs.filter(assignment => assignment.session_id === latestSessionId)
    const ca2Marks = ca2Mcqs.filter(assignment => assignment.is_correct).length * 0.5 + ca2Submissions.reduce((total, submission) => total + (submission.override_marks ?? submission.marks_awarded ?? 0), 0)

    const teamId = teamByStudent.get(student.id)
    const teamScores = teamId === undefined ? [] : projectScoresByTeam.get(teamId) ?? []
    const individualScore = individualScoreByStudent.get(student.id)
    const hasCa3Score = teamScores.some(score => score !== null) || individualScore !== undefined && individualScore !== null
    const ca3Marks = hasCa3Score
      ? teamScores.reduce<number>((total, score) => total + (score ?? 0), 0) + (individualScore ?? 0)
      : null

    return {
      id: student.id,
      prn: student.prn,
      name: student.name,
      ca2_marks: sessionIds.length > 0 ? ca2Marks : null,
      ca3_marks: ca3Marks,
    }
  }))
}
