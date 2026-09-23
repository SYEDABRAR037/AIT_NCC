import { Router } from 'express';
import { getMyNotifications, markNotificationAsRead } from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/my', getMyNotifications);
router.patch('/:id/read', markNotificationAsRead);

export default router;
