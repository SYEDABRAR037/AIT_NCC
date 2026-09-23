import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';

// 1. Cadet views own Activity Timeline
export const getMyTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const events = await prisma.timelineEvent.findMany({
      where: { cadetId: req.user.id },
      include: {
        cadet: {
          select: {
            id: true,
            fullName: true,
            regimentalNumber: true,
            platoonName: true,
          },
        },
      },
      orderBy: { eventDate: 'desc' },
    });

    const formattedEvents = (events as any[]).map((e: any) => ({
      ...e,
      createdAt: e.eventDate || e.createdAt,
      user: e.cadet
        ? {
            id: e.cadet.id,
            name: e.cadet.fullName,
            regimentalNumber: e.cadet.regimentalNumber,
            rank: 'CDT',
          }
        : undefined,
    }));

    res.json({ success: true, count: formattedEvents.length, events: formattedEvents });
  } catch (error) {
    console.error('getMyTimeline error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve timeline' });
  }
};

// 2. Officer views a specific cadet's Activity Timeline (with RBAC)
export const getCadetTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { cadetId } = req.params;

    // Strict Role-Based Access Control
    if (req.user.role === 'SENIOR') {
      const isAssigned = await prisma.seniorAssignment.findFirst({
        where: { seniorId: req.user.id, cadetId: String(cadetId) },
      });
      if (!isAssigned) {
        res.status(403).json({ success: false, message: 'Access forbidden: Cadet not assigned to you.' });
        return;
      }
    } else if (req.user.role === 'PLATOON_SENIOR') {
      const cadet = await prisma.user.findUnique({
        where: { id: String(cadetId) },
        select: { platoonName: true },
      });
      if (!cadet || (req.user.platoonName && cadet.platoonName !== req.user.platoonName)) {
        res.status(403).json({ success: false, message: 'Access forbidden: Cadet not in your platoon.' });
        return;
      }
    }

    const events = await prisma.timelineEvent.findMany({
      where: { cadetId: String(cadetId) },
      include: {
        cadet: {
          select: {
            id: true,
            fullName: true,
            regimentalNumber: true,
            platoonName: true,
          },
        },
      },
      orderBy: { eventDate: 'desc' },
    });

    const formattedEvents = (events as any[]).map((e: any) => ({
      ...e,
      createdAt: e.eventDate || e.createdAt,
      user: e.cadet
        ? {
            id: e.cadet.id,
            name: e.cadet.fullName,
            regimentalNumber: e.cadet.regimentalNumber,
            rank: 'CDT',
          }
        : undefined,
    }));

    res.json({ success: true, count: formattedEvents.length, events: formattedEvents });
  } catch (error) {
    console.error('getCadetTimeline error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve cadet timeline' });
  }
};

// 3. Unit-wide Timeline Stream with Hierarchy-Enforced Scoping
// Admin/ANO: Full Unit
// Platoon Senior: Platoon Cadets
// Senior: Assigned Cadets + Own
// Cadet: Own Timeline
export const getUnitTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    let whereClause: any = {};

    if (req.user.role === 'PLATOON_SENIOR') {
      if (req.user.platoonName) {
        const cadets = await prisma.user.findMany({
          where: { platoonName: req.user.platoonName },
          select: { id: true },
        });
        whereClause.cadetId = { in: cadets.map((c) => c.id) };
      }
    } else if (req.user.role === 'SENIOR') {
      const assignments = await prisma.seniorAssignment.findMany({
        where: { seniorId: req.user.id },
        select: { cadetId: true },
      });
      const ids = assignments.map((a) => a.cadetId);
      ids.push(req.user.id);
      whereClause.cadetId = { in: ids };
    } else if (req.user.role === 'CADET') {
      whereClause.cadetId = req.user.id;
    }
    // Admin/ANO & Drill Instructor receive full unit timeline

    const events = await prisma.timelineEvent.findMany({
      where: whereClause,
      take: 100,
      include: {
        cadet: {
          select: {
            id: true,
            fullName: true,
            regimentalNumber: true,
            platoonName: true,
          },
        },
      },
      orderBy: { eventDate: 'desc' },
    });

    const formattedEvents = (events as any[]).map((e: any) => ({
      ...e,
      createdAt: e.eventDate || e.createdAt,
      user: e.cadet
        ? {
            id: e.cadet.id,
            name: e.cadet.fullName,
            regimentalNumber: e.cadet.regimentalNumber,
            rank: 'CDT',
          }
        : undefined,
    }));

    res.json({ success: true, count: formattedEvents.length, events: formattedEvents });
  } catch (error) {
    console.error('getUnitTimeline error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve unit timeline' });
  }
};
