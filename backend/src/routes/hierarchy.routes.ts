import { Router } from 'express';
import {
  getMyAssignedCadets,
  getMyPlatoonCadets,
} from '../controllers/hierarchy.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Senior scope: strictly assigned cadets
router.get('/senior/cadets', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), getMyAssignedCadets);
router.get('/assigned-cadets', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), getMyAssignedCadets);

// Platoon Senior scope: strictly authorized platoon cadets
router.get('/platoon-senior/cadets', requireRole(['PLATOON_SENIOR', 'ADMIN_ANO']), getMyPlatoonCadets);
router.get('/platoon-cadets', requireRole(['PLATOON_SENIOR', 'ADMIN_ANO']), getMyPlatoonCadets);

export default router;
