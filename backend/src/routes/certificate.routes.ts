import { Router } from 'express';
import {
  issueCertificate,
  getMyCertificates,
  getAllCertificates,
  revokeCertificate,
  verifyCertificatePublic,
} from '../controllers/certificate.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Public verification endpoint (Unprotected - open for external verification)
router.get('/verify/:query', verifyCertificatePublic);

// Authenticated endpoints below
router.use(authenticateToken);

// Cadet views own certificates
router.get(
  '/my',
  requireRole(['CADET', 'SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']),
  getMyCertificates
);

// ANO / Admin management
router.post(
  '/issue',
  requireRole(['ADMIN_ANO']),
  issueCertificate
);

router.get(
  '/all',
  requireRole(['ADMIN_ANO']),
  getAllCertificates
);

router.get(
  '/vault',
  requireRole(['ADMIN_ANO']),
  getAllCertificates
);

router.patch(
  '/:id/revoke',
  requireRole(['ADMIN_ANO']),
  revokeCertificate
);

export default router;
