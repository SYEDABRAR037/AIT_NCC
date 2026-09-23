import { Router } from 'express';
import {
  getMyDuties,
  getUnitDuties,
  getAssignableCadets,
  assignDuty,
  updateDutyStatus,
} from '../controllers/duty.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Cadet route
router.get('/my', getMyDuties);

// Officer routes
router.get('/', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), getUnitDuties);
router.get('/unit', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), getUnitDuties);
router.get('/cadets', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), getAssignableCadets);
router.post('/assign', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), assignDuty);
router.patch('/:id/status', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), updateDutyStatus);

export default router;
