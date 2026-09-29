import { Router } from 'express';
import { verifyDigitalId } from '../controllers/digitalId.controller';
const router = Router();
router.get('/:token', verifyDigitalId);
export default router;
