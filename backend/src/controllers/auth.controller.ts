import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { OtpPurpose } from '@prisma/client';
import { startLoginOtp } from './otpAuth.controller';
import { normalizePhoneNumber } from '../services/attendanceNotification.service';
import { ProcessLocalRateLimitStore } from '../services/rateLimitStore';
import { validatePassword } from '../services/passwordPolicy';

const failedLoginAttempts = new ProcessLocalRateLimitStore(20_000);
const LOGIN_FAILURE_LIMIT = 10;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60_000;
// A process-random hash equalizes bcrypt work for nonexistent identifiers without a hardcoded password.
const dummyLoginHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

const loginIdentifierKey = (identifier: string): string =>
  `login:identifier:${crypto.createHash('sha256').update(identifier.toLowerCase()).digest('hex')}`;

export const recordLoginFailure = async (actorId?: string) => {
  try {
    await prisma.auditLog.create({ data: {
      actorId: actorId || 'UNKNOWN', actorName: actorId ? 'Account holder' : 'Unknown principal',
      action: 'AUTH_LOGIN_FAILED', targetType: 'AUTHENTICATION', targetId: actorId || null,
      // Do not persist the submitted identifier or a guessable hash of it.
      details: null,
    } });
  } catch {
    // Keep the audit failure visible without logging the submitted identifier or
    // provider/database error. The login handler returns a controlled 503.
    console.error('[SECURITY_AUDIT_FAILURE] Login failure audit could not be persisted.');
    throw Object.assign(new Error('Login failure audit unavailable'), { code: 'AUTH_AUDIT_UNAVAILABLE' });
  }
};

