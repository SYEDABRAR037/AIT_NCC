import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { sendOtpEmail } from '../services/mail.service';

const maskEmail = (email: string): string => {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 8))}${local[local.length - 1]}@${domain}`;
};

// 1. Request Password Reset OTP (Phase 8, 9, 10, 11, 12, 13)
export const requestPasswordResetOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, regimentalNumber } = req.body;

    if (!email || !regimentalNumber) {
      res.status(400).json({
        success: false,
        message: 'Please provide both your registered email address and regimental number.',
      });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanRegimental = String(regimentalNumber).trim().toUpperCase();

    console.log('[RECOVERY] RECOVERY_REQUEST_RECEIVED:', {
      email: maskEmail(cleanEmail),
      regimentalNumber: cleanRegimental,
    });

    console.log('[RECOVERY] IDENTIFIER_VERIFICATION_STARTED');

    // Verify account: Both email and regimental number must match the same user account
    const user = await prisma.user.findFirst({
      where: {
        AND: [
          { email: { equals: cleanEmail, mode: 'insensitive' } },
          { regimentalNumber: { equals: cleanRegimental, mode: 'insensitive' } },
        ],
      },
    });

    if (!user) {
      console.warn('[RECOVERY] IDENTIFIER_VERIFICATION_FAILED: No matching account found for provided identifiers.');
      // Generic error to avoid account enumeration (Phase 9)
      res.status(400).json({
        success: false,
        message: 'Unable to verify the provided account details.',
      });
      return;
    }

    console.log('[RECOVERY] IDENTIFIER_VERIFICATION_COMPLETED:', { userId: user.id });

    // Cooldown check: prevent rapid spamming (Phase 26)
    const recentRequest = await prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - 45 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentRequest) {
      console.warn('[RECOVERY] RECOVERY_RATE_LIMITED: Cooldown active.');
      res.status(429).json({
        success: false,
        message: 'Please wait 45 seconds before requesting another verification code.',
      });
      return;
    }

    // Generate cryptographically secure 6-digit OTP (Phase 10)
    const otpNumber = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otpNumber, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity
    console.log('[RECOVERY] OTP_GENERATED');

    // Invalidate existing unused OTP records for this user (Phase 10)
    await prisma.passwordReset.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Create persistent PasswordReset record
    const resetRecord = await prisma.passwordReset.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt,
        attemptCount: 0,
        lastResendAt: new Date(),
      },
    });
    console.log('[RECOVERY] OTP_RECORD_SAVED:', { recoveryId: resetRecord.id });

    // Send official OTP email (Phase 3, 7, 8, 9, 11, 12, 13)
    const emailResult = await sendOtpEmail({
      recipientEmail: user.email,
      cadetName: user.fullName,
      otp: otpNumber,
      expiresInMinutes: 5,
    });

    if (!emailResult.success) {
      console.warn('[RECOVERY] RECOVERY_ERROR: Email provider delivery failed. Rolling back OTP record.');
      // Phase 9: DO NOT SHOW FALSE SUCCESS. If provider fails, delete OTP record and return error
      await prisma.passwordReset.delete({
        where: { id: resetRecord.id },
      }).catch(() => {});

      res.status(503).json({
        success: false,
        message: 'Unable to send the verification email right now. Please try again.',
      });
      return;
    }

    // Audit Log (Phase 27)
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.fullName || user.email,
        action: 'PASSWORD_RECOVERY_INITIATED',
        targetType: 'PASSWORD_RECOVERY',
        targetId: resetRecord.id,
        details: JSON.stringify({
          email: maskEmail(user.email),
          expiresAt,
        }),
      },
    });

    console.log('[RECOVERY] RECOVERY_RESPONSE_SENT:', { recoveryId: resetRecord.id });
    res.json({
      success: true,
      message: 'A verification code has been dispatched to your official registered email address.',
      recoveryId: resetRecord.id,
      maskedEmail: maskEmail(user.email),
      expiresInSeconds: 300,
    });
  } catch (error: any) {
    console.error('[RECOVERY] RECOVERY_ERROR:', error?.message || error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate password recovery. Please try again later.',
    });
  }
};

// 2. Resend Password Reset OTP (Phase 17)
export const resendPasswordResetOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { recoveryId } = req.body;

    if (!recoveryId) {
      res.status(400).json({ success: false, message: 'Recovery session ID required.' });
      return;
    }

    const previousReset = await prisma.passwordReset.findUnique({
      where: { id: String(recoveryId) },
      include: { user: true },
    });

    if (!previousReset || !previousReset.user) {
      res.status(400).json({ success: false, message: 'Invalid or expired recovery session.' });
      return;
    }

    // Cooldown check (Phase 17: 30-60 seconds cooldown)
    const cooldownMs = 45 * 1000;
    const timeSinceLast = Date.now() - new Date(previousReset.lastResendAt).getTime();
    if (timeSinceLast < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - timeSinceLast) / 1000);
      res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} seconds before requesting a new OTP.`,
      });
      return;
    }

    // Invalidate old OTP (Phase 17)
    await prisma.passwordReset.update({
      where: { id: previousReset.id },
      data: { usedAt: new Date() },
    });

    // Generate new OTP
    const otpNumber = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otpNumber, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const newResetRecord = await prisma.passwordReset.create({
      data: {
        userId: previousReset.userId,
        otpHash,
        expiresAt,
        attemptCount: 0,
        lastResendAt: new Date(),
      },
    });

    // Send new OTP email
    const emailResult = await sendOtpEmail({
      recipientEmail: previousReset.user.email,
      cadetName: previousReset.user.fullName,
      otp: otpNumber,
      expiresInMinutes: 5,
    });

    if (!emailResult.success) {
      console.warn('[RECOVERY] Resend OTP email delivery failed. Aborting recovery update.');
      await prisma.passwordReset.delete({
        where: { id: newResetRecord.id },
      }).catch(() => {});

      res.status(503).json({
        success: false,
        message: 'Unable to send the verification email right now. Please try again.',
      });
      return;
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: previousReset.userId,
        actorName: previousReset.user.fullName || previousReset.user.email,
        action: 'PASSWORD_RECOVERY_OTP_RESENT',
        targetType: 'PASSWORD_RECOVERY',
        targetId: newResetRecord.id,
        details: JSON.stringify({
          previousRecoveryId: previousReset.id,
          expiresAt,
        }),
      },
    });

    res.json({
      success: true,
      message: 'A fresh verification OTP has been dispatched to your registered email address.',
      recoveryId: newResetRecord.id,
      maskedEmail: maskEmail(previousReset.user.email),
      expiresInSeconds: 300,
    });
  } catch (error) {
    console.error('resendPasswordResetOtp error:', error);
    res.status(500).json({ success: false, message: 'Failed to resend verification OTP.' });
  }
};

