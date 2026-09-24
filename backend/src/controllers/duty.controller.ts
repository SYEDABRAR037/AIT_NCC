import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';

// 1. Cadet views own assigned duties
export const getMyDuties = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const duties = await prisma.duty.findMany({
      where: { assignedCadetId: req.user.id },
      include: {
        cadet: {
          select: {
            id: true,
            fullName: true,
            regimentalNumber: true,
            platoonName: true,
            collegeRollNumber: true,
            company: true,
            battalion: true,
          },
        },
        assignedBy: {
          select: { fullName: true, role: true, regimentalNumber: true },
        },
      },
      orderBy: { dutyDate: 'desc' },
    });

    const formattedDuties = (duties as any[]).map((d: any) => ({
      ...d,
      date: d.dutyDate,
      cadet: d.cadet
        ? {
            ...d.cadet,
            name: d.cadet.fullName,
            rank: 'CDT',
          }
        : undefined,
    }));

    res.json({ success: true, count: formattedDuties.length, duties: formattedDuties });
  } catch (error) {
    console.error('getMyDuties error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve personal duties' });
  }
};

// 2. Officers view unit duty roster
export const getUnitDuties = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role === 'CADET') {
      res.status(403).json({ success: false, message: 'Unauthorized to view full unit duty roster' });
      return;
    }

    const whereClause: any = {};
    if (req.user.role === 'SENIOR') {
      const assignments = await prisma.seniorAssignment.findMany({
        where: { seniorId: req.user.id },
        select: { cadetId: true },
      });
      const assignedIds = assignments.map((a) => a.cadetId);
      if (assignedIds.length > 0) {
        whereClause.assignedCadetId = { in: assignedIds };
      } else if (req.user.platoonName) {
        const cadets = await prisma.user.findMany({
          where: { platoonName: req.user.platoonName, role: 'CADET' },
          select: { id: true },
        });
        whereClause.assignedCadetId = { in: cadets.map((c) => c.id) };
      }
    } else if (req.user.role === 'PLATOON_SENIOR') {
      const cadets = await prisma.user.findMany({
        where: { platoonName: req.user.platoonName, role: 'CADET' },
        select: { id: true },
      });
      whereClause.assignedCadetId = { in: cadets.map((c) => c.id) };
    }

    const duties = await prisma.duty.findMany({
      where: whereClause,
      include: {
        cadet: {
          select: {
            id: true,
            fullName: true,
            regimentalNumber: true,
            collegeRollNumber: true,
            platoonName: true,
            company: true,
            battalion: true,
          },
        },
        assignedBy: {
          select: { fullName: true, role: true, regimentalNumber: true },
        },
      },
      orderBy: { dutyDate: 'desc' },
    });

    const formattedDuties = (duties as any[]).map((d: any) => ({
      ...d,
      date: d.dutyDate,
      cadet: d.cadet
        ? {
            ...d.cadet,
            name: d.cadet.fullName,
            rank: 'CDT',
          }
        : undefined,
    }));

    res.json({ success: true, count: formattedDuties.length, duties: formattedDuties });
  } catch (error) {
    console.error('getUnitDuties error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve duty roster' });
  }
};

// 3. Get eligible cadets for assignment (Role-Based Access Control)
export const getAssignableCadets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role === 'CADET') {
      res.status(403).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const whereClause: any = { role: 'CADET', status: 'ACTIVE' };
    if (req.user.role === 'PLATOON_SENIOR') {
      if (req.user.platoonName) {
        whereClause.platoonName = req.user.platoonName;
      }
    } else if (req.user.role === 'SENIOR') {
      const assignments = await prisma.seniorAssignment.findMany({
        where: { seniorId: req.user.id },
        select: { cadetId: true },
      });
      const assignedIds = assignments.map((a) => a.cadetId);
      if (assignedIds.length > 0) {
        whereClause.id = { in: assignedIds };
      } else if (req.user.platoonName) {
        whereClause.platoonName = req.user.platoonName;
      }
    }

    const cadets = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        platoonName: true,
        collegeRollNumber: true,
        company: true,
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({
      success: true,
      cadets: cadets.map((c) => ({
        id: c.id,
        name: c.fullName,
        fullName: c.fullName,
        regimentalNumber: c.regimentalNumber,
        rank: 'CDT',
        platoonName: c.platoonName,
      })),
    });
  } catch (error) {
    console.error('getAssignableCadets error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve assignable cadets' });
  }
};

