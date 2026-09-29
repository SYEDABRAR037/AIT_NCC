import { Router } from 'express';
import { getPendingActions } from '../controllers/pendingActions.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.get('/pending-actions', getPendingActions);

export default router;
