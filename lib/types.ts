// ─── Session ──────────────────────────────────────────────────
export type SessionStatus = 'setup' | 'registration_open' | 'running' | 'closed' | 'archived'

export interface ExamSession {
  id: number
  exam_id: number
  label: string
  status: SessionStatus
  started_at: string | null
  ends_at: string | null
  closed_at: string | null
  sheet_csv_url: string
  sheet_snapshot: Record<string, SheetRow>
  sheet_hash: string
  relax_apify_verification: boolean
  created_at: string
  // Joined from ca1_exam_definitions when needed
  exam?: ExamDefinition
}

export interface ExamDefinition {
  id: number
  code: string
  title: string
  course_code: string
  total_marks: number
  duration_minutes: number
  mcq_count: number
  mcq_marks_each: number
  email_domain: string
  corpus_path: string
  corpus_hash: string
  corpus_manifest: CorpusManifest[]
  corpus_reference_table: ReferenceTable
  created_at: string
}

export interface CorpusManifest {
  filename: string
  url: string
  hash: string
  page_no: number
}

export interface ReferenceTable {
  [word: string]: {
    total: number
    pages: Record<number, number>  // page_no -> count
  }
}

export interface SheetRow {
  prn: string
  name: string
  city: string
  lat: number
  lon: number
}

// ─── Student ──────────────────────────────────────────────────
export interface Student {
  id: number
  prn: string
  name: string
  email: string
  phone: string
  must_change_password: boolean
  last_login_at: string | null
  registered_at: string
}

// ─── API Key ──────────────────────────────────────────────────
export interface ApiKey {
  id: number
  student_id: number
  key_prefix: string
  created_at: string
  revoked: boolean
}

// ─── Question Paper ───────────────────────────────────────────
export interface QuestionPaper {
  id: number
  student_id: number
  session_id: number
  seed: string
  first_fetched_at: string
  last_fetched_at: string
  fetch_count: number
  t2_target_word: string
  t2_scoped_page: number
  t2_expected_total: number
  t2_expected_scoped: number
  t3_city: string
  t3_lat: number
  t3_lon: number
  magic_code: string
  rendered_paper: RenderedPaper
}

export interface RenderedPaper {
  prn: string
  name: string
  issued_at: string
  exam_ends_at: string
  magic_code: string
  task2: {
    corpus_index_url: string
    target_word: string
    scoped_page: number
    submit_endpoint: string
  }
  task3: {
    sheet_csv_url: string
    submit_endpoint: string
  }
}

// ─── MCQ ──────────────────────────────────────────────────────
export interface McqOption {
  key: string
  text: string
}

export interface McqQuestion {
  id: number
  slot_id: number
  stem: string
  options: McqOption[]
  correct_key: string
  rationale: string
  active: boolean
}

export interface McqAssignment {
  id: number
  student_id: number
  slot_no: number
  question_id: number
  option_order: string[]
  answered_key: string | null
  answered_at: string | null
  first_answered_at: string | null
  change_count: number
  answer_history: { key: string; at: string }[]
  is_correct: boolean | null
}

export interface McqSlot {
  id: number
  slot_no: number
  concept: string
  co_code: string
  bloom_level: number
  bloom_label: string
}

// ─── Submission ───────────────────────────────────────────────
export type VerificationStatus = 'pending' | 'verified' | 'failed' | 'flagged' | 'deferred'

export interface Submission {
  id: number
  student_id: number
  task_no: number
  payload: Record<string, unknown>
  submitted_at: string
  first_submitted_at: string
  attempt_count: number
  submitted_run_id: string | null
  submitted_actor_id: string | null
  submitted_actor_url: string | null
  apify_user_id: string | null
  apify_run_status: string | null
  apify_finished_at: string | null
  apify_dataset_items: unknown
  raw_apify_response: unknown
  source_snapshot: string | null
  source_fetched_at: string | null
  key_hardcoded: boolean | null
  server_reference: unknown
  verification_status: VerificationStatus
  marks_awarded: number | null
  grading_detail: Record<string, unknown> | null
  override_marks: number | null
  override_reason: string | null
  override_by: string | null
  override_at: string | null
}

// ─── Staff ────────────────────────────────────────────────────
export interface Staff {
  id: number
  email: string
  name: string
  role: 'sa' | 'invigilator'
  active: boolean
}

// ─── Flag ─────────────────────────────────────────────────────
export interface Flag {
  id: number
  session_id: number | null
  reason: string
  severity: 'info' | 'review' | 'serious'
  student_ids: number[]
  detail: Record<string, unknown>
  resolved: boolean
  resolution: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

// ─── Auth session payload ─────────────────────────────────────
export interface StudentSession {
  type: 'student'
  id: number
  prn: string
  name: string
  email: string
  must_change_password: boolean
}

export interface StaffSession {
  type: 'staff'
  id: number
  email: string
  name: string
  role: 'sa' | 'invigilator'
}

export type AppSession = StudentSession | StaffSession

// ─── API response helpers ─────────────────────────────────────
export interface ApiError {
  error: string
  message: string
}

export interface Task2Payload {
  count_total: number
  count_scoped: number
  actor_id: string
  run_id: string
  actor_url: string
}

export interface Task3Payload {
  city: string
  temperature_c: number
  actor_id: string
  run_id: string
  actor_url: string
}

// ─── SA dashboard ─────────────────────────────────────────────
export interface LiveBoardStats {
  registered: number
  mcq_complete: number
  papers_fetched: number
  task1_submitted: number
  task2_submitted: number
  task3_submitted: number
  verification_pending: number
  flags_open: number
  seconds_remaining: number | null
}

export interface StudentListRow {
  id: number
  prn: string
  name: string
  email: string
  phone: string
  registered_at: string
  has_key: boolean
  mcq_answered: number
  paper_fetched: boolean
  task1_status: VerificationStatus | null
  task1_marks: number | null
  task2_status: VerificationStatus | null
  task2_marks: number | null
  task3_status: VerificationStatus | null
  task3_marks: number | null
  total_marks: number | null
  flag_count: number
}