const rejectThrottledLogin = async (res: Response, key: string): Promise<boolean> => {
  // Atomically reserve a credential attempt before password verification. A shared
  // adapter must implement consume as one atomic check-and-increment operation.
  const result = await failedLoginAttempts.consume(key, LOGIN_FAILURE_LIMIT, LOGIN_FAILURE_WINDOW_MS);
  if (!result.limited) return false;
  res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
  res.status(429).json({ success: false, message: 'Too many unsuccessful sign-in attempts. Please try again later.' });
  return true;
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName,
      regimentalNumber,
      collegeRollNumber,
      email,
      phone,
      year,
      branch,
      platoon,
      enrollmentDetails,
      dateOfJoining,
      password,
      profilePhotoUrl,
      profilePhoto,
      mobileChallengeId,
      emailChallengeId,
    } = req.body;

    // 1. Required Field Validation
    if (!fullName || !regimentalNumber || !collegeRollNumber || !email || !phone || !password) {
      res.status(400).json({
        success: false,
        message: 'Missing mandatory registration fields: Full Name, Regimental No, Roll No, Email, Mobile, Password.',
      });
      return;
    }
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) { res.status(400).json({ success: false, field: 'password', message: passwordCheck.message }); return; }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedRegimental = regimentalNumber.trim().toUpperCase();
    const trimmedRoll = collegeRollNumber.trim().toUpperCase();
    const normalizedPhone = normalizePhoneNumber(String(phone));
    if (!normalizedPhone.isValid || !mobileChallengeId || !emailChallengeId) {
      res.status(400).json({ success: false, message: 'Valid mobile and email verification are required before submitting the application.' });
      return;
    }
    const now = new Date();
    const [mobileProof, emailProof] = await Promise.all([
      prisma.otpChallenge.findUnique({ where: { id: String(mobileChallengeId) } }),
      prisma.otpChallenge.findUnique({ where: { id: String(emailChallengeId) } }),
    ]);
    if (!mobileProof || mobileProof.purpose !== OtpPurpose.REGISTRATION_MOBILE || mobileProof.destination !== normalizedPhone.normalized || !mobileProof.verifiedAt || !mobileProof.proofExpiresAt || mobileProof.proofExpiresAt <= now || mobileProof.consumedAt || !emailProof || emailProof.purpose !== OtpPurpose.REGISTRATION_EMAIL || emailProof.destination !== trimmedEmail || !emailProof.verifiedAt || !emailProof.proofExpiresAt || emailProof.proofExpiresAt <= now || emailProof.consumedAt) {
      res.status(400).json({ success: false, message: 'Mobile and email verification are required before submitting the application.' });
      return;
    }

    // 3. Strict Duplicate Detection (Phase 11 & 14)
    const existingEmail = await prisma.user.findFirst({
      where: { email: { equals: trimmedEmail, mode: 'insensitive' } },
    });
    if (existingEmail) {
      res.status(409).json({
        success: false,
        field: 'email',
        message: 'This email is already registered.',
      });
      return;
    }

    const existingRegimental = await prisma.user.findFirst({
      where: { regimentalNumber: { equals: trimmedRegimental, mode: 'insensitive' } },
    });
    if (existingRegimental) {
      res.status(409).json({
        success: false,
        field: 'regimentalNumber',
        message: 'This regimental number is already registered.',
      });
      return;
    }

    const existingRoll = await prisma.user.findFirst({
      where: { collegeRollNumber: { equals: trimmedRoll, mode: 'insensitive' } },
    });
    if (existingRoll) {
      res.status(409).json({
        success: false,
        field: 'collegeRollNumber',
        message: 'This college roll number is already registered.',
      });
      return;
    }

    // 4. Password Hashing
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Profile photo normalization
    const finalProfilePhoto = profilePhotoUrl || profilePhoto || null;

    // 5. Atomic Registration Transaction (Phase 8 & 12)
    const [newUser] = await prisma.$transaction(async (tx) => {
      const mobileConsumed = await tx.otpChallenge.updateMany({ where: { id: mobileProof.id, purpose: OtpPurpose.REGISTRATION_MOBILE, verifiedAt: { not: null }, proofExpiresAt: { gt: now }, consumedAt: null }, data: { consumedAt: now } });
      const emailConsumed = await tx.otpChallenge.updateMany({ where: { id: emailProof.id, purpose: OtpPurpose.REGISTRATION_EMAIL, verifiedAt: { not: null }, proofExpiresAt: { gt: now }, consumedAt: null }, data: { consumedAt: now } });
      if (mobileConsumed.count !== 1 || emailConsumed.count !== 1) throw new Error('VERIFICATION_PROOF_INVALID');
      const user = await tx.user.create({
        data: {
          fullName: fullName.trim(),
          regimentalNumber: trimmedRegimental,
          collegeRollNumber: trimmedRoll,
          email: trimmedEmail,
          phone: normalizedPhone.normalized,
          mobileVerified: true,
          emailVerified: true,
          year: year || 'FE (1st Year)',
          branch: branch || 'Computer Engineering',
          platoonName: platoon || 'Senior Division',
          enrollmentDetails: enrollmentDetails ? enrollmentDetails.trim() : null,
          dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : new Date(),
          profilePhotoUrl: finalProfilePhoto,
          passwordHash,
          role: 'CADET', // Strictly CADET for public enrollment
          status: 'UNDER_REVIEW', // Account enters multi-tier review queue
        },
      });

      return [user];
    });

    console.log(`[REGISTRATION] New cadet registered: ID ${newUser.id}`);

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully. Your application is under institutional review.',
      userId: newUser.id,
      status: newUser.status,
      biometricEnrolled: false,
      profilePhotoSaved: Boolean(newUser.profilePhotoUrl),
    });
  } catch (error: any) {
    if (error?.message === 'VERIFICATION_PROOF_INVALID') {
      res.status(400).json({ success: false, message: 'Mobile and email verification are required before submitting the application.' });
      return;
    }
    console.error('Registration error:', error);

    // Specific Prisma Unique Constraint Error mapping
    if (error?.code === 'P2002') {
      const target = error.meta?.target;
      if (Array.isArray(target)) {
        if (target.includes('email')) {
          res.status(409).json({ success: false, field: 'email', message: 'This email is already registered.' });
          return;
        }
        if (target.includes('regimentalNumber')) {
          res.status(409).json({ success: false, field: 'regimentalNumber', message: 'This regimental number is already registered.' });
          return;
        }
        if (target.includes('collegeRollNumber')) {
          res.status(409).json({ success: false, field: 'collegeRollNumber', message: 'This college roll number is already registered.' });
          return;
        }
      }
    }

    res.status(500).json({
      success: false,
      message: 'Registration could not be completed due to a server error. Please try again later.',
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const identifier = req.body.identifier ?? req.body.email;
    const password = req.body.password;

    if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password || identifier.length > 256 || password.length > 1024) {
      res.status(400).json({
        success: false,
        message: 'Provide a valid regimental number or email and password.',
      });
      return;
    }

    const cleanIdentifier = identifier.trim();
    const identifierKey = loginIdentifierKey(cleanIdentifier);
    if (await rejectThrottledLogin(res, identifierKey)) return;

    // Query user by email, regimental number, or roll number with case-insensitivity (Phase 7)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: cleanIdentifier, mode: 'insensitive' } },
          { regimentalNumber: { equals: cleanIdentifier, mode: 'insensitive' } },
          { collegeRollNumber: { equals: cleanIdentifier, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        collegeRollNumber: true,
        email: true,
        phone: true,
        year: true,
        branch: true,
        platoonName: true,
        role: true,
        status: true,
        profilePhotoUrl: true,
        passwordHash: true,
        emailVerified: true,
        mobileVerified: true,
      },
    });

    if (!user) {
      await bcrypt.compare(password, dummyLoginHash);
      await recordLoginFailure();
      res.status(401).json({
        success: false,
        message: 'Invalid institutional credentials.',
      });
      return;
    }

    const accountKey = `login:account:${user.id}`;
    if (await rejectThrottledLogin(res, accountKey)) return;

    // Verify Password Hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await recordLoginFailure(user.id);
      res.status(401).json({
        success: false,
        message: 'Invalid institutional credentials.',
      });
      return;
    }

    await failedLoginAttempts.clear(identifierKey);
    await failedLoginAttempts.clear(accountKey);

    if (user.role === 'CADET') {
      // Cadets must use regimental number as the login identifier
      if (user.regimentalNumber.toLowerCase() !== cleanIdentifier.toLowerCase()) {
        res.status(401).json({ success: false, message: 'Use your regimental number to sign in.' });
        return;
      }
      if (user.status !== 'ACTIVE') {
        const statusMessage = user.status === 'UNDER_REVIEW' || user.status === 'ANO_REVIEW'
          ? 'Your registration is currently under review.'
          : user.status === 'REJECTED' ? 'Your registration has been rejected. Please contact the NCC administration.'
            : user.status === 'HOLD' || user.status === 'RETURNED' ? 'Your registration is on hold or needs correction.'
              : 'Your cadet account is not active.';
        res.status(403).json({ success: false, status: user.status, message: statusMessage });
        return;
      }
      // DEF-01: Cadet OTP challenge (unchanged)
      await startLoginOtp(req, user, res);
      return;
    }

    // ── Officer roles: ADMIN_ANO, SENIOR, PLATOON_SENIOR, DRILL_INSTRUCTOR ──
    // Status checks for officers
    if (user.status === 'UNDER_REVIEW' || user.status === 'ANO_REVIEW') {
      res.status(403).json({
        success: false,
        status: user.status,
        message: 'Your account is currently under review.',
      });
      return;
    }

    if (user.status === 'REJECTED') {
      res.status(403).json({
        success: false,
        status: 'REJECTED',
        message: 'Your account has been rejected. Please contact the NCC administration.',
      });
      return;
    }

    if (user.status === 'HOLD' || user.status === 'RETURNED') {
      res.status(403).json({
        success: false,
        status: user.status,
        message: 'Your account is on hold pending institutional review.',
      });
      return;
    }

    if (user.status === 'INACTIVE' || user.status === 'PASSED_OUT') {
      res.status(403).json({
        success: false,
        status: user.status,
        message: 'Your account is inactive.',
      });
      return;
    }

    // DEF-01: Officers also require OTP before a session is granted.
    // startLoginOtp will prefer the verified mobile channel if available,
    // otherwise falls back to email. Officers seeded without verified contacts
    // are handled: startLoginOtp sends to email even when emailVerified is false,
    // because officers' identity is pre-confirmed by the ANO during onboarding.
    await startLoginOtp(req, user, res);
    return;
  } catch (error) {
    if ((error as { code?: string })?.code === 'AUTH_AUDIT_UNAVAILABLE') {
      res.status(503).json({
        success: false,
        message: 'Authentication is temporarily unavailable. Please try again.',
      });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Institutional authentication error.',
    });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }
    res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve profile' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  const tokens = [
    authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined,
    req.cookies?.ncc_token,
  ].filter((token): token is string => Boolean(token));
  if (process.env.JWT_SECRET) {
    const revoked = new Set<string>();
    let revocationFailed = false;
    for (const token of tokens) {
      let decoded: { userId?: string; sid?: string };
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId?: string; sid?: string };
      } catch {
        // Logout remains idempotent for expired or malformed tokens; the client still clears local state.
        continue;
      }
      if (!decoded.sid || !decoded.userId || revoked.has(decoded.sid)) continue;
      try {
        const didRevoke = await prisma.$transaction(async (tx) => {
          const changed = await tx.authSession.updateMany({
            where: { id: decoded.sid!, userId: decoded.userId!, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          if (changed.count === 1) {
            await tx.auditLog.create({ data: {
              actorId: decoded.userId!, actorName: 'Authenticated account', action: 'AUTH_LOGOUT',
              targetType: 'AUTH_SESSION', targetId: decoded.sid!,
            } });
          }
          return changed.count === 1;
        });
        if (didRevoke) revoked.add(decoded.sid);
      } catch (error) {
        console.error('Logout session revocation/audit failed:', error);
        revocationFailed = true;
      }
    }
    res.clearCookie('ncc_token');
    if (revocationFailed) {
      res.status(503).json({ success: false, message: 'Logout could not be fully recorded. Please retry and sign in again after confirmation.' });
      return;
    }
  } else {
    res.clearCookie('ncc_token');
    res.status(503).json({ success: false, message: 'Logout service is unavailable. Please retry.' });
    return;
  }
  res.json({
    success: true,
    message: 'Institutional session terminated. Logged out successfully.',
  });
};

