import { Request, Response } from 'express';
import { AccountStatus, Role } from '@prisma/client';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';

export const globalSearch = async (req: Request, res: Response): Promise<void> => {
  const actor = (req as AuthRequest).user;
  if (!actor) { res.status(401).json({ success: false }); return; }
  const q = String(req.query.q || '').trim();
  if (q.length < 2 || q.length > 100) { res.status(400).json({ success: false, message: 'Search must be 2–100 characters.' }); return; }
  const contains = { contains: q, mode: 'insensitive' as const };
  try {
    const isOfficer = actor.role === Role.ADMIN_ANO || actor.role === Role.DRILL_INSTRUCTOR;
    const [assignments, platoonAssignments] = await Promise.all([
      actor.role === Role.SENIOR ? prisma.seniorAssignment.findMany({ where: { seniorId: actor.id }, select: { cadetId: true } }) : Promise.resolve([]),
      actor.role === Role.PLATOON_SENIOR ? prisma.platoonSeniorAssignment.findMany({ where: { platoonSeniorId: actor.id }, select: { platoon: { select: { name: true } } } }) : Promise.resolve([]),
    ]);
    const cadetScope: any = isOfficer ? {} : actor.role === Role.SENIOR ? { id: { in: assignments.map((a) => a.cadetId) } } : actor.role === Role.PLATOON_SENIOR ? { platoonName: { in: platoonAssignments.map((a) => a.platoon.name) } } : { id: actor.id };
    const users = await prisma.user.findMany({ where: { role: isOfficer ? { in: [Role.CADET, Role.SENIOR, Role.PLATOON_SENIOR] } : Role.CADET, status: AccountStatus.ACTIVE, ...cadetScope, OR: [{ fullName: contains }, { regimentalNumber: contains }, { collegeRollNumber: contains }] }, take: 6, select: { id: true, fullName: true, regimentalNumber: true, rank: true, platoonName: true, role: true } });
    const [camps, notices, duties, certificates, leaves] = await Promise.all([
      prisma.camp.findMany({ where: { OR: [{ name: contains }, { location: contains }, { campType: contains }] }, take: 4, select: { id: true, name: true, campType: true, location: true } }),
      prisma.notice.findMany({ where: { OR: [{ title: contains }, { content: contains }], ...(!isOfficer ? { isPublic: true } : {}) }, take: 4, select: { id: true, title: true, category: true } }),
      prisma.duty.findMany({ where: { ...(isOfficer ? {} : { assignedCadetId: actor.id }), OR: [{ title: contains }, { dutyType: contains }, { location: contains }] }, take: 4, select: { id: true, title: true, status: true } }),
      prisma.certificate.findMany({ where: { ...(isOfficer ? {} : { cadetId: actor.id }), OR: [{ title: contains }, { certificateNo: contains }] }, take: 4, select: { id: true, title: true, certificateNo: true } }),
      prisma.leave.findMany({ where: { ...(isOfficer ? {} : { cadetId: actor.id }), OR: [{ leaveType: contains }, { reason: contains }] }, take: 4, select: { id: true, leaveType: true, status: true } }),
    ]);
    const results = [
      ...users.map((x) => ({ type: x.role === Role.CADET ? 'Cadet' : x.role === Role.SENIOR ? 'Senior' : 'Platoon Senior', role: x.role, id: x.id, title: x.fullName, description: `${x.rank} · ${x.regimentalNumber} · ${x.platoonName}`, path: `/profile/${x.id}` })),
      ...camps.map((x) => ({ type: 'Camp', id: x.id, title: x.name, description: `${x.campType} · ${x.location}`, path: '/camps' })),
      ...notices.map((x) => ({ type: 'Notice', id: x.id, title: x.title, description: x.category, path: '/notices' })),
      ...duties.map((x) => ({ type: 'Duty', id: x.id, title: x.title, description: x.status, path: '/duties' })),
      ...certificates.map((x) => ({ type: 'Certificate', id: x.id, title: x.title, description: x.certificateNo, path: '/certificates' })),
      ...leaves.map((x) => ({ type: 'Leave', id: x.id, title: x.leaveType, description: x.status, path: '/leave' })),
    ].slice(0, 20);
    res.json({ success: true, results });
  } catch (error) { console.error('globalSearch error:', error); res.status(500).json({ success: false, message: 'Search failed.' }); }
};
