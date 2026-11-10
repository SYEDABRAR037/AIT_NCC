import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OtpPurpose } from '@prisma/client';
import { prisma } from '../db';
import { normalizePhoneNumber, sendOtpSmsWithResult } from '../services/attendanceNotification.service';
import { sendOtpEmail } from '../services/mail.service';
import { ProcessLocalRateLimitStore } from '../services/rateLimitStore';

const TTL_MS = 60_000;
const PROOF_TTL_MS = 15 * 60_000;
const RESEND_WAIT_MS = 30_000;
const requestBuckets = new ProcessLocalRateLimitStore(10_000);

export const getOtpSecret = (): string => process.env.OTP_SECRET || '';

// Deterministic shared transition cutoff timestamp parsed from environment.
// Does NOT use per-instance boot times (Date.now()) to prevent rolling-deployment divergence.
// If set, unexpired legacy challenges created before this cutoff can verify using JWT_SECRET during rollout overlap.
// If unset, legacy fallback is disabled (pure OTP_SECRET mode).
export const getOtpTransitionCutoff = (): Date | null => {
  const raw = process.env.OTP_TRANSITION_CUTOFF;
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(raw)) return null;
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const hashOtp = (id: string, otp: string, secretKey: string): string =>
  crypto.createHmac('sha256', secretKey).update(`${id}:${otp}`).digest('hex');

export const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a, 'hex'); const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export const verifyChallengeCode = (
  challenge: { id: string; otpHash: string | null; createdAt: Date; expiresAt: Date; sendCount: number },
  candidateOtp: string
): boolean => {
  if (!challenge.otpHash || !/^\d{6}$/.test(candidateOtp)) {
    return false;
  }

  // 1. New-code challenge path: explicitly prefixed with v2:
  // Must verify exclusively with OTP_SECRET; zero fallback to JWT_SECRET.
  if (challenge.otpHash.startsWith('v2:')) {
    const rawHash = challenge.otpHash.slice(3);
    const otpSecret = getOtpSecret();
    return Boolean(otpSecret) && safeEqual(rawHash, hashOtp(challenge.id, candidateOtp, otpSecret));
  }

  // 2. Bounded legacy compatibility path:
  // Strictly applies to raw legacy hashes without v2: prefix (demonstrably 64 hex chars).
  // Applies to both original legacy challenges and legacy challenges resent by an old instance, provided:
  // - The hash is in raw 64-hex format
  // - The challenge was created before the shared transition cutoff (createdAt < transitionCutoff)
  // - The challenge remains within its valid unexpired window (expiresAt > now)
  // - JWT_SECRET is configured in the environment
  const transitionCutoff = getOtpTransitionCutoff();
  const isLegacyRawHash = /^[0-9a-f]{64}$/i.test(challenge.otpHash);
  if (
    isLegacyRawHash &&
    transitionCutoff !== null &&
    challenge.createdAt < transitionCutoff &&
    challenge.expiresAt.getTime() > Date.now() &&
    process.env.JWT_SECRET
  ) {
    if (safeEqual(challenge.otpHash, hashOtp(challenge.id, candidateOtp, process.env.JWT_SECRET))) {
      return true;
    }
  }

  return false;
};
const limited = async (req: Request, res: Response, key: string, max = 8): Promise<boolean> => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const result = await requestBuckets.consume(`${key}:${ip}`, max, 10 * 60_000);
  if (!result.limited) return false;
  res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
  res.status(429).json({ success: false, message: 'Too many attempts. Please try again later.' });
  return true;
};
const maskEmail = (value: string) => {
  const [name, domain] = value.split('@');
  return name && domain ? `${name[0]}${'*'.repeat(Math.max(2, Math.min(name.length - 1, 8)))}@${domain}` : 'your email';
};
const maskPhone = (value: string) => `${value.slice(0, 3)}••••••${value.slice(-2)}`;
const issueOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

type OtpDeliveryOutcome = { success: boolean; failure?: string };

const dispatch = async (destination: string, channel: 'email' | 'mobile', otp: string, name: string, purpose: 'registration' | 'login'): Promise<OtpDeliveryOutcome> => {
  if (channel === 'email') {
    try {
      const result = await sendOtpEmail({ recipientEmail: destination, cadetName: name, otp, purpose });
      return { success: result.success, failure: result.success ? undefined : 'PROVIDER_REJECTED' };
    } catch {
      return { success: false, failure: 'PROVIDER_REJECTED' };
    }
  }
  return sendOtpSmsWithResult(destination, `NCC AIT Pune ${purpose === 'login' ? 'login' : 'mobile verification'} OTP: ${otp}. Valid for 60 seconds. Do not share this code.`);
};

