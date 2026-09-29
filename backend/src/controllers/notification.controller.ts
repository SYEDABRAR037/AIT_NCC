import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../db';
import { getPushPublicKey, removePushSubscription, storePushSubscription } from '../services/notificationDelivery.service';

export const getMyNotifications = async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (!user) { res.status(401).json({ success: false, message: 'Authentication required.' }); return; }
  try {
    const [notifications, receipts] = await Promise.all([
      prisma.notification.findMany({ where: { OR: [{ userId: user.id }, { userId: null, targetRole: user.role, fanoutAt: null }, { userId: null, targetRole: null, fanoutAt: null }] }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, userId: true, title: true, message: true, isRead: true, isUrgent: true, type: true, priority: true, referenceType: true, referenceId: true, emailStatus: true, pushStatus: true, createdAt: true } }),
      prisma.notificationRead.findMany({ where: { userId: user.id }, select: { notificationId: true } }),
    ]);
    const readIds = new Set(receipts.map((receipt) => receipt.notificationId));
    const normalized = notifications.map((notification) => ({ ...notification, isRead: notification.userId === user.id ? notification.isRead : readIds.has(notification.id) }));
    res.json({ success: true, notifications: normalized, unreadCount: normalized.filter((notification) => !notification.isRead).length });
  } catch (error) { console.error('getMyNotifications error:', error); res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' }); }
};

export const markNotificationAsRead = async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (!user) { res.status(401).json({ success: false, message: 'Authentication required.' }); return; }
  try {
    const notification = await prisma.notification.findFirst({ where: { id: String(req.params.id), OR: [{ userId: user.id }, { userId: null, targetRole: user.role, fanoutAt: null }, { userId: null, targetRole: null, fanoutAt: null }] }, select: { id: true, userId: true } });
    if (!notification) { res.status(404).json({ success: false, message: 'Notification not found.' }); return; }
    if (notification.userId === user.id) await prisma.notification.update({ where: { id: notification.id }, data: { isRead: true } });
    else await prisma.notificationRead.upsert({ where: { notificationId_userId: { notificationId: notification.id, userId: user.id } }, create: { notificationId: notification.id, userId: user.id }, update: { readAt: new Date() } });
    res.json({ success: true });
  } catch (error) { console.error('markNotificationAsRead error:', error); res.status(500).json({ success: false, message: 'Failed to update notification.' }); }
};

export const markAllNotificationsAsRead = async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (!user) { res.status(401).json({ success: false, message: 'Authentication required.' }); return; }
  try {
    const records = await prisma.notification.findMany({ where: { OR: [{ userId: user.id }, { userId: null, targetRole: user.role, fanoutAt: null }, { userId: null, targetRole: null, fanoutAt: null }] }, select: { id: true, userId: true, isRead: true } });
    const directIds = records.filter((record) => record.userId === user.id && !record.isRead).map((record) => record.id);
    const sharedIds = records.filter((record) => record.userId !== user.id).map((record) => record.id);
    await prisma.$transaction(async (tx) => {
      if (directIds.length) await tx.notification.updateMany({ where: { id: { in: directIds }, userId: user.id }, data: { isRead: true } });
      if (sharedIds.length) await tx.notificationRead.createMany({ data: sharedIds.map((notificationId) => ({ notificationId, userId: user.id })), skipDuplicates: true });
    });
    res.json({ success: true });
  } catch (error) { console.error('markAllNotificationsAsRead error:', error); res.status(500).json({ success: false, message: 'Failed to update notifications.' }); }
};

export const getNotificationPreferences = async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (!user) { res.status(401).json({ success: false, message: 'Authentication required.' }); return; }
  const preference = await prisma.notificationPreferences.findUnique({ where: { userId: user.id } });
  res.json({ success: true, preferences: { inAppEnabled: true, emailEnabled: preference?.emailEnabled ?? true, pushEnabled: preference?.pushEnabled ?? false } });
};

export const updateNotificationPreferences = async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (!user) { res.status(401).json({ success: false, message: 'Authentication required.' }); return; }
  if (typeof req.body.emailEnabled !== 'boolean' || typeof req.body.pushEnabled !== 'boolean') { res.status(400).json({ success: false, message: 'Set emailEnabled and pushEnabled as booleans.' }); return; }
  const preferences = await prisma.notificationPreferences.upsert({ where: { userId: user.id }, create: { userId: user.id, emailEnabled: req.body.emailEnabled, pushEnabled: req.body.pushEnabled }, update: { emailEnabled: req.body.emailEnabled, pushEnabled: req.body.pushEnabled } });
  res.json({ success: true, preferences: { inAppEnabled: true, emailEnabled: preferences.emailEnabled, pushEnabled: preferences.pushEnabled } });
};

export const getVapidPublicKey = async (_req: Request, res: Response): Promise<void> => {
  const publicKey = getPushPublicKey();
  if (!publicKey) { res.status(503).json({ success: false, message: 'Browser push is not configured.' }); return; }
  res.json({ success: true, publicKey });
};

export const registerPushSubscription = async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (!user) { res.status(401).json({ success: false, message: 'Authentication required.' }); return; }
  const subscription = req.body?.subscription;
  if (!getPushPublicKey() || !process.env.VAPID_PRIVATE_KEY || !process.env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY) { res.status(503).json({ success: false, message: 'Browser push is not configured on the server.' }); return; }
  let endpointHost = '';
  try { endpointHost = new URL(subscription?.endpoint).hostname.toLowerCase(); } catch { /* invalid endpoint */ }
  const trustedPushHost = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(endpointHost) || endpointHost.endsWith('.notify.windows.com');
  if (!trustedPushHost || typeof subscription?.keys?.p256dh !== 'string' || typeof subscription?.keys?.auth !== 'string' || subscription.keys.p256dh.length > 256 || subscription.keys.auth.length > 128) { res.status(400).json({ success: false, message: 'A valid browser push subscription is required.' }); return; }
  try { await storePushSubscription(user.id, subscription); res.status(201).json({ success: true }); }
  catch (error) { console.error('registerPushSubscription error:', error); res.status(500).json({ success: false, message: 'Unable to save push subscription.' }); }
};

export const revokePushSubscription = async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthRequest).user;
  if (!user) { res.status(401).json({ success: false, message: 'Authentication required.' }); return; }
  if (typeof req.body?.endpoint !== 'string' || !req.body.endpoint.startsWith('https://')) { res.status(400).json({ success: false, message: 'A valid subscription endpoint is required.' }); return; }
  let host = '';
  try { host = new URL(req.body.endpoint).hostname.toLowerCase(); } catch { /* invalid endpoint */ }
  if (!(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(host) || host.endsWith('.notify.windows.com'))) { res.status(400).json({ success: false, message: 'Invalid subscription endpoint.' }); return; }
  await removePushSubscription(user.id, req.body.endpoint);
  res.json({ success: true });
};
