# Task solution workspace

This folder holds our task solutions and Apify actors. We will implement and run one task at a time.

## Structure

- `actors/task-1/`: Task 1 solution and run instructions.
- `actors/task-2/`: Task 2 actor and run instructions.
- `actors/task-3/`: Task 3 actor and run instructions.
- `output/`: Local run results, submission responses, and verification results (ignored by Git).

Each task folder will contain its source, dependencies, input example, and instructions when we implement that task. Use an actor only where the task requires one.

## Workflow

1. Read the task and its assigned inputs.
2. Implement the solution in the corresponding task folder.
3. Run it and inspect the computed answer.
4. Submit the required payload to the exam endpoint when requested.
5. Save the response and check verification status; an accepted submission may still need verification.

Keep credentials in local environment variables, never in actor source or committed input examples. Do not copy the application's server secrets into actors.

The existing `tests/` directory contains application regression tests; this `test/` directory is for task solutions.
