import { db } from '@/lib/db'
import { forbidden, ok, serverError } from '@/lib/api'
import { requireSA } from '@/lib/session'
import { calculateMemberTotal } from '@/lib/ca3-scoring'

type MarkedSubmission = { student_id: number; task_no: number; marks_awarded: number | null; override_marks: number | null; session_id: number }
type McqAssignment = { student_id: number; is_correct: boolean | null; session_id: number }
type Ca1AssessmentPaper = { student_id: number; score: number | null; status: string; submitted_at: string | null }

export async function GET() {
  try { await requireSA() } catch { return forbidden('Super Admin access required.') }

  const [studentsResult, submissionsResult, mcqsResult, sessionsResult, membershipsResult, projectScoresResult, individualScoresResult, ca1PapersResult] = await Promise.all([
    db.from('ca1_students').select('id, prn, name').order('name'),
    db.from('ca1_submissions').select('student_id, task_no, marks_awarded, override_marks, session_id'),
    db.from('ca1_mcq_assignments').select('student_id, is_correct, session_id'),
    db.from('ca1_exam_sessions').select('id, created_at').order('created_at', { ascending: false }),
    db.from('ca1_team_members').select('student_id, team_id').is('left_at', null),
    db.from('ca1_project_scores').select('team_id, category, final_score'),
    db.from('ca1_project_individual_scores').select('team_id, student_id, final_score, student_total_override'),
    db.from('ca1_assessment_papers').select('student_id, score, status, submitted_at').eq('status', 'completed'),
  ])

  if (studentsResult.error || submissionsResult.error || mcqsResult.error || sessionsResult.error || membershipsResult.error || projectScoresResult.error || individualScoresResult.error || ca1PapersResult.error) {
    return serverError('Could not load the student overview.')
  }

  const sessionRank = new Map((sessionsResult.data ?? []).map((session, index) => [session.id, index]))
  const submissions = (submissionsResult.data ?? []) as MarkedSubmission[]
  const mcqs = (mcqsResult.data ?? []) as McqAssignment[]
  const ca1Papers = (ca1PapersResult.data ?? []) as Ca1AssessmentPaper[]
  const projectScoresByTeam = new Map<number, Array<{ category: string; marks: number | null }>>()
  for (const score of projectScoresResult.data ?? []) {
    const scores = projectScoresByTeam.get(score.team_id) ?? []
    scores.push({ category: score.category, marks: score.final_score === null ? null : Number(score.final_score) })
    projectScoresByTeam.set(score.team_id, scores)
  }
  const teamByStudent = new Map<number, number>()
  for (const membership of membershipsResult.data ?? []) teamByStudent.set(membership.student_id, membership.team_id)
  const individualScoreByStudent = new Map((individualScoresResult.data ?? []).map(score => [score.student_id, { team_id: score.team_id, contribution: score.final_score === null ? null : Number(score.final_score), total_override: score.student_total_override === null ? null : Number(score.student_total_override) }]))
  const highestContributionByTeam = new Map<number, number>()
  for (const score of individualScoresResult.data ?? []) {
    const contribution = score.final_score === null ? 0 : Number(score.final_score)
    highestContributionByTeam.set(score.team_id, Math.max(highestContributionByTeam.get(score.team_id) ?? 0, contribution))
  }

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
    const latestCa1Paper = ca1Papers
      .filter(paper => paper.student_id === student.id)
      .sort((a, b) => String(b.submitted_at ?? '').localeCompare(String(a.submitted_at ?? '')))[0]

    const teamId = teamByStudent.get(student.id)
    const teamScores = teamId === undefined ? [] : projectScoresByTeam.get(teamId) ?? []
    const individualScore = individualScoreByStudent.get(student.id)
    const hasCa3Score = teamScores.some(score => score.marks !== null) || individualScore?.contribution != null
    const calculatedCa3Marks = teamId === undefined || individualScore === undefined
      ? null
      : calculateMemberTotal(teamScores, individualScore.contribution, highestContributionByTeam.get(teamId) ?? 0)
    const ca3Marks = hasCa3Score ? (individualScore?.total_override ?? (calculatedCa3Marks == null ? null : calculatedCa3Marks + (individualScore?.contribution ?? 0))) : null

    return {
      id: student.id,
      prn: student.prn,
      name: student.name,
      ca1_marks: latestCa1Paper?.score === null || latestCa1Paper === undefined ? null : Number(latestCa1Paper.score),
      ca2_marks: sessionIds.length > 0 ? ca2Marks : null,
      ca3_marks: ca3Marks,
    }
  }))
}
