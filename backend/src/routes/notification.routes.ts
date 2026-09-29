import { Router } from 'express';
import { getMyNotifications, getNotificationPreferences, getVapidPublicKey, markAllNotificationsAsRead, markNotificationAsRead, registerPushSubscription, revokePushSubscription, updateNotificationPreferences } from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/my', getMyNotifications);
router.get('/preferences', getNotificationPreferences);
router.put('/preferences', updateNotificationPreferences);
router.get('/push/public-key', getVapidPublicKey);
router.post('/push/subscription', registerPushSubscription);
router.delete('/push/subscription', revokePushSubscription);
router.patch('/read-all', markAllNotificationsAsRead);
router.patch('/:id/read', markNotificationAsRead);

export default router;
