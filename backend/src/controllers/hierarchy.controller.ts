import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';

// 1. Senior Panel Cadets: strictly assigned cadets only
export const getMyAssignedCadets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const assignments = await prisma.seniorAssignment.findMany({
      where: { seniorId: req.user.id },
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
            status: true,
            dateOfJoining: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    res.json({
      success: true,
      senior: {
        id: req.user.id,
        fullName: req.user.fullName,
        regimentalNumber: req.user.regimentalNumber,
      },
      cadetCount: assignments.length,
      assignedCadets: assignments.map((a) => a.cadet),
    });
  } catch (error) {
    console.error('getMyAssignedCadets error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve assigned cadets' });
  }
};

// 2. Platoon Senior Cadets: strictly authorized platoon cadets only
export const getMyPlatoonCadets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const platoonName = req.user.platoonName;

    const cadets = await prisma.user.findMany({
      where: {
        platoonName,
        role: 'CADET',
      },
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        collegeRollNumber: true,
        email: true,
        year: true,
        branch: true,
        platoonName: true,
        status: true,
        dateOfJoining: true,
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({
      success: true,
      platoon: platoonName,
      platoonSenior: {
        id: req.user.id,
        fullName: req.user.fullName,
      },
      cadetCount: cadets.length,
      cadets,
    });
  } catch (error) {
    console.error('getMyPlatoonCadets error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve platoon cadets' });
  }
};

