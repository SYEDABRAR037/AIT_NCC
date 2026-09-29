import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';

export const CADET_RANKS = ['CDT', 'LCPL', 'CPL', 'SGT', 'CQMH', 'CSM', 'JUO', 'SUO'] as const;

const parseAppointmentDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
};

export const promoteCadet = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  const newRank = typeof req.body?.rank === 'string' ? req.body.rank.trim().toUpperCase() : '';
  const appointmentDate = parseAppointmentDate(req.body?.appointmentDate);
  const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks.trim() : '';
  if (!CADET_RANKS.includes(newRank as (typeof CADET_RANKS)[number])) {
    res.status(400).json({ success: false, message: 'Select a valid NCC cadet rank' });
    return;
  }
  if (!appointmentDate) {
    res.status(400).json({ success: false, message: 'Enter a valid rank appointment date' });
    return;
  }
  if (remarks.length > 500) {
    res.status(400).json({ success: false, message: 'Remarks must be 500 characters or fewer' });
    return;
  }

  try {
    const cadetId = String(req.params.cadetId || '');
    const updated = await prisma.$transaction(async (tx) => {
      const cadet = await tx.user.findUnique({
        where: { id: cadetId },
        select: { id: true, fullName: true, regimentalNumber: true, role: true, status: true, rank: true },
      });
      if (!cadet || cadet.role !== 'CADET') throw Object.assign(new Error('Cadet not found'), { statusCode: 404 });
      if (!['ACTIVE', 'APPROVED'].includes(cadet.status)) throw Object.assign(new Error('Only active cadets can be appointed to cadet ranks'), { statusCode: 409 });
      if (cadet.rank === newRank) throw Object.assign(new Error('Cadet already holds this rank'), { statusCode: 409 });

      const changed = await tx.user.updateMany({
        where: { id: cadet.id, role: 'CADET', rank: cadet.rank, status: cadet.status },
        data: { rank: newRank },
      });
      if (changed.count !== 1) throw Object.assign(new Error('Cadet record changed concurrently; refresh and try again'), { statusCode: 409 });

      const history = await tx.rankHistory.create({
        data: { cadetId: cadet.id, previousRank: cadet.rank, newRank, appointmentDate, remarks: remarks || null, changedById: req.user!.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          action: 'CADET_RANK_CHANGED',
          targetType: 'CADET',
          targetId: cadet.id,
          details: JSON.stringify({ previousRank: cadet.rank, newRank, appointmentDate: appointmentDate.toISOString(), remarks: remarks || null }),
        },
      });
      await tx.timelineEvent.create({
        data: {
          cadetId: cadet.id,
          category: 'PROFILE_UPDATE',
          title: `Rank appointment: ${newRank}`,
          description: `${cadet.rank} → ${newRank}; effective ${appointmentDate.toISOString().slice(0, 10)}${remarks ? `. ${remarks}` : ''}`,
          actorId: req.user!.id,
          actorRole: req.user!.role,
        },
      });
      await tx.notification.create({
        data: { userId: cadet.id, title: 'NCC Rank Updated', message: `Your cadet rank is now ${newRank}, effective ${appointmentDate.toLocaleDateString()}.`, type: 'RANK_UPDATED', referenceType: 'RANK_HISTORY', referenceId: history.id, eventKey: `rank-history:${history.id}` },
      });
      return { ...cadet, rank: newRank, history };
    });

    res.json({ success: true, message: `${updated.fullName} is now ${updated.rank}.`, cadet: updated });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode) {
      res.status(statusCode).json({ success: false, message: (error as Error).message });
      return;
    }
    console.error('promoteCadet error:', error);
    res.status(500).json({ success: false, message: 'Unable to update cadet rank' });
  }
};
