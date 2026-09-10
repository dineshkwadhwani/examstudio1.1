-- Balance MCQ answer positions without changing the meaning of any answer.
--
-- Each mapping changes only the labels on two existing options: the current
-- correct option receives target_key, and the option currently carrying
-- target_key receives the old correct key. The option text is never changed.
-- The result is exactly one A, B, C, and D correct answer in every slot.

BEGIN;

WITH answer_targets(question_id, old_key, target_key) AS (
  VALUES
    ( 3, 'B', 'C'), ( 4, 'B', 'D'),
    ( 6, 'A', 'B'), ( 7, 'A', 'C'), ( 8, 'B', 'D'),
    (11, 'B', 'C'), (12, 'B', 'D'),
    (14, 'A', 'B'), (15, 'A', 'C'), (16, 'A', 'D'),
    (18, 'A', 'B'), (19, 'A', 'C'), (20, 'A', 'D'),
    (22, 'B', 'C'), (24, 'A', 'D'),
    (27, 'A', 'C'), (28, 'A', 'D'),
    (30, 'A', 'B'), (31, 'A', 'C'), (32, 'A', 'D'),
    (34, 'A', 'B'), (35, 'A', 'C'), (36, 'A', 'D'),
    (38, 'A', 'B'), (39, 'A', 'C'), (40, 'A', 'D')
), changed AS (
  UPDATE ca1_mcq_questions AS q
  SET
    options = (
      SELECT jsonb_agg(
        CASE
          WHEN option->>'key' = targets.old_key
            THEN jsonb_set(option, '{key}', to_jsonb(targets.target_key))
          WHEN option->>'key' = targets.target_key
            THEN jsonb_set(option, '{key}', to_jsonb(targets.old_key))
          ELSE option
        END
        ORDER BY position
      )
      FROM jsonb_array_elements(q.options) WITH ORDINALITY AS items(option, position)
    ),
    correct_key = targets.target_key
  FROM answer_targets AS targets
  WHERE q.id = targets.question_id
    AND q.correct_key = targets.old_key
  RETURNING q.id
)
SELECT COUNT(*) AS changed_questions FROM changed;

COMMIT;
