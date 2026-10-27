export interface ReviewerScopeTarget {
  role: string;
  cadetId: string;
  seniorAssignments: string[];
  cadetPlatoon: string | null;
  authorizedPlatoons: string[];
}

export const reviewerCanAccessCadet = ({
  role,
  cadetId,
  seniorAssignments,
  cadetPlatoon,
  authorizedPlatoons,
}: ReviewerScopeTarget): boolean => {
  if (role === 'ADMIN_ANO') return true;
  if (role === 'SENIOR') return seniorAssignments.includes(cadetId);
  if (role === 'PLATOON_SENIOR') return Boolean(cadetPlatoon && authorizedPlatoons.includes(cadetPlatoon));
  return false;
};