export const listMySessions = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ success: false, message: 'Authentication required.' }); return; }
  const sessions = await prisma.authSession.findMany({
    where: { userId: req.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' }, take: 50,
    select: { id: true, createdAt: true, expiresAt: true, revokedAt: true },
  });
  res.json({ success: true, sessions: sessions.map((session) => ({ ...session, current: session.id === req.authSessionId })) });
};

export const revokeMySession = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ success: false, message: 'Authentication required.' }); return; }
  const sessionId = String(req.params.sessionId || '');
  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.authSession.updateMany({ where: { id: sessionId, userId: req.user!.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (result.count === 1) await tx.auditLog.create({ data: { actorId: req.user!.id, actorName: req.user!.fullName, action: 'AUTH_SESSION_REVOKED', targetType: 'AUTH_SESSION', targetId: sessionId } });
    return result;
  });
  if (changed.count !== 1) { res.status(404).json({ success: false, message: 'Active session not found.' }); return; }
  res.json({ success: true, message: 'Session revoked.' });
};

export const revokeAllMySessions = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ success: false, message: 'Authentication required.' }); return; }
  const now = new Date();
  const [revoked] = await prisma.$transaction([
    prisma.authSession.updateMany({ where: { userId: req.user.id, revokedAt: null, expiresAt: { gt: now } }, data: { revokedAt: now } }),
    prisma.otpChallenge.updateMany({ where: { userId: req.user.id, purpose: 'LOGIN', consumedAt: null }, data: { otpHash: null, consumedAt: now } }),
    prisma.auditLog.create({ data: { actorId: req.user.id, actorName: req.user.fullName, action: 'AUTH_SESSIONS_REVOKED_ALL', targetType: 'USER_ACCOUNT', targetId: req.user.id } }),
  ]);
  res.clearCookie('ncc_token');
  res.json({ success: true, revokedCount: revoked.count, message: 'All active sessions were revoked. Sign in again to continue.' });
};

export const changeMyPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) { res.status(401).json({ success: false, message: 'Authentication required.' }); return; }
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') { res.status(400).json({ success: false, message: 'Provide your current and new password.' }); return; }
  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) { res.status(400).json({ success: false, field: 'newPassword', message: passwordCheck.message }); return; }
  const account = await prisma.user.findUnique({ where: { id: req.user.id }, select: { passwordHash: true } });
  if (!account || !(await bcrypt.compare(currentPassword, account.passwordHash))) { res.status(401).json({ success: false, message: 'Current password is incorrect.' }); return; }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } }),
    prisma.authSession.updateMany({ where: { userId: req.user.id, revokedAt: null }, data: { revokedAt: now } }),
    prisma.otpChallenge.updateMany({ where: { userId: req.user.id, purpose: 'LOGIN', consumedAt: null }, data: { otpHash: null, consumedAt: now } }),
    prisma.auditLog.create({ data: { actorId: req.user.id, actorName: req.user.fullName, action: 'PASSWORD_CHANGED', targetType: 'USER_ACCOUNT', targetId: req.user.id } }),
  ]);
  res.clearCookie('ncc_token');
  res.json({ success: true, message: 'Password changed. All sessions were revoked; sign in again with your new password.' });
};
