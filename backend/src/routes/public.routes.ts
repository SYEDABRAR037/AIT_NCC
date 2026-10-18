import { Router } from 'express';
import {
  getPublicStats,
  getPublicNotices,
  getPublicEvents,
  getPublicAchievements,
  getPublicCamps,
} from '../controllers/public.controller';
import {
  listPublicGallery,
  getGalleryImage,
  listPublicRankHolders,
  getRankHolderImage,
} from '../controllers/media.controller';

const router = Router();

router.get('/stats', getPublicStats);
router.get('/notices', getPublicNotices);
router.get('/events', getPublicEvents);
router.get('/achievements', getPublicAchievements);
router.get('/camps', getPublicCamps);
router.get('/gallery', listPublicGallery);
router.get('/gallery/:id/image', getGalleryImage);
router.get('/rank-holders', listPublicRankHolders);
router.get('/rank-holders/:id/image', getRankHolderImage);

export default router;
