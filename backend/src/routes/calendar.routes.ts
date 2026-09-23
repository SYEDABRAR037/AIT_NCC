import { Router } from 'express';
import {
  getCalendarStream,
  createCalendarEvent,
} from '../controllers/calendar.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// All authenticated roles (Cadet, Senior, Platoon Senior, Admin) can view
router.get('/', getCalendarStream);
router.get('/events', getCalendarStream);

// Only officers can create new calendar events
router.post('/', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), createCalendarEvent);
router.post('/events', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), createCalendarEvent);

export default router;
