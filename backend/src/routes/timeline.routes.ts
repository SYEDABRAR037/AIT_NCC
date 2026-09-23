import { Router } from 'express';
import {
  getMyTimeline,
  getCadetTimeline,
  getUnitTimeline,
} from '../controllers/timeline.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Cadet route: view own personal timeline
router.get('/my', getMyTimeline);

// Cadet specific inspection (with strict RBAC verification in controller)
router.get('/cadet/:cadetId', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), getCadetTimeline);

// Unit stream route: scoped to Admin (full unit), Platoon Senior (platoon cadets), and Senior (assigned cadets)
router.get('/unit', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), getUnitTimeline);
router.get('/all', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), getUnitTimeline);

export default router;
