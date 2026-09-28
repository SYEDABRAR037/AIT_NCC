import { prisma } from '../db';

export const resolvePlatoonSeniorScope = async (
  userId: string,
  homePlatoon?: string | null,
  db: Pick<typeof prisma, 'platoonSeniorAssignment'> = prisma,
): Promise<string[]> => {
  const platoons = new Set<string>();
  if (homePlatoon) platoons.add(homePlatoon);

  const assignments = await db.platoonSeniorAssignment.findMany({
    where: { platoonSeniorId: userId },
    include: { platoon: { select: { name: true } } },
  });
  for (const assignment of assignments) {
    if (assignment.platoon.name) platoons.add(assignment.platoon.name);
  }

  if (platoons.size === 0) platoons.add('Senior Division');
  return [...platoons];
};

export interface CadetLifecycleEvent {
  previousStatus: string;
  newStatus: string;
  reasonCode: string;
  reason: string;
  remarks: string | null;
  effectiveDate: string;
  officerRole: string;
  actorName: string;
  timestamp: string;
}

export const getCadetLifecycleHistory = async (cadetIds: string[]) => {
  if (cadetIds.length === 0) return new Map<string, CadetLifecycleEvent[]>();

  const logs = await prisma.auditLog.findMany({
    where: {
      targetType: 'CADET',
      targetId: { in: cadetIds },
      action: 'CADET_STATUS_CHANGED',
    },
    orderBy: { createdAt: 'desc' },
  });

  const history = new Map<string, CadetLifecycleEvent[]>();
  for (const log of logs) {
    if (!log.targetId || !log.details) continue;
    try {
      const details = JSON.parse(log.details) as Partial<CadetLifecycleEvent>;
      if (!details.previousStatus || !details.newStatus) continue;
      const event: CadetLifecycleEvent = {
        previousStatus: details.previousStatus,
        newStatus: details.newStatus,
        reasonCode: details.reasonCode || '',
        reason: details.reason || '',
        remarks: details.remarks || null,
        effectiveDate: details.effectiveDate || log.createdAt.toISOString(),
        officerRole: details.officerRole || '',
        actorName: log.actorName,
        timestamp: log.createdAt.toISOString(),
      };
      history.set(log.targetId, [...(history.get(log.targetId) || []), event]);
    } catch {
      // Ignore unrelated/malformed audit entries; never make profile access fail.
    }
  }
  return history;
};
