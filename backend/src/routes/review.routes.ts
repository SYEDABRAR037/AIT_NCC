import { Router } from 'express';
import {
  getPendingApplications,
  getApplicationDetails,
  processReviewAction,
} from '../controllers/review.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['ADMIN_ANO', 'PLATOON_SENIOR', 'SENIOR']));

router.get('/pending', getPendingApplications);
router.get('/:cadetId/history', getApplicationDetails);
router.get('/application/:cadetId', getApplicationDetails);
router.get('/:cadetId', getApplicationDetails);
router.post('/:cadetId/action', processReviewAction);

export default router;
