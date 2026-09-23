import { Router } from 'express';
import {
  getPublicStats,
  getPublicNotices,
  getPublicEvents,
  getPublicAchievements,
  getPublicCamps,
} from '../controllers/public.controller';

const router = Router();

router.get('/stats', getPublicStats);
router.get('/notices', getPublicNotices);
router.get('/events', getPublicEvents);
router.get('/achievements', getPublicAchievements);
router.get('/camps', getPublicCamps);

export default router;
