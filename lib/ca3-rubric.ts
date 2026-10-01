export const CA3_RUBRIC = [
  { category: 'multi_agent_design', label: 'Multi-Agent Architecture & Agentic Design', maxMarks: 8, mode: 'system-assisted' },
  { category: 'design', label: 'Design', maxMarks: 8, mode: 'system-assisted' },
  { category: 'live_demo', label: 'Live Demo', maxMarks: 6, mode: 'manual' },
  { category: 'presentation', label: 'Project Presentation', maxMarks: 8, mode: 'manual' },
  { category: 'documentation', label: 'Documentation', maxMarks: 5, mode: 'system-assisted' },
  { category: 'code_review', label: 'Code Review & Engineering Practice', maxMarks: 5, mode: 'system-assisted' },
] as const

export const CA3_INDIVIDUAL_MAX_MARKS = 5
export type CA3Category = typeof CA3_RUBRIC[number]['category']

export function rubricCategory(category: string) {
  return CA3_RUBRIC.find(item => item.category === category)
}
