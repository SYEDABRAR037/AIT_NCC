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

const OTP_TTL_MS = 60_000;
const requestLimits = new Map<string, number[]>();
const dummySessions = new Map<string, { email: string; lastIssuedAt: number; issuedAtTimes: number[] }>();
const isRateLimited = (key: string, max: number, windowMs: number): boolean => {
  const now = Date.now();
  const recent = (requestLimits.get(key) || []).filter((time) => now - time < windowMs);
  if (recent.length >= max) {
    requestLimits.set(key, recent);
    return true;
  }
  recent.push(now);
  requestLimits.set(key, recent);
  return false;
};

const rateLimitRequest = (req: Request, res: Response, bucket: string, max: number, windowMs: number): boolean => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!isRateLimited(`${bucket}:${ip}`, max, windowMs)) return false;
  res.status(429).json({ success: false, message: 'Please wait before trying again.' });
  return true;
};

const respondWithGenericChallenge = (res: Response, email = 'your registered email address'): void => {
  const serverNow = new Date();
  const recoveryId = crypto.randomUUID();
  dummySessions.set(recoveryId, {
    email: email.includes('@') ? maskEmail(email) : email,
    lastIssuedAt: serverNow.getTime(),
    issuedAtTimes: [serverNow.getTime()],
  });
  res.json({
    success: true,
    challengeAccepted: true,
    nextStep: 'VERIFY_OTP',
    message: 'If the details match an account, a code was sent to its registered email address.',
    recoveryId,
    verificationId: recoveryId,
    maskedEmail: dummySessions.get(recoveryId)!.email,
    expiresAt: new Date(serverNow.getTime() + OTP_TTL_MS).toISOString(),
    serverNow: serverNow.toISOString(),
  });
};

// 1. Request Password Reset OTP (Phase 8, 9, 10, 11, 12, 13)
export const requestPasswordResetOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (rateLimitRequest(req, res, 'request', 10, 10 * 60_000)) return;
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
      respondWithGenericChallenge(res, cleanEmail);
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
      respondWithGenericChallenge(res, cleanEmail);
      return;
    }

    // Generate cryptographically secure 6-digit OTP (Phase 10)
    if (isRateLimited(`account:${user.id}`, 5, 60 * 60_000)) {
      respondWithGenericChallenge(res, cleanEmail);
      return;
    }
    const recentCount = await prisma.passwordReset.count({
      where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
    });
    if (recentCount >= 5) {
      respondWithGenericChallenge(res, cleanEmail);
      return;
    }

    const otpNumber = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otpNumber, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

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

    const issuedAt = new Date();
    const actualExpiresAt = new Date(issuedAt.getTime() + OTP_TTL_MS);
    await prisma.passwordReset.update({ where: { id: resetRecord.id }, data: { expiresAt: actualExpiresAt, lastResendAt: issuedAt } });

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
          expiresAt: actualExpiresAt,
        }),
      },
    });

    console.log('[RECOVERY] RECOVERY_RESPONSE_SENT:', { recoveryId: resetRecord.id });
    res.json({
      success: true,
      challengeAccepted: true,
      nextStep: 'VERIFY_OTP',
      message: 'If the details match an account, a code was sent to its registered email address.',
      recoveryId: resetRecord.id,
      verificationId: resetRecord.id,
      maskedEmail: maskEmail(user.email),
      expiresAt: actualExpiresAt.toISOString(),
      serverNow: issuedAt.toISOString(),
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
    if (rateLimitRequest(req, res, 'resend', 10, 10 * 60_000)) return;
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
      const dummy = dummySessions.get(String(recoveryId));
      if (!dummy || Date.now() - dummy.lastIssuedAt < 45_000) {
        res.status(429).json({ success: false, message: 'Please wait 45 seconds before requesting a new code.' });
        return;
      }
      const recentDummyIssues = dummy.issuedAtTimes.filter((time) => Date.now() - time < 60 * 60_000);
      if (recentDummyIssues.length >= 5) {
        res.status(429).json({ success: false, message: 'Please wait before requesting another code.' });
        return;
      }
      const serverNow = new Date();
      const nextId = crypto.randomUUID();
      const expiresAt = new Date(serverNow.getTime() + OTP_TTL_MS);
      dummySessions.delete(String(recoveryId));
      dummySessions.set(nextId, { email: dummy.email, lastIssuedAt: serverNow.getTime(), issuedAtTimes: [...recentDummyIssues, serverNow.getTime()] });
      res.json({
        success: true,
        challengeAccepted: true,
        nextStep: 'VERIFY_OTP',
        message: 'If the details match an account, a code was sent to its registered email address.',
        recoveryId: nextId,
        verificationId: nextId,
        maskedEmail: dummy.email,
        expiresAt: expiresAt.toISOString(),
        serverNow: serverNow.toISOString(),
      });
      return;
    }

    // Cooldown check (Phase 17: 30-60 seconds cooldown)
    const cooldownMs = 45 * 1000;
    const timeSinceLast = Date.now() - new Date(previousReset.lastResendAt).getTime();
    if (timeSinceLast < cooldownMs) {
      res.status(429).json({
        success: false,
        message: 'Please wait 45 seconds before requesting a new code.',
      });
      return;
    }
    const issuedLastHour = await prisma.passwordReset.count({
      where: { userId: previousReset.userId, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
    });
    if (issuedLastHour >= 5) {
      res.status(429).json({ success: false, message: 'Please wait before requesting another code.' });
      return;
    }
    if (isRateLimited(`resend-account:${previousReset.userId}`, 5, 60 * 60_000)) {
      res.status(429).json({ success: false, message: 'Please wait 45 seconds before requesting a new code.' });
      return;
    }

    // Invalidate old OTP (Phase 17)
    await prisma.passwordReset.update({
      where: { id: previousReset.id },
      data: { usedAt: new Date() },
    });

    // Generate new OTP
    const otpNumber = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otpNumber, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

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

    const issuedAt = new Date();
    const actualExpiresAt = new Date(issuedAt.getTime() + OTP_TTL_MS);
    await prisma.passwordReset.update({ where: { id: newResetRecord.id }, data: { expiresAt: actualExpiresAt, lastResendAt: issuedAt } });

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
          expiresAt: actualExpiresAt,
        }),
      },
    });

    res.json({
      success: true,
      challengeAccepted: true,
      nextStep: 'VERIFY_OTP',
      message: 'If the details match an account, a code was sent to its registered email address.',
      recoveryId: newResetRecord.id,
      verificationId: newResetRecord.id,
      maskedEmail: maskEmail(previousReset.user.email),
      expiresAt: actualExpiresAt.toISOString(),
      serverNow: issuedAt.toISOString(),
    });
  } catch (error) {
    console.error('resendPasswordResetOtp error:', error);
    res.status(500).json({ success: false, message: 'Failed to resend verification OTP.' });
  }
};

