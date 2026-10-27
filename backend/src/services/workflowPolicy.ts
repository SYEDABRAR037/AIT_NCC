export const canReviewLeaveAtStage = (role: string, status: string): boolean => {
  if (role === 'SENIOR') return status === 'SUBMITTED' || status === 'SENIOR_REVIEW';
  if (role === 'PLATOON_SENIOR') return status === 'PLATOON_SENIOR_REVIEW';
  if (role === 'ADMIN_ANO') return status === 'ANO_REVIEW';
  return false;
};

export const canManageInquiryStatusAtStage = (
  role: string,
  reviewerRole: string | null,
  actorId: string,
  submitterId: string,
): boolean => {
  if (actorId === submitterId) return false;
  if (role === 'ADMIN_ANO') return true;
  return (role === 'SENIOR' || role === 'PLATOON_SENIOR') && role === reviewerRole;
};

export const canTransitionInquiryStatusAtStage = (
  role: string,
  reviewerRole: string | null,
  status: string,
  actorId: string,
  submitterId: string,
): boolean => {
  if (actorId === submitterId) return false;
  if (role === 'ADMIN_ANO') return status === 'RESOLVED' || status === 'CLOSED';
  if (!reviewerRole || !canManageInquiryStatusAtStage(role, reviewerRole, actorId, submitterId)) return false;
  if (status === 'FORWARDED') return role === 'SENIOR' || role === 'PLATOON_SENIOR';
  return status === 'RESOLVED' || status === 'CLOSED';
};

export const canTransitionCampParticipantStatus = (
  role: string,
  currentStatus: string,
  nextStatus: string,
): boolean => {
  if (role === 'SENIOR') {
    return currentStatus === 'APPLIED' && ['RECOMMENDED', 'WAITLISTED', 'REJECTED'].includes(nextStatus);
  }
  if (role === 'PLATOON_SENIOR') {
    return ['RECOMMENDED', 'WAITLISTED'].includes(currentStatus) &&
      ['SELECTED', 'WAITLISTED', 'REJECTED'].includes(nextStatus);
  }
  if (role === 'ADMIN_ANO') {
    if (nextStatus === 'CONFIRMED') return currentStatus === 'SELECTED';
    if (nextStatus === 'PARTICIPATED') return currentStatus === 'CONFIRMED';
    if (nextStatus === 'COMPLETED') return currentStatus === 'PARTICIPATED';
    return nextStatus === 'REJECTED' && ['APPLIED', 'RECOMMENDED', 'SELECTED', 'WAITLISTED'].includes(currentStatus);
  }
  return false;
};
