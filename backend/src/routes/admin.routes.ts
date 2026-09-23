import { Router } from 'express';
import {
  listUsers,
  updateUserRole,
  updateUserStatus,
  transferCadetPlatoon,
  assignCadetToSenior,
  assignPlatoonSenior,
  getAdminDashboardSummary,
  getAdminLeaves,
  decideCadetLeave,
  getAdminCamps,
  createAdminCamp,
  deleteAdminCamp,
  getAdminEvents,
  createAdminEvent,
  deleteAdminEvent,
  getAdminNotices,
  createAdminNotice,
  deleteAdminNotice,
  getAdminAuditLogs,
  bulkImportCadets,
} from '../controllers/admin.controller';
import {
  getPendingApplications,
  processReviewAction,
} from '../controllers/review.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Strict server-side RBAC: All admin routes require ADMIN_ANO
router.use(authenticateToken);
router.use(requireRole(['ADMIN_ANO']));

router.get('/dashboard', getAdminDashboardSummary);
router.get('/pending-reviews', getPendingApplications);
router.post('/review-registration', processReviewAction);
router.get('/users', listUsers);
router.post('/import-cadets', bulkImportCadets);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/platoon', transferCadetPlatoon);
router.post('/assignments/senior', assignCadetToSenior);
router.post('/assignments/platoon-senior', assignPlatoonSenior);

router.get('/leaves', getAdminLeaves);
router.patch('/leaves/:id/decision', decideCadetLeave);

router.get('/camps', getAdminCamps);
router.post('/camps', createAdminCamp);
router.delete('/camps/:id', deleteAdminCamp);

router.get('/events', getAdminEvents);
router.post('/events', createAdminEvent);
router.delete('/events/:id', deleteAdminEvent);

router.get('/notices', getAdminNotices);
router.post('/notices', createAdminNotice);
router.delete('/notices/:id', deleteAdminNotice);
router.get('/audit-logs', getAdminAuditLogs);

export default router;
