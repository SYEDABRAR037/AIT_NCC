import { Router, RequestHandler } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { createPerformanceAssessment, getPerformance } from '../controllers/performance.controller';

const router = Router();
const asyncRoute = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
router.use(authenticateToken);
router.get('/me', requireRole(['CADET']), asyncRoute(getPerformance));
router.post('/assessments', requireRole(['ADMIN_ANO', 'DRILL_INSTRUCTOR', 'PLATOON_SENIOR', 'SENIOR']), asyncRoute(createPerformanceAssessment));
router.get('/:cadetId', requireRole(['ADMIN_ANO', 'DRILL_INSTRUCTOR', 'PLATOON_SENIOR', 'SENIOR']), asyncRoute(getPerformance));
export default router;
