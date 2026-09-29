import { Router } from 'express';
import { getCadetServiceRecord } from '../controllers/serviceRecord.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.get('/me', requireRole(['CADET']), getCadetServiceRecord);
router.get('/:cadetId', requireRole(['ADMIN_ANO', 'DRILL_INSTRUCTOR', 'PLATOON_SENIOR', 'SENIOR']), getCadetServiceRecord);

export default router;
