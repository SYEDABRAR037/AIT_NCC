import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller';
import {
  requestPasswordResetOtp,
  resendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
} from '../controllers/recovery.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { requestRegistrationOtp, resendAuthOtp, verifyRegistrationOtp, verifyLoginOtp } from '../controllers/otpAuth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/login/verify-otp', verifyLoginOtp);
router.post('/registration/request-otp', requestRegistrationOtp);
router.post('/registration/resend-otp', resendAuthOtp);
router.post('/otp/resend', resendAuthOtp);
router.post('/registration/verify-otp', verifyRegistrationOtp);
router.post('/logout', logout);
router.get('/me', authenticateToken, getMe);

// Password Recovery & OTP routes (Phases 8-19)
router.post('/recovery/request-otp', requestPasswordResetOtp);
router.post('/recovery/resend-otp', resendPasswordResetOtp);
router.post('/recovery/verify-otp', verifyPasswordResetOtp);
router.post('/recovery/reset-password', resetPassword);

// Aliases
router.post('/forgot-password', requestPasswordResetOtp);
router.post('/verify-otp', verifyPasswordResetOtp);
router.post('/reset-password', resetPassword);

export default router;