// 4. Officer assigns a duty to a cadet
export const assignDuty = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role === 'CADET') {
      res.status(403).json({ success: false, message: 'Cadets cannot assign duties' });
      return;
    }

    const {
      title,
      dutyType,
      location,
      dutyDate,
      date,
      reportingTime,
      instructions,
      assignedCadetId,
      cadetId,
    } = req.body;

    const targetCadetId = assignedCadetId || cadetId;
    const targetDate = dutyDate || date;
    const targetTitle = title || `${String(dutyType || 'DUTY').replace(/_/g, ' ')} Detail`;

    if (!targetCadetId || !dutyType || !location || !targetDate) {
      res.status(400).json({ success: false, message: 'Missing mandatory duty parameters (cadet, type, location, date)' });
      return;
    }

    const cadet = await prisma.user.findUnique({
      where: { id: String(targetCadetId) },
    });

    if (!cadet) {
      res.status(404).json({ success: false, message: 'Designated cadet not found' });
      return;
    }

    const duty = await prisma.$transaction(async (tx) => {
      const d = await tx.duty.create({
        data: {
          title: String(targetTitle).trim(),
          dutyType: String(dutyType).trim(),
          location: String(location).trim(),
          dutyDate: new Date(targetDate),
          reportingTime: reportingTime ? String(reportingTime).trim() : '0630 hrs in ceremonial dress',
          instructions: instructions ? String(instructions).trim() : null,
          assignedCadetId: cadet.id,
          assignedById: req.user!.id,
          status: 'ASSIGNED',
        },
        include: {
          cadet: { select: { id: true, fullName: true, regimentalNumber: true, platoonName: true } },
          assignedBy: { select: { fullName: true, role: true } },
        },
      });

      // Cross-Module: Timeline
      await tx.timelineEvent.create({
        data: {
          cadetId: cadet.id,
          category: 'DUTY',
          title: `Duty Assigned: ${String(dutyType).replace(/_/g, ' ')}`,
          description: `Assigned to ${targetTitle} at ${location} by ${req.user!.role} (${req.user!.fullName}). Reporting: ${reportingTime || '0630 hrs'}`,
          actorId: req.user!.id,
          actorRole: req.user!.role,
        },
      });

      // Cross-Module: Notification to cadet
      await tx.notification.create({
        data: {
          userId: cadet.id,
          title: `New Duty Assignment: ${String(dutyType).replace(/_/g, ' ')}`,
          message: `You are assigned to ${targetTitle} on ${new Date(targetDate).toLocaleDateString()} at ${location}. Reporting: ${reportingTime || '0630 hrs'}.`,
        },
      });

      return d;
    });

    res.status(201).json({
      success: true,
      message: `Duty assigned to Cadet ${cadet.fullName} successfully.`,
      duty: {
        ...duty,
        date: duty.dutyDate,
        cadet: {
          ...duty.cadet,
          name: duty.cadet.fullName,
          rank: 'CDT',
        },
      },
    });
  } catch (error) {
    console.error('assignDuty error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign duty' });
  }
};

// 5. Mark duty completed or excused
export const updateDutyStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role === 'CADET') {
      res.status(403).json({ success: false, message: 'Only officers can update duty status' });
      return;
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!['COMPLETED', 'EXCUSED'].includes(status)) {
      res.status(400).json({ success: false, message: 'Status must be COMPLETED or EXCUSED' });
      return;
    }

    const duty = await prisma.duty.update({
      where: { id: String(id) },
      data: { status },
      include: {
        cadet: {
          select: { id: true, fullName: true, regimentalNumber: true, platoonName: true },
        },
        assignedBy: {
          select: { fullName: true, role: true },
        },
      },
    });

    if (status === 'COMPLETED') {
      await prisma.timelineEvent.create({
        data: {
          cadetId: duty.assignedCadetId,
          category: 'DUTY',
          title: `Duty Completed: ${duty.dutyType.replace(/_/g, ' ')}`,
          description: `Successfully performed duty: ${duty.title} at ${duty.location}. Verified by ${req.user.role}.`,
          actorId: req.user.id,
          actorRole: req.user.role,
        },
      });
    }

    res.json({
      success: true,
      message: `Duty marked as ${status}.`,
      duty: {
        ...duty,
        date: duty.dutyDate,
        cadet: {
          ...duty.cadet,
          name: duty.cadet.fullName,
          rank: 'CDT',
        },
      },
    });
  } catch (error) {
    console.error('updateDutyStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update duty status' });
  }
};
