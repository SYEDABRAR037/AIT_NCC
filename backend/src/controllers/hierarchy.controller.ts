import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';

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

    // Determine platoon scope for Platoon Senior
    const targetPlatoons: string[] = [];
    if (req.user.platoonName) {
      targetPlatoons.push(req.user.platoonName);
    }

    const platoonAssignments = await prisma.platoonSeniorAssignment.findMany({
      where: { platoonSeniorId: req.user.id },
      include: { platoon: true },
    });
    for (const pa of platoonAssignments) {
      if (pa.platoon?.name && !targetPlatoons.includes(pa.platoon.name)) {
        targetPlatoons.push(pa.platoon.name);
      }
    }

    if (targetPlatoons.length === 0) {
      targetPlatoons.push('Senior Division');
    }

    const cadets = await prisma.user.findMany({
      where: {
        role: 'CADET',
        status: 'ACTIVE', // Phase 9: strictly ACTIVE cadets
        platoonName: { in: targetPlatoons },
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

    res.json({
      success: true,
      platoon: targetPlatoons.join(', '),
      platoonSenior: {
        id: req.user.id,
        fullName: req.user.fullName,
      },
      totalCadets: cadets.length,
      cadetCount: cadets.length,
      cadets,
    });
  } catch (error) {
    console.error('getMyPlatoonCadets error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve platoon cadets' });
  }
};

