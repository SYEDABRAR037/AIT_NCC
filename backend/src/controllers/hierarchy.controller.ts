import { Response } from 'express';
import { AccountStatus } from '@prisma/client';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { getCadetLifecycleHistory, resolvePlatoonSeniorScope } from '../services/cadetLifecycle.service';

// 1. Senior Panel Cadets: strictly active assigned cadets only
export const getMyAssignedCadets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const assignments = await prisma.seniorAssignment.findMany({
      where: {
        seniorId: req.user.id,
        cadet: {
          role: 'CADET',
          status: 'ACTIVE', // Phase 9: strictly ACTIVE cadets
        },
      },
      include: {
        cadet: {
          select: {
            id: true,
            fullName: true,
            regimentalNumber: true,
            collegeRollNumber: true,
            email: true,
            phone: true,
            year: true,
            branch: true,
            platoonName: true,
            battalion: true,
            company: true,
            group: true,
            team: true,
            profilePhotoUrl: true,
            status: true,
            dateOfJoining: true,
            enrollmentDetails: true,
            mentorAssignment: {
              include: {
                senior: { select: { id: true, fullName: true, regimentalNumber: true } },
              },
            },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const assignedCadets = assignments.map((a) => a.cadet);

    res.json({
      success: true,
      senior: {
        id: req.user.id,
        fullName: req.user.fullName,
        regimentalNumber: req.user.regimentalNumber,
      },
      totalCadets: assignedCadets.length,
      cadetCount: assignedCadets.length,
      cadets: assignedCadets,
      assignedCadets,
    });
  } catch (error) {
    console.error('getMyAssignedCadets error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve assigned cadets' });
  }
};

// 2. Platoon Senior Cadets: strictly authorized active platoon cadets only
export const getMyPlatoonCadets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const targetPlatoons = req.user.role === 'ADMIN_ANO'
      ? []
      : await resolvePlatoonSeniorScope(req.user.id, req.user.platoonName);
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'ACTIVE';
    const allowedStatusFilters = ['ALL', 'ACTIVE', 'INACTIVE', 'PASSED_OUT'];
    if (!allowedStatusFilters.includes(statusFilter)) {
      res.status(400).json({ success: false, message: 'Invalid cadet status filter' });
      return;
    }
    const statusesByFilter: Record<string, AccountStatus[]> = {
      ALL: ['ACTIVE', 'APPROVED', 'INACTIVE', 'PASSED_OUT'],
      ACTIVE: ['ACTIVE'],
      INACTIVE: ['INACTIVE'],
      PASSED_OUT: ['PASSED_OUT'],
    };

    const cadets = await prisma.user.findMany({
      where: {
        role: 'CADET',
        status: { in: statusesByFilter[statusFilter] },
        ...(targetPlatoons.length > 0 ? { platoonName: { in: targetPlatoons } } : {}),
      },
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        collegeRollNumber: true,
        email: true,
        phone: true,
        year: true,
        branch: true,
        platoonName: true,
        battalion: true,
        company: true,
        group: true,
        team: true,
        profilePhotoUrl: true,
        status: true,
        dateOfJoining: true,
        enrollmentDetails: true,
        mentorAssignment: {
          include: {
            senior: { select: { id: true, fullName: true, regimentalNumber: true } },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const lifecycleHistoryByCadet = await getCadetLifecycleHistory(cadets.map((cadet) => cadet.id));
    const cadetsWithHistory = cadets.map((cadet) => {
      const lifecycleHistory = lifecycleHistoryByCadet.get(cadet.id) || [];
      const statusDetails = ['INACTIVE', 'PASSED_OUT'].includes(cadet.status)
        ? lifecycleHistory.find((event) => event.newStatus === cadet.status) || null
        : null;
      return { ...cadet, lifecycleHistory, statusDetails };
    });

    res.json({
      success: true,
      platoon: targetPlatoons.length > 0 ? targetPlatoons.join(', ') : 'All authorized unit platoons',
      platoonSenior: {
        id: req.user.id,
        fullName: req.user.fullName,
      },
      totalCadets: cadetsWithHistory.length,
      cadetCount: cadetsWithHistory.length,
      cadets: cadetsWithHistory,
    });
  } catch (error) {
    console.error('getMyPlatoonCadets error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve platoon cadets' });
  }
};