const createChallenge = async (purpose: OtpPurpose, destination: string, channel: 'email' | 'mobile', userId?: string, name = 'Cadet') => {
  const otpSecret = getOtpSecret();
  if (!otpSecret) throw new Error('OTP_SECRET_MISSING');
  const code = issueOtp();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TTL_MS);
  const challenge = await prisma.otpChallenge.create({
    data: { id, purpose, destination, userId, otpHash: `v2:${hashOtp(id, code, otpSecret)}`, expiresAt },
  });
  let deliveryFailure = 'PROVIDER_REJECTED';
  try {
    const delivery = await dispatch(destination, channel, code, name, purpose === 'LOGIN' ? 'login' : 'registration');
    if (!delivery.success) deliveryFailure = delivery.failure || deliveryFailure;
    if (delivery.success) return { challenge, channel };
  } catch {
    // Provider details are deliberately kept out of the API response.
  }
  try {
    await prisma.otpChallenge.delete({ where: { id: challenge.id } });
  } catch {
    await prisma.otpChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { otpHash: null, consumedAt: new Date() } });
  }
  const error = new Error('OTP_DELIVERY_FAILED') as Error & { channel?: 'email' | 'mobile'; deliveryFailure?: string };
  error.channel = channel;
  error.deliveryFailure = deliveryFailure;
  throw error;
};

export const requestRegistrationOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (await limited(req, res, 'reg-otp-request')) return;
    await prisma.otpChallenge.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } } });
    if (!getOtpSecret()) { res.status(503).json({ success: false, message: 'Verification is temporarily unavailable.' }); return; }
    const channel = req.body.channel === 'mobile' ? 'mobile' : 'email';
    const raw = String(req.body.destination || '').trim();
    let destination: string;
    if (channel === 'email') {
      destination = raw.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) { res.status(400).json({ success: false, message: 'Enter a valid email address.' }); return; }
      const existing = await prisma.user.findFirst({ where: { email: { equals: destination, mode: 'insensitive' } }, select: { id: true } });
      if (existing) { res.status(409).json({ success: false, message: 'This email is already registered.' }); return; }
    } else {
      const normalized = normalizePhoneNumber(raw);
      if (!normalized.isValid) { res.status(400).json({ success: false, message: 'Enter a valid mobile number.' }); return; }
      destination = normalized.normalized;
      const existing = await prisma.user.findFirst({ where: { phone: destination }, select: { id: true } });
      if (existing) { res.status(409).json({ success: false, message: 'This mobile number is already registered.' }); return; }
    }
    const count = await prisma.otpChallenge.count({ where: { destination, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
    if (count >= 5) { res.status(429).json({ success: false, message: 'Too many codes requested. Please try again later.' }); return; }
    const purpose = channel === 'email' ? OtpPurpose.REGISTRATION_EMAIL : OtpPurpose.REGISTRATION_MOBILE;
    await prisma.otpChallenge.updateMany({ where: { purpose, destination, consumedAt: null }, data: { otpHash: null, consumedAt: new Date() } });
    const { challenge } = await createChallenge(purpose, destination, channel, undefined, String(req.body.name || 'Cadet'));
    const now = new Date();
    res.json({ success: true, challengeId: challenge.id, destination: channel === 'email' ? maskEmail(destination) : maskPhone(destination), expiresAt: challenge.expiresAt, serverNow: now });
  } catch (error: any) {
    const deliveryFailed = error?.message === 'OTP_DELIVERY_FAILED';
    const channel = req.body.channel === 'mobile' ? 'mobile' : 'email';
    const message = !deliveryFailed
      ? 'Unable to start verification.'
      : channel === 'mobile' && error?.deliveryFailure === 'NOT_CONFIGURED'
        ? 'SMS delivery is not configured. Please contact NCC administration.'
        : channel === 'mobile'
          ? 'We could not deliver the SMS verification code. Please try again later.'
          : 'We could not deliver the email verification code. Please try again later.';
    res.status(deliveryFailed ? 503 : 500).json({ success: false, message });
  }
};

export const resendAuthOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (await limited(req, res, 'auth-otp-resend', 10)) return;
    const challenge = await prisma.otpChallenge.findUnique({ where: { id: String(req.body.challengeId || '') } });
    if (!challenge || challenge.consumedAt || ![OtpPurpose.LOGIN, OtpPurpose.REGISTRATION_EMAIL, OtpPurpose.REGISTRATION_MOBILE].includes(challenge.purpose)) {
      res.status(400).json({ success: false, message: 'Verification has expired. Start again.' }); return;
    }
    if (Date.now() - challenge.lastSentAt.getTime() < RESEND_WAIT_MS) { res.status(429).json({ success: false, message: 'Please wait before requesting another code.' }); return; }
    if (challenge.sendCount >= 5) { res.status(429).json({ success: false, message: 'Too many codes requested. Start verification again later.' }); return; }
    const count = await prisma.otpChallenge.count({ where: { destination: challenge.destination, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
    if (count >= 5) { res.status(429).json({ success: false, message: 'Too many codes requested. Please try again later.' }); return; }
    const otpSecret = getOtpSecret();
    if (!otpSecret) { res.status(503).json({ success: false, message: 'Verification is temporarily unavailable.' }); return; }
    const code = issueOtp(); const expiresAt = new Date(Date.now() + TTL_MS);
    const reserved = await prisma.otpChallenge.updateMany({ where: { id: challenge.id, lastSentAt: challenge.lastSentAt, sendCount: { lt: 5 }, consumedAt: null }, data: { otpHash: `v2:${hashOtp(challenge.id, code, otpSecret)}`, expiresAt, verifiedAt: null, proofExpiresAt: null, attemptCount: 0, sendCount: { increment: 1 }, lastSentAt: new Date() } });
    if (reserved.count !== 1) { res.status(429).json({ success: false, message: 'Please wait before requesting another code.' }); return; }
    const channel = challenge.purpose === OtpPurpose.REGISTRATION_MOBILE || (challenge.purpose === OtpPurpose.LOGIN && challenge.destination.startsWith('+')) ? 'mobile' : 'email';
    const user = challenge.userId ? await prisma.user.findUnique({ where: { id: challenge.userId }, select: { fullName: true } }) : null;
    const delivery = await dispatch(challenge.destination, channel, code, user?.fullName || String(req.body.name || 'Cadet'), challenge.purpose === OtpPurpose.LOGIN ? 'login' : 'registration');
    if (!delivery.success) {
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { otpHash: null } });
      const message = channel === 'mobile' && delivery.failure === 'NOT_CONFIGURED'
        ? 'SMS delivery is not configured. Please contact NCC administration.'
        : channel === 'mobile'
          ? 'We could not deliver the SMS verification code. Please try again later.'
          : 'We could not deliver the email verification code. Please try again later.';
      res.status(503).json({ success: false, message });
      return;
    }
    const now = new Date(); res.json({ success: true, challengeId: challenge.id, expiresAt, serverNow: now });
  } catch { res.status(500).json({ success: false, message: 'Unable to resend OTP.' }); }
};

