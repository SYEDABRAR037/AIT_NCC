import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { createGalleryPhoto, deleteGalleryPhoto, getGalleryImage, getInstitutionalInfo, getRankHolderImage, listManagedGallery, listPublicGallery, listPublicRankHolders, manageRankHolder, updateGalleryPhoto, updateInstitutionalInfo } from '../controllers/media.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const mediaManagers = ['ADMIN_ANO', 'PLATOON_SENIOR', 'SENIOR'] as const;
const admins = ['ADMIN_ANO'] as const;
const parseImage = (req: Request, res: Response, next: NextFunction) => upload.single('image')(req, res, (error: any) => {
  if (error) { res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Image exceeds the 5 MB limit.' : 'Unable to process the uploaded image.' }); return; }
  next();
});

router.get('/public/gallery', listPublicGallery);
router.get('/public/gallery/:id/image', getGalleryImage);
router.get('/public/rank-holders', listPublicRankHolders);
router.get('/public/rank-holders/:id/image', getRankHolderImage);
router.get('/public/institutional-info', getInstitutionalInfo);

router.get('/gallery', authenticateToken, requireRole([...mediaManagers]), listManagedGallery);
router.post('/gallery', authenticateToken, requireRole([...mediaManagers]), parseImage, createGalleryPhoto);
router.put('/gallery/:id', authenticateToken, requireRole([...mediaManagers]), parseImage, updateGalleryPhoto);
router.delete('/gallery/:id', authenticateToken, requireRole([...mediaManagers]), deleteGalleryPhoto);
router.put('/rank-holders', authenticateToken, requireRole([...admins]), parseImage, manageRankHolder);
router.put('/institutional-info', authenticateToken, requireRole([...admins]), updateInstitutionalInfo);

export default router;
