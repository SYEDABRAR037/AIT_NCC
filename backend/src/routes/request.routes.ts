import { Router } from 'express';
import {
  submitRequest,
  getMyRequests,
  cancelRequest,
  getOfficerRequests,
  processRequestAction,
  submitOfficialInquiry,
  getInquiryList,
  getInquiryThread,
  replyToInquiry,
  updateInquiryStatus,
} from '../controllers/request.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Cadet standard requests
router.post('/submit', requireRole(['CADET', 'SENIOR', 'PLATOON_SENIOR']), submitRequest);
router.get('/my', getMyRequests);
router.post('/:id/cancel', cancelRequest);

// Officer standard requests
router.get('/officer', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), getOfficerRequests);
router.get('/officer/pending', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), getOfficerRequests);
router.post('/:id/action', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), processRequestAction);

// Official Command Desk Inquiries & Threaded Communications (Phase 14)
router.post('/inquiry', submitOfficialInquiry);
router.get('/inquiries', getInquiryList);
router.get('/inquiry/:id', getInquiryThread);
router.post('/inquiry/:id/reply', replyToInquiry);
router.patch('/inquiry/:id/status', requireRole(['SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']), updateInquiryStatus);

export default router;
