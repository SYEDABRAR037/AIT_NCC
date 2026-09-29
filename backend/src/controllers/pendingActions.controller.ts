import { Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { resolvePlatoonSeniorScope } from '../services/cadetLifecycle.service';

type PendingAction = {
  id: string;
  type: string;
  title: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: Date;
  targetTab: string;
};

const pendingStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'FORWARDED', 'PENDING', 'SENIOR_REVIEW', 'PLATOON_SENIOR_REVIEW', 'ANO_REVIEW'];

export const getPendingActions = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  try {
    const { id: userId, role } = req.user;
    const actions: PendingAction[] = [];

    if (role === 'CADET') {
      const [duties, campApplications, leaveApplications] = await Promise.all([
        prisma.duty.findMany({
          where: { assignedCadetId: userId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
          select: { id: true, title: true, dutyType: true, dutyDate: true, status: true },
          orderBy: { dutyDate: 'asc' }, take: 8,
        }),
        prisma.campParticipant.findMany({
          where: { cadetId: userId, status: { in: ['APPLIED', 'RECOMMENDED', 'WAITLISTED'] } },
          select: { id: true, status: true, createdAt: true, camp: { select: { id: true, name: true, startDate: true } } },
          orderBy: { createdAt: 'desc' }, take: 8,
        }),
        prisma.leave.findMany({
          where: { cadetId: userId, status: { in: pendingStatuses } },
          select: { id: true, leaveType: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' }, take: 8,
        }),
      ]);
      duties.forEach((duty) => actions.push({
        id: duty.id, type: 'DUTY', title: duty.title, subject: duty.dutyType,
        status: duty.status, priority: 'NORMAL', createdAt: duty.dutyDate, targetTab: 'duties',
      }));
      campApplications.forEach((application) => actions.push({
        id: application.id, type: 'CAMP', title: application.camp.name, subject: 'Camp participation',
        status: application.status, priority: 'NORMAL', createdAt: application.createdAt, targetTab: 'camps',
      }));
      leaveApplications.forEach((leave) => actions.push({
        id: leave.id, type: 'LEAVE', title: `${leave.leaveType} leave`, subject: 'Your leave request',
        status: leave.status, priority: 'NORMAL', createdAt: leave.createdAt, targetTab: 'leave',
      }));
    } else if (['ADMIN_ANO', 'DRILL_INSTRUCTOR', 'PLATOON_SENIOR', 'SENIOR'].includes(role)) {
      let scopedCadetIds: string[] | null = null;
      if (role === 'PLATOON_SENIOR') {
        const platoons = await resolvePlatoonSeniorScope(userId, req.user.platoonName);
        const cadets = await prisma.user.findMany({ where: { role: 'CADET', platoonName: { in: platoons } }, select: { id: true } });
        scopedCadetIds = cadets.map((cadet) => cadet.id);
      } else if (role === 'SENIOR') {
        const assignments = await prisma.seniorAssignment.findMany({ where: { seniorId: userId }, select: { cadetId: true } });
        scopedCadetIds = assignments.map((assignment) => assignment.cadetId);
      }

      const cadetScope = scopedCadetIds === null ? {} : { id: { in: scopedCadetIds } };
      const relatedCadetScope = scopedCadetIds === null ? {} : { cadetId: { in: scopedCadetIds } };
      const [cadets, leaves, requests] = await Promise.all([
        role === 'DRILL_INSTRUCTOR'
          ? Promise.resolve([])
          : prisma.user.findMany({
            where: {
              ...cadetScope,
              role: 'CADET',
              status: { in: ['UNDER_REVIEW', 'HOLD', 'RETURNED'] },
            },
            select: { id: true, fullName: true, status: true, createdAt: true, regimentalNumber: true },
            orderBy: { createdAt: 'asc' }, take: 12,
          }),
        prisma.leave.findMany({
          where: {
            ...relatedCadetScope,
            status: role === 'SENIOR' ? { in: ['SUBMITTED', 'SENIOR_REVIEW', 'PENDING'] }
              : role === 'PLATOON_SENIOR' ? 'PLATOON_SENIOR_REVIEW'
                : role === 'ADMIN_ANO' ? { in: ['ANO_REVIEW', 'PENDING'] }
                  : { in: ['SUBMITTED', 'SENIOR_REVIEW', 'PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'PENDING'] },
          },
          select: { id: true, leaveType: true, status: true, createdAt: true, cadet: { select: { fullName: true, regimentalNumber: true } } },
          orderBy: { createdAt: 'asc' }, take: 12,
        }),
        role === 'DRILL_INSTRUCTOR'
          ? Promise.resolve([])
          : prisma.request.findMany({
            where: {
              ...relatedCadetScope,
              status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'FORWARDED'] },
              currentReviewerRole: role as Role,
              OR: [{ currentReviewerId: null }, { currentReviewerId: userId }],
            },
            select: { id: true, title: true, requestType: true, status: true, priority: true, createdAt: true, cadet: { select: { fullName: true, regimentalNumber: true } } },
            orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }], take: 12,
          }),
      ]);

      cadets.forEach((cadet) => actions.push({
        id: cadet.id, type: 'REGISTRATION', title: cadet.fullName, subject: `Reg. ${cadet.regimentalNumber}`,
        status: cadet.status, priority: 'NORMAL', createdAt: cadet.createdAt, targetTab: 'approvals',
      }));
      leaves.forEach((leave) => actions.push({
        id: leave.id, type: 'LEAVE', title: `${leave.leaveType} leave`, subject: leave.cadet.fullName,
        status: leave.status, priority: 'NORMAL', createdAt: leave.createdAt, targetTab: 'leave',
      }));
      requests.forEach((request) => actions.push({
        id: request.id, type: request.requestType, title: request.title, subject: request.cadet.fullName,
        status: request.status, priority: request.priority, createdAt: request.createdAt, targetTab: 'approvals',
      }));
    }

    actions.sort((a, b) => {
      const priorityWeight = (value: string) => value === 'URGENT' ? 0 : value === 'HIGH' ? 1 : 2;
      return priorityWeight(a.priority) - priorityWeight(b.priority) || a.createdAt.getTime() - b.createdAt.getTime();
    });
    res.json({ success: true, count: actions.length, actions: actions.slice(0, 20) });
  } catch (error) {
    console.error('getPendingActions error:', error);
    res.status(500).json({ success: false, message: 'Unable to load pending actions' });
  }
};