// 3. Verify OTP (Phase 14, 15, 16)
export const verifyPasswordResetOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (rateLimitRequest(req, res, 'verify', 30, 10 * 60_000)) return;
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
        message: 'Invalid or expired OTP. Please request a new one.',
      });
      return;
    }

    // Check if already used
    if (resetRecord.usedAt) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.',
      });
      return;
    }

    // Check expiration (Phase 15)
    if (Date.now() >= new Date(resetRecord.expiresAt).getTime()) {
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
    const isOtpValid = /^\d{6}$/.test(cleanOtp) && await bcrypt.compare(cleanOtp, resetRecord.otpHash);

    if (!isOtpValid) {
      await prisma.passwordReset.updateMany({
        where: { id: resetRecord.id, usedAt: null, attemptCount: { lt: 5 } },
        data: { attemptCount: { increment: 1 } },
      });
      const updatedRecord = await prisma.passwordReset.findUnique({ where: { id: resetRecord.id } });
      const updatedAttempts = updatedRecord?.attemptCount ?? 5;

      if (updatedAttempts >= 5) {
        await prisma.passwordReset.updateMany({ where: { id: resetRecord.id, usedAt: null }, data: { usedAt: new Date() } });
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
    const verified = await prisma.passwordReset.updateMany({
      where: {
        id: resetRecord.id,
        usedAt: null,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { verifiedAt: new Date() },
    });
    if (verified.count !== 1) {
      res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please request a new one.' });
      return;
    }

    // Generate temporary Reset Token (valid for 10 minutes)
    const secret = process.env.JWT_SECRET!;
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
      verified: true,
      nextStep: 'RESET_PASSWORD',
      status: 'OTP_VERIFIED',
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
    if (rateLimitRequest(req, res, 'reset', 10, 10 * 60_000)) return;
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
    const secret = process.env.JWT_SECRET!;
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

    if (!resetRecord || resetRecord.userId !== decoded.userId || !resetRecord.verifiedAt || resetRecord.usedAt) {
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
      const claimed = await tx.passwordReset.updateMany({
        where: { id: resetRecord.id, userId: decoded.userId, verifiedAt: { not: null }, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error('Reset session already consumed');

      // 1. Update ONLY passwordHash — all profile, role, status, attendance, and assignment fields are preserved
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      });

      // 2. Mark this reset record as used
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
      passwordReset: true,
      nextStep: 'LOGIN',
      status: 'PASSWORD_RESET_SUCCESS',
      message: 'Password reset successfully. You can now login with your new credentials.',
    });
  } catch (error) {
    console.error('resetPassword error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password. Please try again.' });
  }
};