export const verifyRegistrationOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (await limited(req, res, 'auth-otp-verify', 30)) return;
    const challenge = await prisma.otpChallenge.findUnique({ where: { id: String(req.body.challengeId || '') } });
    const expectedPurpose = req.body.channel === 'mobile' ? OtpPurpose.REGISTRATION_MOBILE : OtpPurpose.REGISTRATION_EMAIL;
    if (!challenge || challenge.purpose !== expectedPurpose || challenge.consumedAt || !challenge.otpHash || challenge.expiresAt.getTime() <= Date.now()) { res.status(400).json({ success: false, message: 'This code has expired. Request a new one.' }); return; }
    if (challenge.attemptCount >= 5) { res.status(429).json({ success: false, message: 'Too many incorrect attempts. Request a new code.' }); return; }
    const valid = verifyChallengeCode(challenge, String(req.body.otp || ''));
    if (!valid) { await prisma.otpChallenge.updateMany({ where: { id: challenge.id, attemptCount: { lt: 5 }, consumedAt: null }, data: { attemptCount: { increment: 1 } } }); res.status(400).json({ success: false, message: 'The code is incorrect.' }); return; }
    const verifiedAt = new Date();
    const updated = await prisma.otpChallenge.updateMany({ where: { id: challenge.id, otpHash: challenge.otpHash, attemptCount: { lt: 5 }, consumedAt: null, expiresAt: { gt: verifiedAt } }, data: { otpHash: null, verifiedAt, proofExpiresAt: new Date(verifiedAt.getTime() + PROOF_TTL_MS) } });
    if (updated.count !== 1) { res.status(400).json({ success: false, message: 'This code has expired. Request a new one.' }); return; }
    res.json({ success: true, verified: true });
  } catch { res.status(500).json({ success: false, message: 'Unable to verify code.' }); }
};