// 3. Verify OTP (Phase 14, 15, 16)
export const verifyPasswordResetOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { recoveryId, otp } = req.body;

    if (!recoveryId || !otp) {
      res.status(400).json({
        success: false,
        message: 'Please provide both the recovery session ID and the 6-digit OTP.',
      });
      return;
    }

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { id: String(recoveryId) },
      include: { user: true },
    });

    if (!resetRecord || !resetRecord.user) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired recovery session. Please request a new OTP.',
      });
      return;
    }

    // Check if already used
    if (resetRecord.usedAt) {
      res.status(400).json({
        success: false,
        message: 'This OTP has already been utilized. Please request a new verification code.',
      });
      return;
    }

    // Check expiration (Phase 15)
    if (new Date() > new Date(resetRecord.expiresAt)) {
      await prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });
      res.status(400).json({
        success: false,
        message: 'The verification OTP has expired. Please request a new one.',
      });
      return;
    }

    // Check Brute-Force Attempt Limit: max 5 attempts (Phase 16)
    if (resetRecord.attemptCount >= 5) {
      await prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });
      res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new OTP.',
      });
      return;
    }

    // Verify OTP Hash (Phase 15)
    const cleanOtp = String(otp).trim();
    const isOtpValid = await bcrypt.compare(cleanOtp, resetRecord.otpHash);

    if (!isOtpValid) {
      const updatedAttempts = resetRecord.attemptCount + 1;
      await prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: {
          attemptCount: updatedAttempts,
          usedAt: updatedAttempts >= 5 ? new Date() : null,
        },
      });

      if (updatedAttempts >= 5) {
        res.status(429).json({
          success: false,
          message: 'Too many incorrect attempts. Please request a new OTP.',
        });
        return;
      }

      const remainingAttempts = 5 - updatedAttempts;
      res.status(400).json({
        success: false,
        message: `Invalid OTP. Please check the code and try again. (${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining)`,
      });
      return;
    }

    // Mark as verified
    await prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { verifiedAt: new Date() },
    });

    // Generate temporary Reset Token (valid for 10 minutes)
    const secret = process.env.JWT_SECRET || 'ncc_command_jwt_super_secure_key_2026_ait_pune';
    const resetToken = jwt.sign(
      {
        userId: resetRecord.userId,
        recoveryId: resetRecord.id,
        purpose: 'PASSWORD_RESET',
      },
      secret,
      { expiresIn: '10m' }
    );

    // Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: resetRecord.userId,
        actorName: resetRecord.user.fullName || resetRecord.user.email,
        action: 'PASSWORD_RECOVERY_OTP_VERIFIED',
        targetType: 'PASSWORD_RECOVERY',
        targetId: resetRecord.id,
      },
    });

    res.json({
      success: true,
      message: 'OTP verified successfully. You may now create your new password.',
      resetToken,
    });
  } catch (error) {
    console.error('verifyPasswordResetOtp error:', error);
    res.status(500).json({ success: false, message: 'OTP verification failed. Please try again.' });
  }
};

