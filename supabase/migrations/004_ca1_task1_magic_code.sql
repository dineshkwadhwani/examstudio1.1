-- ============================================================
-- Migration 004: Task 1 redesign — magic code + mark changes
-- Run AFTER 001, 002, 003
-- ============================================================

-- ─── Update task marks ───────────────────────────────────────
-- Task 1: 2 → 1 mark
UPDATE ca1_exam_tasks
SET marks = 1
WHERE task_no = 1
AND exam_id = (SELECT id FROM ca1_exam_definitions WHERE code = 'F0003-CA1-2026');

-- Task 2: 3 → 4 marks
UPDATE ca1_exam_tasks
SET marks = 4
WHERE task_no = 2
AND exam_id = (SELECT id FROM ca1_exam_definitions WHERE code = 'F0003-CA1-2026');

-- ─── Update Task 1 components ────────────────────────────────
-- Remove old paper_fetch gate component
DELETE FROM ca1_task_components
WHERE task_id = (
  SELECT t.id FROM ca1_exam_tasks t
  JOIN ca1_exam_definitions d ON t.exam_id = d.id
  WHERE d.code = 'F0003-CA1-2026' AND t.task_no = 1
);

-- Add magic code component (1 mark)
INSERT INTO ca1_task_components (task_id, code, description, marks, grading_rule)
SELECT t.id, 'magic_code', 'Student selects correct magic colour from paper response', 1, 'exact'
FROM ca1_exam_tasks t
JOIN ca1_exam_definitions d ON t.exam_id = d.id
WHERE d.code = 'F0003-CA1-2026' AND t.task_no = 1;

-- ─── Update Task 2 components ────────────────────────────────
UPDATE ca1_task_components
SET marks = 1.5
WHERE code = 'count_total'
AND task_id = (
  SELECT t.id FROM ca1_exam_tasks t
  JOIN ca1_exam_definitions d ON t.exam_id = d.id
  WHERE d.code = 'F0003-CA1-2026' AND t.task_no = 2
);

UPDATE ca1_task_components
SET marks = 1.5
WHERE code = 'count_scoped'
AND task_id = (
  SELECT t.id FROM ca1_exam_tasks t
  JOIN ca1_exam_definitions d ON t.exam_id = d.id
  WHERE d.code = 'F0003-CA1-2026' AND t.task_no = 2
);

UPDATE ca1_task_components
SET marks = 1.0
WHERE code = 'apify_run'
AND task_id = (
  SELECT t.id FROM ca1_exam_tasks t
  JOIN ca1_exam_definitions d ON t.exam_id = d.id
  WHERE d.code = 'F0003-CA1-2026' AND t.task_no = 2
);

-- ─── Update total marks ───────────────────────────────────────
UPDATE ca1_exam_definitions
SET total_marks = 15
WHERE code = 'F0003-CA1-2026';

-- ─── Add magic_code to question papers ───────────────────────
ALTER TABLE ca1_question_papers
  ADD COLUMN IF NOT EXISTS magic_code TEXT NOT NULL DEFAULT 'Blue';

-- ─── Add magic_code submission to ca1_submissions ────────────
-- Task 1 submissions now store the selected colour
-- No schema change needed — payload JSONB handles it
