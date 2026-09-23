import { Router } from 'express';
import {
  getAdminCamps,
  createAdminCamp,
  deleteAdminCamp,
  applyForCamp,
  updateCampParticipantStatus,
} from '../controllers/admin.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// All authenticated roles can view unit camps
router.get('/', getAdminCamps);

// Cadet applies for camp nomination
router.post('/:id/apply', requireRole(['CADET', 'SENIOR', 'PLATOON_SENIOR']), applyForCamp);

// Platoon Senior, Senior, and Admin update participant status (Recommend / Select / Confirm / Complete)
router.patch('/:campId/participants/:cadetId', requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']), updateCampParticipantStatus);

// Admin only operations
router.post('/', requireRole(['ADMIN_ANO']), createAdminCamp);
router.delete('/:id', requireRole(['ADMIN_ANO']), deleteAdminCamp);

export default router;
