export interface DrillInstructorPlatoonAssignment {
  platoon: { name: string };
}

export const assignedDrillPlatoonNames = (assignments: DrillInstructorPlatoonAssignment[]): string[] =>
  [...new Set(assignments.map(({ platoon }) => platoon.name).filter((name) => name.trim().length > 0))];

export const drillInstructorCanAccessTarget = (assignedPlatoons: string[], targetPlatoon?: string | null): boolean => {
  if (assignedPlatoons.length === 0) return false;
  return !targetPlatoon || ['All Cadets', 'Unit Contingent'].includes(targetPlatoon) || assignedPlatoons.includes(targetPlatoon);
};
