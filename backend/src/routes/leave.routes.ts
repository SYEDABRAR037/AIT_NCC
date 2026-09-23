import { Router } from 'express';
import {
  submitLeave,
  getMyLeaves,
  getLeavesForReview,
  processLeaveAction,
  cancelLeave,
} from '../controllers/leave.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Cadet routes
router.post('/apply', requireRole(['CADET', 'SENIOR', 'PLATOON_SENIOR']), submitLeave);
router.get('/my', requireRole(['CADET', 'SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), getMyLeaves);
router.post('/:leaveId/cancel', requireRole(['CADET', 'SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), cancelLeave);

// Senior / Platoon Senior / Admin review
router.get(
  '/review',
  requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']),
  getLeavesForReview
);
router.get(
  '/pending',
  requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']),
  getLeavesForReview
);

router.patch(
  '/:leaveId/action',
  requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']),
  processLeaveAction
);
router.post(
  '/:leaveId/action',
  requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']),
  processLeaveAction
);
router.post(
  '/:leaveId/review',
  requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']),
  processLeaveAction
);

export default router;
