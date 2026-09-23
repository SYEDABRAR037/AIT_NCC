import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getMyNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId: user.id },
          { targetRole: user.role },
          { userId: null, targetRole: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve notifications' });
  }
};

export const markNotificationAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.notification.update({
      where: { id: String(id) },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification status' });
  }
};
