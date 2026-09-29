import { Router } from 'express';
import { getCadetDigitalId, getMyDigitalId } from '../controllers/digitalId.controller';
import { authenticateToken } from '../middleware/auth.middleware';
const router = Router();
router.use(authenticateToken);
router.get('/me', getMyDigitalId);
router.get('/:cadetId', getCadetDigitalId);
export default router;
