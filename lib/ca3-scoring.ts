import { CA3_RUBRIC } from '@/lib/ca3-rubric'

export const CA3_DIFFERENTIAL_CATEGORIES = ['multi_agent_design', 'design', 'documentation'] as const
export const CA3_PROJECT_MAX_MARKS = CA3_RUBRIC.reduce((total, rubric) => total + rubric.maxMarks, 0)
export const CA3_PER_STUDENT_MAX_MARKS = CA3_PROJECT_MAX_MARKS + 5

export function isDifferentialCategory(category: string) {
  return (CA3_DIFFERENTIAL_CATEGORIES as readonly string[]).includes(category)
}

export function calculateMemberCategoryMarks(category: string, teamScore: number, contributionScore: number | null | undefined, highestContribution: number) {
  if (!isDifferentialCategory(category)) return teamScore
  if (highestContribution <= 0) return 0
  return teamScore * (contributionScore ?? 0) / highestContribution
}

export function calculateMemberTotal(scores: Array<{ category: string; marks: number | null | undefined }>, contributionScore: number | null | undefined, highestContribution: number) {
  return scores.reduce((total, score) => total + calculateMemberCategoryMarks(score.category, score.marks ?? 0, contributionScore, highestContribution), 0)
}
