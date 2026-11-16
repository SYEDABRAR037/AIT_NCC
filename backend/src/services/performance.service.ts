export const PERFORMANCE_WEIGHTS: Record<string, number> = {
  ATTENDANCE: 20, DRILL: 15, FITNESS: 15, TRAINING: 15,
  CAMP_EVENT: 15, CERT_ACHIEVEMENT: 10, DISCIPLINE_LEADERSHIP: 10,
};

export const gradeForScore = (score: number | null): string | null => {
  if (score === null) return null;
  if (score >= 90) return 'Outstanding';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Satisfactory';
  return 'Needs Improvement';
};

export function calculatePerformance(categories: Record<string, number | null>) {
  const assessed = Object.entries(PERFORMANCE_WEIGHTS).filter(([key]) => categories[key] !== null && categories[key] !== undefined);
  const availableWeight = assessed.reduce((sum, [key]) => sum + PERFORMANCE_WEIGHTS[key], 0);
  const weighted = assessed.reduce((sum, [key]) => sum + (categories[key] as number) * PERFORMANCE_WEIGHTS[key], 0);
  const score = availableWeight ? Math.round((weighted / availableWeight) * 10) / 10 : null;
  return {
    score,
    grade: gradeForScore(score),
    completeness: availableWeight,
    categories: Object.fromEntries(Object.entries(PERFORMANCE_WEIGHTS).map(([key, weight]) => ({
      key, weight, score: categories[key] ?? null,
      contribution: categories[key] == null ? null : Math.round(((categories[key] as number) * weight / availableWeight) * 10) / 10,
      status: categories[key] == null ? 'NOT_ASSESSED' : 'ASSESSED',
    })).map(({ key, ...value }) => [key, value])),
  };
}