export const verifyLoginOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (await limited(req, res, 'login-otp-verify', 30)) return;
    const id = String(req.body.challengeId || '');
    const challenge = await prisma.otpChallenge.findUnique({
      where: { id },
      include: {
        user: {
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
          },
        },
      },
    });
    // DEF-01: allow ACTIVE (cadets) and APPROVED (officer accounts pre-activation)
    const validStatuses = ['ACTIVE', 'APPROVED'];
    if (!challenge || challenge.purpose !== OtpPurpose.LOGIN || challenge.consumedAt || !challenge.otpHash || challenge.expiresAt.getTime() <= Date.now() || !challenge.user || !validStatuses.includes(challenge.user.status)) { res.status(400).json({ success: false, message: 'This login code has expired. Sign in again.' }); return; }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) { res.status(503).json({ success: false, message: 'Login is temporarily unavailable.' }); return; }
    if (challenge.attemptCount >= 5) { res.status(429).json({ success: false, message: 'Too many incorrect attempts. Sign in again to request a new code.' }); return; }
    const valid = verifyChallengeCode(challenge, String(req.body.otp || ''));
    if (!valid) { await prisma.otpChallenge.updateMany({ where: { id, attemptCount: { lt: 5 }, consumedAt: null }, data: { attemptCount: { increment: 1 } } }); res.status(400).json({ success: false, message: 'The code is incorrect.' }); return; }
    const consumed = await prisma.otpChallenge.updateMany({ where: { id, attemptCount: { lt: 5 }, consumedAt: null, otpHash: challenge.otpHash, expiresAt: { gt: new Date() } }, data: { otpHash: null, consumedAt: new Date() } });
    if (consumed.count !== 1) { res.status(400).json({ success: false, message: 'This login code has expired. Sign in again.' }); return; }
    const user = challenge.user;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = await prisma.authSession.create({ data: { userId: user.id, expiresAt } });
    const token = jwt.sign({ userId: user.id, role: user.role, status: user.status, sid: session.id }, jwtSecret, { expiresIn: '7d' });
    res.cookie('ncc_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, message: 'Authentication successful.', token, user: {
      id: user.id, fullName: user.fullName, regimentalNumber: user.regimentalNumber, collegeRollNumber: user.collegeRollNumber,
      email: user.email, phone: user.phone, year: user.year, branch: user.branch, platoonName: user.platoonName,
      role: user.role, status: user.status, profilePhotoUrl: user.profilePhotoUrl,
    } });
  } catch { res.status(500).json({ success: false, message: 'Unable to verify login code.' }); }
};

export const startLoginOtp = async (req: Request, user: { id: string; fullName: string; email: string; emailVerified: boolean; phone: string | null; mobileVerified: boolean; role?: string }, res: Response): Promise<void> => {
  if (await limited(req, res, 'login-otp-request', 5)) return;
  if (!getOtpSecret()) { res.status(503).json({ success: false, message: 'Login verification is temporarily unavailable.' }); return; }
  const useMobile = Boolean(user.phone && user.mobileVerified);
  // Officers provisioned by ANO may not have gone through self-registration OTP, so their
  // emailVerified flag may be false. Trust the email for non-CADET roles. (DEF-01)
  const isOfficer = user.role && user.role !== 'CADET';
  const useEmail = Boolean(user.email && (user.emailVerified || isOfficer));
  if (!useMobile && !useEmail) { res.status(403).json({ success: false, message: 'No verified contact on record. Contact the NCC administration to update your account.' }); return; }
  const channels: Array<{ channel: 'mobile' | 'email'; destination: string }> = [];
  if (useMobile) channels.push({ channel: 'mobile', destination: normalizePhoneNumber(user.phone).normalized });
  if (useEmail) channels.push({ channel: 'email', destination: user.email.toLowerCase() });

  // Check the preferred channel before invalidating an existing challenge. A
  // rate-limited request must not consume a still-valid OTP challenge.
  const preferred = channels[0];
  const preferredRecentCount = await prisma.otpChallenge.count({ where: { purpose: OtpPurpose.LOGIN, destination: preferred.destination, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  if (preferredRecentCount >= 5) {
    res.status(429).json({ success: false, message: 'Too many login codes requested. Please try again later.' });
    return;
  }

  await prisma.otpChallenge.updateMany({ where: { purpose: OtpPurpose.LOGIN, userId: user.id, consumedAt: null }, data: { otpHash: null, consumedAt: new Date() } });
  for (const { channel, destination } of channels) {
    const recentCount = destination === preferred.destination
      ? preferredRecentCount
      : await prisma.otpChallenge.count({ where: { purpose: OtpPurpose.LOGIN, destination, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
    if (recentCount >= 5) {
      // Do not bypass the account/destination limit by falling back to another contact.
      res.status(429).json({ success: false, message: 'Too many login codes requested. Please try again later.' });
      return;
    }
    try {
      const { challenge } = await createChallenge(OtpPurpose.LOGIN, destination, channel, user.id, user.fullName);
      const maskedDestination = channel === 'mobile' ? maskPhone(destination) : maskEmail(destination);
      const now = new Date();
      res.json({ success: true, otpRequired: true, challengeId: challenge.id, destination: maskedDestination, expiresAt: challenge.expiresAt, serverNow: now });
      return;
    } catch (error: any) {
      if (error?.message !== 'OTP_DELIVERY_FAILED') throw error;
      // A failed primary SMS may use the already eligible verified email channel.
    }
  }
  res.status(503).json({ success: false, message: 'Unable to deliver a login verification code. Please try again later or contact NCC administration.' });
};
