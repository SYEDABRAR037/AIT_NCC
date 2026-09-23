import { Request, Response } from 'express';
import { prisma } from '../db';

export const getPublicStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Strictly real database queries - no fake production hardcoded strength
    const approvedCadets = await prisma.user.count({
      where: {
        role: 'CADET',
        status: { in: ['APPROVED', 'ACTIVE'] },
      },
    });

    const platoons = await prisma.platoon.count();
    const upcomingEvents = await prisma.event.count({
      where: {
        isPublic: true,
        eventDate: { gte: new Date() },
      },
    });
    const totalCamps = await prisma.camp.count();
    const totalActivities = await prisma.achievement.count({
      where: { isPublic: true },
    });

    res.json({
      success: true,
      stats: {
        totalApprovedCadets: approvedCadets,
        platoonsCount: platoons,
        upcomingEventsCount: upcomingEvents,
        campsCount: totalCamps,
        activitiesCount: totalActivities,
      },
    });
  } catch (error) {
    console.error('Error fetching public stats:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve unit statistics' });
  }
};

export const getPublicNotices = async (_req: Request, res: Response): Promise<void> => {
  try {
    const notices = await prisma.notice.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json({ success: true, notices });
  } catch (error) {
    console.error('Error fetching notices:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve public notices' });
  }
};

export const getPublicEvents = async (_req: Request, res: Response): Promise<void> => {
  try {
    const events = await prisma.event.findMany({
      where: { isPublic: true },
      orderBy: { eventDate: 'asc' },
      take: 10,
    });
    res.json({ success: true, events });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve events' });
  }
};

export const getPublicAchievements = async (_req: Request, res: Response): Promise<void> => {
  try {
    const achievements = await prisma.achievement.findMany({
      where: { isPublic: true },
      orderBy: { dateAwarded: 'desc' },
      take: 10,
    });
    res.json({ success: true, achievements });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve achievements' });
  }
};

export const getPublicCamps = async (_req: Request, res: Response): Promise<void> => {
  try {
    const camps = await prisma.camp.findMany({
      orderBy: { startDate: 'asc' },
      take: 8,
      select: {
        id: true,
        name: true,
        campType: true,
        location: true,
        startDate: true,
        endDate: true,
        description: true,
        capacity: true,
      },
    });
    res.json({ success: true, camps });
  } catch (error) {
    console.error('Error fetching public camps:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve camps' });
  }
};
