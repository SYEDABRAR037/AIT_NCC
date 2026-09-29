import { Router } from 'express';
import { promoteCadet } from '../controllers/rank.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.post('/cadets/:cadetId', requireRole(['ADMIN_ANO']), promoteCadet);

export default router;
