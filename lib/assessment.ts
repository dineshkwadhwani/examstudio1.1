import { db } from './db'
import type { Ca1Assessment, Ca1AssessmentPaper, AssessmentType } from './types'

type QuestionRow = {
  id: number
  co: string | null
  question_order: number
}

export function assessmentType(value: unknown): AssessmentType {
  return value === 'subjective' || value === 'subjective_online' ? value : 'mcq'
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

export function generateAssessmentPaper(questions: QuestionRow[], total: number) {
  const groups = new Map<string, QuestionRow[]>()
  for (const question of questions) {
    const key = question.co?.trim() || 'DEFAULT'
    groups.set(key, [...(groups.get(key) ?? []), question])
  }

  const keys = [...groups.keys()]
  const selected: QuestionRow[] = []
  if (keys.length) {
    const perGroup = Math.floor(total / keys.length)
    const remainder = total % keys.length
    keys.forEach((key, index) => {
      selected.push(...shuffle(groups.get(key) ?? []).slice(0, perGroup + (index < remainder ? 1 : 0)))
    })
  }

  if (selected.length < total) {
    const selectedIds = new Set(selected.map(question => question.id))
    selected.push(...shuffle(questions.filter(question => !selectedIds.has(question.id))).slice(0, total - selected.length))
  }

  return shuffle(selected).slice(0, total)
}

export async function getStudentAssessmentPapers(studentId: number) {
  const { data, error } = await db
    .from('ca1_assessment_papers')
    .select('id, assessment_id, student_id, started_at, submitted_at, score, status, created_at, ca1_assessments(*)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    ...row,
    assessment: Array.isArray(row.ca1_assessments) ? row.ca1_assessments[0] : row.ca1_assessments,
    ca1_assessments: undefined,
  })) as unknown as Ca1AssessmentPaper[]
}

export async function getAssessment(id: number) {
  const { data, error } = await db.from('ca1_assessments').select('*').eq('id', id).single()
  if (error) throw error
  return data as Ca1Assessment
}

export async function getAssessmentPaper(id: number, studentId?: number) {
  let query = db
    .from('ca1_assessment_papers')
    .select('*, ca1_assessments(*)')
    .eq('id', id)
  if (studentId !== undefined) query = query.eq('student_id', studentId)
  const { data: paper, error } = await query.single()
  if (error || !paper) return null

  const { data: questions, error: questionError } = await db
    .from('ca1_assessment_paper_questions')
    .select('*, ca1_assessment_questions(*)')
    .eq('paper_id', id)
    .order('question_order')
  if (questionError) throw questionError

  return {
    paper: { ...paper, assessment: Array.isArray(paper.ca1_assessments) ? paper.ca1_assessments[0] : paper.ca1_assessments },
    questions: (questions ?? []).map(row => ({ ...row, question: row.ca1_assessment_questions })),
  }
}

export async function createPaperForStudent(
  assessmentId: number,
  assignmentId: number,
  studentId: number,
) {
  const { data: existing } = await db
    .from('ca1_assessment_papers')
    .select('id')
    .eq('assessment_id', assessmentId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (existing) return existing.id as number

  const { data: assessment, error: assessmentError } = await db
    .from('ca1_assessments')
    .select('total_questions')
    .eq('id', assessmentId)
    .single()
  if (assessmentError || !assessment) throw assessmentError ?? new Error('Assessment not found')

  const { data: questions, error: questionError } = await db
    .from('ca1_assessment_questions')
    .select('id, co, question_order')
    .eq('assessment_id', assessmentId)
  if (questionError) throw questionError
  if ((questions ?? []).length < assessment.total_questions) {
    throw new Error(`Not enough questions. Need ${assessment.total_questions}, have ${questions?.length ?? 0}.`)
  }

  const selected = generateAssessmentPaper(questions as QuestionRow[], assessment.total_questions)
  const { data: paper, error: paperError } = await db
    .from('ca1_assessment_papers')
    .insert({ assessment_id: assessmentId, assignment_id: assignmentId, student_id: studentId })
    .select('id')
    .single()
  if (paperError || !paper) throw paperError ?? new Error('Could not create assessment paper')

  const { error: insertError } = await db.from('ca1_assessment_paper_questions').insert(
    selected.map((question, index) => ({
      paper_id: paper.id,
      question_id: question.id,
      question_order: index + 1,
    })),
  )
  if (insertError) throw insertError
  return paper.id as number
}

export async function evaluateSubjectivePaper(paperId: number) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured.')
  const { data: rows, error } = await db.from('ca1_assessment_paper_questions')
    .select('id, answer_text, ca1_assessment_questions(question_text, model_answer, max_marks)')
    .eq('paper_id', paperId)
    .order('question_order')
  if (error) throw error

  let score = 0
  for (const row of rows ?? []) {
    const question = Array.isArray(row.ca1_assessment_questions) ? row.ca1_assessment_questions[0] : row.ca1_assessment_questions
    if (!question) continue
    await db.from('ca1_assessment_paper_questions').update({ evaluation_status: 'processing' }).eq('id', row.id)
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Evaluate the student answer against the model answer. Return only JSON: {"marks_awarded": number, "feedback": string}. Marks must be between 0 and max_marks.' },
            { role: 'user', content: JSON.stringify({ question: question.question_text, model_answer: question.model_answer, student_answer: row.answer_text ?? '', max_marks: question.max_marks }) },
          ],
        }),
      })
      if (!response.ok) throw new Error(`AI evaluation failed with status ${response.status}.`)
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
      const result = JSON.parse(payload.choices?.[0]?.message?.content ?? '{}') as { marks_awarded?: number; feedback?: string }
      const maxMarks = Number(question.max_marks ?? 0)
      const marks = Math.min(maxMarks, Math.max(0, Number(result.marks_awarded ?? 0)))
      score += marks
      await db.from('ca1_assessment_paper_questions').update({ marks_awarded: marks, evaluation_feedback: result.feedback ?? '', evaluation_status: 'completed' }).eq('id', row.id)
    } catch (evaluationError) {
      await db.from('ca1_assessment_paper_questions').update({ marks_awarded: 0, evaluation_feedback: evaluationError instanceof Error ? evaluationError.message : 'Evaluation failed.', evaluation_status: 'failed' }).eq('id', row.id)
      throw evaluationError
    }
  }
  return score
}
