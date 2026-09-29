import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { resolvePlatoonSeniorScope } from '../services/cadetLifecycle.service';

const getOfficerCadetScope = async (req: AuthRequest): Promise<string[] | null> => {
  if (!req.user || req.user.role === 'ADMIN_ANO' || req.user.role === 'DRILL_INSTRUCTOR') return null;
  if (req.user.role === 'SENIOR') {
    const assignments = await prisma.seniorAssignment.findMany({
      where: { seniorId: req.user.id }, select: { cadetId: true },
    });
    return assignments.map((assignment) => assignment.cadetId);
  }
  if (req.user.role === 'PLATOON_SENIOR') {
    const platoons = await resolvePlatoonSeniorScope(req.user.id, req.user.platoonName);
    const cadets = await prisma.user.findMany({
      where: { role: 'CADET', platoonName: { in: platoons } }, select: { id: true },
    });
    return cadets.map((cadet) => cadet.id);
  }
  return [];
};

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
            rank: true,
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
            rank: d.cadet.rank,
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
    const scopedCadetIds = await getOfficerCadetScope(req);
    if (scopedCadetIds !== null) whereClause.assignedCadetId = { in: scopedCadetIds };

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
            rank: true,
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
            rank: d.cadet.rank,
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
    const scopedCadetIds = await getOfficerCadetScope(req);
    if (scopedCadetIds !== null) whereClause.id = { in: scopedCadetIds };

    const cadets = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        platoonName: true,
        collegeRollNumber: true,
        company: true,
        rank: true,
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
        rank: c.rank,
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
      startTime,
      endTime,
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

    const cadet = await prisma.user.findUnique({ where: { id: String(targetCadetId) } });

    if (!cadet) {
      res.status(404).json({ success: false, message: 'Designated cadet not found' });
      return;
    }

    if (cadet.role !== 'CADET' || !['ACTIVE', 'APPROVED'].includes(cadet.status)) {
      res.status(409).json({ success: false, message: 'Duties can only be assigned to active cadets' });
      return;
    }
    const scopedCadetIds = await getOfficerCadetScope(req);
    if (scopedCadetIds !== null && !scopedCadetIds.includes(cadet.id)) {
      res.status(403).json({ success: false, message: 'This cadet is outside your authorized assignment scope' });
      return;
    }

    const parsedDate = new Date(targetDate);
    if (Number.isNaN(parsedDate.getTime())) {
      res.status(400).json({ success: false, message: 'Duty date is invalid' });
      return;
    }
    const normalizedStart = typeof startTime === 'string' ? startTime.trim() : '';
    const normalizedEnd = typeof endTime === 'string' ? endTime.trim() : '';
    if (normalizedStart && !/^([01]\d|2[0-3]):[0-5]\d$/.test(normalizedStart)) {
      res.status(400).json({ success: false, message: 'Duty start time must use 24-hour HH:MM format' });
      return;
    }
    if (normalizedEnd && !/^([01]\d|2[0-3]):[0-5]\d$/.test(normalizedEnd)) {
      res.status(400).json({ success: false, message: 'Duty end time must use 24-hour HH:MM format' });
      return;
    }
    if (normalizedStart && normalizedEnd && normalizedEnd <= normalizedStart) {
      res.status(400).json({ success: false, message: 'Duty end time must be later than the start time' });
      return;
    }

    const duty = await prisma.$transaction(async (tx) => {
      const d = await tx.duty.create({
        data: {
          title: String(targetTitle).trim(),
          dutyType: String(dutyType).trim(),
          location: String(location).trim(),
          dutyDate: parsedDate,
          startTime: normalizedStart || reportingTime ? normalizedStart || String(reportingTime).trim() : null,
          endTime: normalizedEnd || null,
          reportingTime: reportingTime ? String(reportingTime).trim() : '0630 hrs in ceremonial dress',
          instructions: instructions ? String(instructions).trim() : null,
          assignedCadetId: cadet.id,
          assignedById: req.user!.id,
          status: 'ASSIGNED',
        },
        include: {
          cadet: { select: { id: true, fullName: true, regimentalNumber: true, platoonName: true, rank: true } },
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

      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          action: 'DUTY_ASSIGNED',
          targetType: 'DUTY',
          targetId: d.id,
          details: JSON.stringify({ cadetId: cadet.id, cadetName: cadet.fullName, dutyType, title: targetTitle, dutyDate: parsedDate.toISOString(), previousStatus: null, newStatus: 'ASSIGNED' }),
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
          rank: duty.cadet.rank,
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

    if (!['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXCUSED'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid duty status' });
      return;
    }

    const existingDuty = await prisma.duty.findUnique({ where: { id: String(id) }, select: { id: true, assignedCadetId: true, status: true, dutyType: true, title: true, location: true } });
    if (!existingDuty) {
      res.status(404).json({ success: false, message: 'Duty not found' });
      return;
    }
    const scopedCadetIds = await getOfficerCadetScope(req);
    if (scopedCadetIds !== null && !scopedCadetIds.includes(existingDuty.assignedCadetId)) {
      res.status(403).json({ success: false, message: 'This duty is outside your authorized scope' });
      return;
    }

    const duty = await prisma.$transaction(async (tx) => {
      const updated = await tx.duty.update({
        where: { id: existingDuty.id },
        data: { status },
        include: {
          cadet: { select: { id: true, fullName: true, regimentalNumber: true, platoonName: true, rank: true } },
          assignedBy: { select: { fullName: true, role: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          action: 'DUTY_STATUS_CHANGED',
          targetType: 'DUTY',
          targetId: existingDuty.id,
          details: JSON.stringify({ previousStatus: existingDuty.status, newStatus: status, cadetId: existingDuty.assignedCadetId }),
        },
      });
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        await tx.timelineEvent.create({
          data: {
            cadetId: existingDuty.assignedCadetId,
            category: 'DUTY',
            title: `Duty ${status === 'COMPLETED' ? 'Completed' : 'Cancelled'}: ${existingDuty.dutyType.replace(/_/g, ' ')}`,
            description: `${existingDuty.title} at ${existingDuty.location}. Recorded by ${req.user!.role} (${req.user!.fullName}).`,
            actorId: req.user!.id,
            actorRole: req.user!.role,
          },
        });
      }
      return updated;
    });

    res.json({
      success: true,
      message: `Duty marked as ${status}.`,
      duty: {
        ...duty,
        date: duty.dutyDate,
        cadet: {
          ...duty.cadet,
          name: duty.cadet.fullName,
          rank: duty.cadet.rank,
        },
      },
    });
  } catch (error) {
    console.error('updateDutyStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update duty status' });
  }
};
