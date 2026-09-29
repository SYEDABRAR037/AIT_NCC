import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { getCadetLifecycleHistory, resolvePlatoonSeniorScope } from '../services/cadetLifecycle.service';

export const getCadetServiceRecord = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    const cadetId = req.params.cadetId === 'me' ? req.user.id : String(req.params.cadetId || '');
    if (!cadetId) {
      res.status(400).json({ success: false, message: 'Cadet ID is required' });
      return;
    }

    if (req.user.role === 'CADET' && cadetId !== req.user.id) {
      res.status(403).json({ success: false, message: 'Cadets may only view their own service record' });
      return;
    }
    if (req.user.role === 'SENIOR') {
      const assigned = await prisma.seniorAssignment.findFirst({ where: { seniorId: req.user.id, cadetId } });
      if (!assigned) {
        res.status(403).json({ success: false, message: 'This cadet is outside your authorized senior scope' });
        return;
      }
    }
    if (req.user.role === 'PLATOON_SENIOR') {
      const cadetPlatoon = await prisma.user.findUnique({ where: { id: cadetId }, select: { platoonName: true } });
      const authorizedPlatoons = await resolvePlatoonSeniorScope(req.user.id, req.user.platoonName);
      if (!cadetPlatoon || !authorizedPlatoons.includes(cadetPlatoon.platoonName)) {
        res.status(403).json({ success: false, message: 'This cadet is outside your authorized platoon scope' });
        return;
      }
    }

    const cadet = await prisma.user.findUnique({
      where: { id: cadetId, role: 'CADET' },
      select: {
        id: true, fullName: true, regimentalNumber: true, collegeRollNumber: true, email: true,
        phone: true, year: true, branch: true, platoonName: true, team: true, company: true,
        battalion: true, group: true, enrollmentDetails: true, dateOfJoining: true,
        status: true, rank: true, profilePhotoUrl: true, createdAt: true,
      },
    });
    if (!cadet) {
      res.status(404).json({ success: false, message: 'Cadet not found' });
      return;
    }

    const [attendance, attendanceSummary, camps, duties, certificates, leaves, approvals, rankHistory, faceEnrollment, timeline, lifecycleMap] = await Promise.all([
      prisma.trainingAttendance.findMany({
        where: { cadetId }, include: { session: { select: { title: true, activity: true, date: true, timing: true, location: true } } },
        orderBy: { createdAt: 'desc' }, take: 200,
      }),
      prisma.trainingAttendance.groupBy({ by: ['status'], where: { cadetId }, _count: { _all: true } }),
      prisma.campParticipant.findMany({
        where: { cadetId }, include: { camp: true }, orderBy: { createdAt: 'desc' },
      }),
      prisma.duty.findMany({
        where: { assignedCadetId: cadetId }, include: { assignedBy: { select: { fullName: true, role: true } } },
        orderBy: { dutyDate: 'desc' },
      }),
      prisma.certificate.findMany({ where: { cadetId }, orderBy: { issueDate: 'desc' } }),
      prisma.leave.findMany({
        where: { cadetId }, include: { leaveReviews: { include: { reviewer: { select: { fullName: true, role: true } } }, orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.reviewRecord.findMany({
        where: { cadetId }, include: { reviewer: { select: { fullName: true, role: true } } }, orderBy: { createdAt: 'desc' },
      }),
      prisma.rankHistory.findMany({
        where: { cadetId }, include: { changedBy: { select: { fullName: true, role: true } } }, orderBy: { changedAt: 'desc' },
      }),
      prisma.biometricTemplate.findUnique({
        where: { cadetId }, select: { qualityScore: true, registeredBy: true, registeredAt: true, updatedAt: true },
      }),
      prisma.timelineEvent.findMany({ where: { cadetId }, orderBy: { eventDate: 'desc' }, take: 200 }),
      getCadetLifecycleHistory([cadetId]),
    ]);

    const lifecycleHistory = lifecycleMap.get(cadetId) || [];
    const statusDetails = ['INACTIVE', 'PASSED_OUT'].includes(cadet.status)
      ? lifecycleHistory.find((event) => event.newStatus === cadet.status) || null
      : null;

    res.json({
      success: true,
      serviceRecord: {
        currentInformation: { ...cadet, statusDetails, faceEnrolled: Boolean(faceEnrollment), faceEnrollment },
        historicalInformation: {
          attendance,
          attendanceSummary: attendanceSummary.reduce((summary, entry) => ({ ...summary, [entry.status]: entry._count._all }), {} as Record<string, number>),
          camps, duties, certificates, leaves, approvals,
          achievements: timeline.filter((event) => event.category === 'ACHIEVEMENT'),
          timeline, lifecycleHistory, rankHistory,
        },
      },
    });
  } catch (error) {
    console.error('getCadetServiceRecord error:', error);
    res.status(500).json({ success: false, message: 'Unable to retrieve cadet service record' });
  }
};