// 4. Reset Password (Phase 18, 19, 20, 21)
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Please provide the reset token and your new password.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'New password and confirmation password do not match.',
      });
      return;
    }

    if (String(newPassword).length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters in length.',
      });
      return;
    }

    // Verify reset token
    const secret = process.env.JWT_SECRET || 'ncc_command_jwt_super_secure_key_2026_ait_pune';
    let decoded: any;
    try {
      decoded = jwt.verify(resetToken, secret);
    } catch (tokenErr) {
      res.status(401).json({
        success: false,
        message: 'Password reset session has expired or is invalid. Please initiate recovery again.',
      });
      return;
    }

    if (decoded.purpose !== 'PASSWORD_RESET' || !decoded.userId || !decoded.recoveryId) {
      res.status(400).json({ success: false, message: 'Invalid password recovery token.' });
      return;
    }

    // Verify that the recovery record was verified and not yet used
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { id: decoded.recoveryId },
      include: { user: true },
    });

    if (!resetRecord || !resetRecord.verifiedAt || resetRecord.usedAt) {
      res.status(400).json({
        success: false,
        message: 'This recovery session has already been concluded or is invalid.',
      });
      return;
    }

    // Hash the new password securely (Phase 3 & 18)
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Atomic transaction: update password, invalidate recovery records (Phases 18, 20, 21)
    await prisma.$transaction(async (tx) => {
      // 1. Update ONLY passwordHash — all profile, role, status, attendance, and assignment fields are preserved
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      });

      // 2. Mark this reset record as used
      await tx.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });

      // 3. Invalidate any other active recovery records for this user
      await tx.passwordReset.updateMany({
        where: {
          userId: resetRecord.userId,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      // 4. Record Audit Log (Phase 27)
      await tx.auditLog.create({
        data: {
          actorId: resetRecord.userId,
          actorName: resetRecord.user.fullName || resetRecord.user.email,
          action: 'PASSWORD_RESET_COMPLETED',
          targetType: 'USER_ACCOUNT',
          targetId: resetRecord.userId,
          details: JSON.stringify({
            recoveryId: resetRecord.id,
            completedAt: new Date(),
          }),
        },
      });
    });

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new credentials.',
    });
  } catch (error) {
    console.error('resetPassword error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password. Please try again.' });
  }
};
