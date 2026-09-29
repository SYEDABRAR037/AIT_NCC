import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { AccountStatus, Role } from '@prisma/client';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';

const identitySelect = { id: true, fullName: true, rank: true, regimentalNumber: true, collegeRollNumber: true, year: true, platoonName: true, team: true, status: true, profilePhotoUrl: true } as const;
const ensureToken = async (cadetId: string) => {
  const current = await prisma.user.findUnique({ where: { id: cadetId }, select: { digitalIdToken: true } });
  if (!current) return null;
  if (current.digitalIdToken) return current.digitalIdToken;
  const token = randomUUID();
  await prisma.user.updateMany({ where: { id: cadetId, digitalIdToken: null }, data: { digitalIdToken: token } });
  return (await prisma.user.findUnique({ where: { id: cadetId }, select: { digitalIdToken: true } }))?.digitalIdToken || null;
};

export const getMyDigitalId = async (req: Request, res: Response): Promise<void> => {
  const actor = (req as AuthRequest).user;
  if (!actor) { res.status(401).json({ success: false }); return; }
  if (actor.role !== Role.CADET || actor.status !== AccountStatus.ACTIVE) { res.status(403).json({ success: false, message: 'Digital ID is available to active cadets.' }); return; }
  const cadet = await prisma.user.findUnique({ where: { id: actor.id }, select: identitySelect });
  if (!cadet) { res.status(404).json({ success: false }); return; }
  const token = await ensureToken(cadet.id);
  res.json({ success: true, cadet, token });
};

export const getCadetDigitalId = async (req: Request, res: Response): Promise<void> => {
  const actor = (req as AuthRequest).user;
  if (!actor) { res.status(401).json({ success: false }); return; }
  const cadetId = String(req.params.cadetId);
  const cadet = await prisma.user.findFirst({ where: { id: cadetId, role: Role.CADET }, select: identitySelect });
  if (!cadet) { res.status(404).json({ success: false, message: 'Cadet not found.' }); return; }
  let allowed = actor.role === Role.ADMIN_ANO || actor.role === Role.DRILL_INSTRUCTOR;
  if (actor.role === Role.SENIOR) allowed = !!(await prisma.seniorAssignment.findFirst({ where: { seniorId: actor.id, cadetId } }));
  if (actor.role === Role.PLATOON_SENIOR) allowed = !!(await prisma.platoonSeniorAssignment.findFirst({ where: { platoonSeniorId: actor.id, platoon: { name: cadet.platoonName } } }));
  if (!allowed) { res.status(403).json({ success: false, message: 'You are not authorized to view this cadet ID.' }); return; }
  const token = await ensureToken(cadet.id);
  res.json({ success: true, cadet, token });
};

export const verifyDigitalId = async (req: Request, res: Response): Promise<void> => {
  const token = String(req.params.token || '');
  if (token.length > 80) { res.status(400).json({ success: false, status: 'INVALID' }); return; }
  const cadet = await prisma.user.findUnique({ where: { digitalIdToken: token }, select: identitySelect });
  if (!cadet) { res.status(404).json({ success: true, status: 'INVALID' }); return; }
  const labels: Record<string, string> = { ACTIVE: 'VALID', INACTIVE: 'INACTIVE', PASSED_OUT: 'PASSED_OUT' };
  res.json({ success: true, status: labels[cadet.status] || 'DEACTIVATED', cadet: { fullName: cadet.fullName, rank: cadet.rank, regimentalNumber: cadet.regimentalNumber, status: cadet.status, profilePhotoUrl: cadet.profilePhotoUrl } });
};
