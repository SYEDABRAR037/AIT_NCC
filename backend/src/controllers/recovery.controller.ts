import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { recoveryOtpDispatcher } from '../services/recoveryOtpDispatcher';
import { ProcessLocalRateLimitStore } from '../services/rateLimitStore';

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
const requestLimits = new ProcessLocalRateLimitStore(10_000);
const isRateLimited = async (key: string, max: number, windowMs: number): Promise<boolean> => {
  return (await requestLimits.consume(key, max, windowMs)).limited;
};

const rateLimitRequest = async (req: Request, res: Response, bucket: string, max: number, windowMs: number): Promise<boolean> => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!(await isRateLimited(`${bucket}:${ip}`, max, windowMs))) return false;
  res.status(429).json({ success: false, message: 'Please wait before trying again.' });
  return true;
};

// 1. Request Password Reset OTP (Phase 8, 9, 10, 11, 12, 13)
export const requestPasswordResetOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (await rateLimitRequest(req, res, 'request', 10, 10 * 60_000)) return;
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

    const user = await prisma.user.findFirst({
      where: {
        AND: [
          { email: { equals: cleanEmail, mode: 'insensitive' } },
          { regimentalNumber: { equals: cleanRegimental, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        regimentalNumber: true,
      },
    });

    const lookupHash = crypto.createHash('sha256').update(`${cleanEmail}\0${cleanRegimental}`).digest('hex');
    const recentRequest = await prisma.recoveryChallenge.findFirst({
      where: {
        lookupHash,
        createdAt: { gte: new Date(Date.now() - 45 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    const recentCount = await prisma.recoveryChallenge.count({
      where: { lookupHash, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
    });
    const accountLimited = recentCount >= 5 || Boolean(recentRequest) ||
      (user ? await isRateLimited(`account:${user.id}`, 5, 60 * 60_000) : false);
    const otpNumber = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otpNumber, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const now = new Date();
    const challenge = await prisma.recoveryChallenge.create({
      data: {
        userId: user && !accountLimited ? user.id : null,
        lookupHash,
        otpHash,
        expiresAt,
        attemptCount: 0,
        lastSentAt: now,
        deliveryStatus: user && !accountLimited ? 'QUEUED' : 'SUPPRESSED',
      },
    });
    // Send after the same generic response for known, unknown, cooldown, and provider-error cases.
    // The challenge row records eventual provider outcome without exposing it to the requester.
    if (user && !accountLimited) {
      void recoveryOtpDispatcher.dispatch({ recipientEmail: user.email, cadetName: user.fullName, otp: otpNumber })
        .then(async (sent) => {
          await prisma.recoveryChallenge.updateMany({ where: { id: challenge.id, userId: user.id }, data: { deliveryStatus: sent ? 'SENT' : 'FAILED' } });
          if (sent) await prisma.auditLog.create({ data: { actorId: user.id, actorName: user.fullName || user.email, action: 'PASSWORD_RECOVERY_INITIATED', targetType: 'PASSWORD_RECOVERY', targetId: challenge.id } }).catch(() => {});
        })
        .catch(() => prisma.recoveryChallenge.updateMany({ where: { id: challenge.id, userId: user.id }, data: { deliveryStatus: 'FAILED' } }).catch(() => {}));
    }
    res.json({
      success: true,
      challengeAccepted: true,
      nextStep: 'VERIFY_OTP',
      message: 'If the details match an eligible account and delivery is available, a verification code will be sent to its registered email address.',
      recoveryId: challenge.id,
      verificationId: challenge.id,
      maskedEmail: maskEmail(cleanEmail),
      expiresAt: expiresAt.toISOString(),
      serverNow: now.toISOString(),
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
    if (await rateLimitRequest(req, res, 'resend', 10, 10 * 60_000)) return;
    const previous = await prisma.recoveryChallenge.findUnique({
      where: { id: String(req.body.recoveryId || '') },
      include: { user: true },
    });
    if (!previous || previous.usedAt || previous.verifiedAt || previous.expiresAt <= new Date()) {
      res.status(400).json({ success: false, message: 'This recovery request cannot be continued. Please request a new code.' });
      return;
    }
    if (Date.now() - previous.lastSentAt.getTime() < 45_000 || previous.sendCount >= 5) {
      res.status(429).json({ success: false, message: 'Please wait before requesting another code.' });
      return;
    }
    if (await isRateLimited(`resend-challenge:${previous.lookupHash}`, 5, 60 * 60_000)) {
      res.status(429).json({ success: false, message: 'Please wait 45 seconds before requesting a new code.' });
      return;
    }
    const otpNumber = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otpNumber, 10);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + OTP_TTL_MS);
    const updated = await prisma.recoveryChallenge.updateMany({
      where: { id: previous.id, usedAt: null, verifiedAt: null, sendCount: { lt: 5 }, lastSentAt: previous.lastSentAt },
      data: { otpHash, expiresAt, attemptCount: 0, sendCount: { increment: 1 }, lastSentAt: issuedAt, deliveryStatus: previous.userId ? 'QUEUED' : 'SUPPRESSED' },
    });
    if (updated.count !== 1) { res.status(429).json({ success: false, message: 'Please wait before requesting another code.' }); return; }
    if (previous.userId && previous.user) {
      void recoveryOtpDispatcher.dispatch({ recipientEmail: previous.user.email, cadetName: previous.user.fullName, otp: otpNumber })
        .then((sent) => prisma.recoveryChallenge.updateMany({ where: { id: previous.id, userId: previous.userId }, data: { deliveryStatus: sent ? 'SENT' : 'FAILED' } }))
        .catch(() => prisma.recoveryChallenge.updateMany({ where: { id: previous.id, userId: previous.userId }, data: { deliveryStatus: 'FAILED' } }));
    }
    res.json({ success: true, challengeAccepted: true, nextStep: 'VERIFY_OTP', message: 'If the details match an eligible account and delivery is available, a verification code will be sent to its registered email address.', recoveryId: previous.id, verificationId: previous.id, maskedEmail: 'your registered email', expiresAt: expiresAt.toISOString(), serverNow: issuedAt.toISOString() });
  } catch (error) {
    console.error('resendPasswordResetOtp error:', error);
    res.status(500).json({ success: false, message: 'Failed to resend verification OTP.' });
  }
};

// 3. Verify OTP (Phase 14, 15, 16)
export const verifyPasswordResetOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (await rateLimitRequest(req, res, 'verify', 30, 10 * 60_000)) return;
    const { recoveryId, otp } = req.body;

    if (!recoveryId || !otp) {
      res.status(400).json({
        success: false,
        message: 'Please provide both the recovery session ID and the 6-digit OTP.',
      });
      return;
    }

    const resetRecord = await prisma.recoveryChallenge.findUnique({
      where: { id: String(recoveryId) },
      include: { user: true },
    });

    if (!resetRecord) {
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
      await prisma.recoveryChallenge.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });
      res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.',
      });
      return;
    }

    // Check Brute-Force Attempt Limit: max 5 attempts (Phase 16)
    if (resetRecord.attemptCount >= 5) {
      await prisma.recoveryChallenge.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });
      res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.',
      });
      return;
    }

    // Verify OTP Hash (Phase 15)
    const cleanOtp = String(otp).trim();
    const isOtpValid = /^\d{6}$/.test(cleanOtp) && await bcrypt.compare(cleanOtp, resetRecord.otpHash);

    if (!isOtpValid) {
      await prisma.recoveryChallenge.updateMany({
        where: { id: resetRecord.id, usedAt: null, attemptCount: { lt: 5 } },
        data: { attemptCount: { increment: 1 } },
      });
      const updatedRecord = await prisma.recoveryChallenge.findUnique({ where: { id: resetRecord.id } });
      const updatedAttempts = updatedRecord?.attemptCount ?? 5;

      if (updatedAttempts >= 5) {
        await prisma.recoveryChallenge.updateMany({ where: { id: resetRecord.id, usedAt: null }, data: { usedAt: new Date() } });
        res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP. Please request a new one.',
        });
        return;
      }

      void updatedAttempts;
      res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.',
      });
      return;
    }

    if (!resetRecord.userId || !resetRecord.user) {
      res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please request a new one.' });
      return;
    }

    // Mark as verified
    const verifiedAt = new Date();
    const verified = await prisma.$transaction(async (tx) => {
      const result = await tx.recoveryChallenge.updateMany({
        where: { id: resetRecord.id, userId: resetRecord.userId, usedAt: null, verifiedAt: null, attemptCount: { lt: 5 }, expiresAt: { gt: verifiedAt } },
        data: { verifiedAt },
      });
      if (result.count === 1) {
        await tx.user.update({ where: { id: resetRecord.userId! }, data: { emailVerified: true } });
      }
      return result;
    });
    if (verified.count !== 1) {
      res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please request a new one.' });
      return;
    }

    // Generate temporary Reset Token (valid for 10 minutes)
    const secret = process.env.JWT_SECRET!;
    const resetToken = jwt.sign(
      {
        userId: resetRecord.userId!,
        recoveryId: resetRecord.id,
        purpose: 'PASSWORD_RESET',
      },
      secret,
      { expiresIn: '10m' }
    );

    // Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: resetRecord.userId!,
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
    if (await rateLimitRequest(req, res, 'reset', 10, 10 * 60_000)) return;
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
    const resetRecord = await prisma.recoveryChallenge.findUnique({
      where: { id: decoded.recoveryId },
      include: { user: true },
    });

    if (!resetRecord || !resetRecord.user || !resetRecord.userId || resetRecord.userId !== decoded.userId || !resetRecord.verifiedAt || resetRecord.usedAt) {
      res.status(400).json({
        success: false,
        message: 'This recovery session has already been concluded or is invalid.',
      });
      return;
    }
    const recoveryUserId = resetRecord.userId;
    const recoveryUser = resetRecord.user;

    // Hash the new password securely (Phase 3 & 18)
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Atomic transaction: update password, invalidate recovery records (Phases 18, 20, 21)
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.recoveryChallenge.updateMany({
        where: { id: resetRecord.id, userId: decoded.userId, verifiedAt: { not: null }, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error('Reset session already consumed');

      // 1. Update ONLY passwordHash — all profile, role, status, attendance, and assignment fields are preserved
      await tx.user.update({
        where: { id: recoveryUserId },
        data: { passwordHash: newPasswordHash },
      });

      // 2. Mark this reset record as used
      // 3. Invalidate any other active recovery records for this user
      await tx.recoveryChallenge.updateMany({
        where: {
          userId: recoveryUserId,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      // 4. Record Audit Log (Phase 27)
      await tx.auditLog.create({
        data: {
          actorId: recoveryUserId,
          actorName: recoveryUser.fullName || recoveryUser.email,
          action: 'PASSWORD_RESET_COMPLETED',
          targetType: 'USER_ACCOUNT',
          targetId: recoveryUserId,
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
