import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OtpPurpose } from '@prisma/client';
import { prisma } from '../db';
import { normalizePhoneNumber, sendOtpSms } from '../services/attendanceNotification.service';
import { sendOtpEmail } from '../services/mail.service';

const TTL_MS = 60_000;
const PROOF_TTL_MS = 15 * 60_000;
const RESEND_WAIT_MS = 30_000;
const requestBuckets = new Map<string, number[]>();
const secret = () => process.env.OTP_SECRET || process.env.JWT_SECRET || '';
const hashOtp = (id: string, otp: string) => crypto.createHmac('sha256', secret()).update(`${id}:${otp}`).digest('hex');
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a, 'hex'); const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
const limited = (req: Request, res: Response, key: string, max = 8): boolean => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (requestBuckets.get(`${key}:${ip}`) || []).filter((time) => now - time < 10 * 60_000);
  if (recent.length >= max) { res.status(429).json({ success: false, message: 'Too many attempts. Please try again later.' }); return true; }
  recent.push(now); requestBuckets.set(`${key}:${ip}`, recent); return false;
};
const maskEmail = (value: string) => {
  const [name, domain] = value.split('@');
  return name && domain ? `${name[0]}${'*'.repeat(Math.max(2, Math.min(name.length - 1, 8)))}@${domain}` : 'your email';
};
const maskPhone = (value: string) => `${value.slice(0, 3)}••••••${value.slice(-2)}`;
const issueOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

const dispatch = async (destination: string, channel: 'email' | 'mobile', otp: string, name: string, purpose: 'registration' | 'login') => {
  if (channel === 'email') return (await sendOtpEmail({ recipientEmail: destination, cadetName: name, otp, purpose })).success;
  return sendOtpSms(destination, `NCC AIT Pune ${purpose === 'login' ? 'login' : 'mobile verification'} OTP: ${otp}. Valid for 60 seconds. Do not share this code.`);
};

const createChallenge = async (purpose: OtpPurpose, destination: string, channel: 'email' | 'mobile', userId?: string, name = 'Cadet') => {
  const code = issueOtp();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TTL_MS);
  const challenge = await prisma.otpChallenge.create({
    data: { id, purpose, destination, userId, otpHash: hashOtp(id, code), expiresAt },
  });
  const sent = await dispatch(destination, channel, code, name, purpose === 'LOGIN' ? 'login' : 'registration');
  if (!sent) {
    await prisma.otpChallenge.delete({ where: { id: challenge.id } });
    throw new Error('OTP_DELIVERY_FAILED');
  }
  return { challenge, channel };
};

export const requestRegistrationOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (limited(req, res, 'reg-otp-request')) return;
    await prisma.otpChallenge.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } } });
    if (!secret()) { res.status(503).json({ success: false, message: 'Verification is temporarily unavailable.' }); return; }
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
    res.status(error?.message === 'OTP_DELIVERY_FAILED' ? 503 : 500).json({ success: false, message: error?.message === 'OTP_DELIVERY_FAILED' ? 'Unable to send OTP. Please try again.' : 'Unable to start verification.' });
  }
};

export const resendAuthOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (limited(req, res, 'auth-otp-resend', 10)) return;
    const challenge = await prisma.otpChallenge.findUnique({ where: { id: String(req.body.challengeId || '') } });
    if (!challenge || challenge.consumedAt || ![OtpPurpose.LOGIN, OtpPurpose.REGISTRATION_EMAIL, OtpPurpose.REGISTRATION_MOBILE].includes(challenge.purpose)) {
      res.status(400).json({ success: false, message: 'Verification has expired. Start again.' }); return;
    }
    if (Date.now() - challenge.lastSentAt.getTime() < RESEND_WAIT_MS) { res.status(429).json({ success: false, message: 'Please wait before requesting another code.' }); return; }
    if (challenge.sendCount >= 5) { res.status(429).json({ success: false, message: 'Too many codes requested. Start verification again later.' }); return; }
    const count = await prisma.otpChallenge.count({ where: { destination: challenge.destination, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
    if (count >= 5) { res.status(429).json({ success: false, message: 'Too many codes requested. Please try again later.' }); return; }
    const code = issueOtp(); const expiresAt = new Date(Date.now() + TTL_MS);
    const reserved = await prisma.otpChallenge.updateMany({ where: { id: challenge.id, lastSentAt: challenge.lastSentAt, sendCount: { lt: 5 }, consumedAt: null }, data: { otpHash: hashOtp(challenge.id, code), expiresAt, verifiedAt: null, proofExpiresAt: null, attemptCount: 0, sendCount: { increment: 1 }, lastSentAt: new Date() } });
    if (reserved.count !== 1) { res.status(429).json({ success: false, message: 'Please wait before requesting another code.' }); return; }
    const channel = challenge.purpose === OtpPurpose.REGISTRATION_MOBILE || (challenge.purpose === OtpPurpose.LOGIN && challenge.destination.startsWith('+')) ? 'mobile' : 'email';
    const user = challenge.userId ? await prisma.user.findUnique({ where: { id: challenge.userId }, select: { fullName: true } }) : null;
    const sent = await dispatch(challenge.destination, channel, code, user?.fullName || String(req.body.name || 'Cadet'), challenge.purpose === OtpPurpose.LOGIN ? 'login' : 'registration');
    if (!sent) { await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { otpHash: null } }); res.status(503).json({ success: false, message: 'Unable to send OTP. Please try again.' }); return; }
    const now = new Date(); res.json({ success: true, challengeId: challenge.id, expiresAt, serverNow: now });
  } catch { res.status(500).json({ success: false, message: 'Unable to resend OTP.' }); }
};

export const verifyRegistrationOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (limited(req, res, 'auth-otp-verify', 30)) return;
    const challenge = await prisma.otpChallenge.findUnique({ where: { id: String(req.body.challengeId || '') } });
    const expectedPurpose = req.body.channel === 'mobile' ? OtpPurpose.REGISTRATION_MOBILE : OtpPurpose.REGISTRATION_EMAIL;
    if (!challenge || challenge.purpose !== expectedPurpose || challenge.consumedAt || !challenge.otpHash || challenge.expiresAt.getTime() <= Date.now()) { res.status(400).json({ success: false, message: 'This code has expired. Request a new one.' }); return; }
    if (challenge.attemptCount >= 5) { res.status(429).json({ success: false, message: 'Too many incorrect attempts. Request a new code.' }); return; }
    const valid = /^\d{6}$/.test(String(req.body.otp || '')) && safeEqual(challenge.otpHash, hashOtp(challenge.id, String(req.body.otp)));
    if (!valid) { await prisma.otpChallenge.updateMany({ where: { id: challenge.id, attemptCount: { lt: 5 }, consumedAt: null }, data: { attemptCount: { increment: 1 } } }); res.status(400).json({ success: false, message: 'The code is incorrect.' }); return; }
    const verifiedAt = new Date();
    const updated = await prisma.otpChallenge.updateMany({ where: { id: challenge.id, otpHash: challenge.otpHash, attemptCount: { lt: 5 }, consumedAt: null, expiresAt: { gt: verifiedAt } }, data: { otpHash: null, verifiedAt, proofExpiresAt: new Date(verifiedAt.getTime() + PROOF_TTL_MS) } });
    if (updated.count !== 1) { res.status(400).json({ success: false, message: 'This code has expired. Request a new one.' }); return; }
    res.json({ success: true, verified: true });
  } catch { res.status(500).json({ success: false, message: 'Unable to verify code.' }); }
};

export const verifyLoginOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (limited(req, res, 'login-otp-verify', 30)) return;
    const id = String(req.body.challengeId || '');
    const challenge = await prisma.otpChallenge.findUnique({ where: { id }, include: { user: true } });
    if (!challenge || challenge.purpose !== OtpPurpose.LOGIN || challenge.consumedAt || !challenge.otpHash || challenge.expiresAt.getTime() <= Date.now() || !challenge.user || challenge.user.status !== 'ACTIVE') { res.status(400).json({ success: false, message: 'This login code has expired. Sign in again.' }); return; }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) { res.status(503).json({ success: false, message: 'Login is temporarily unavailable.' }); return; }
    if (challenge.attemptCount >= 5) { res.status(429).json({ success: false, message: 'Too many incorrect attempts. Sign in again to request a new code.' }); return; }
    const valid = /^\d{6}$/.test(String(req.body.otp || '')) && safeEqual(challenge.otpHash, hashOtp(id, String(req.body.otp)));
    if (!valid) { await prisma.otpChallenge.updateMany({ where: { id, attemptCount: { lt: 5 }, consumedAt: null }, data: { attemptCount: { increment: 1 } } }); res.status(400).json({ success: false, message: 'The code is incorrect.' }); return; }
    const consumed = await prisma.otpChallenge.updateMany({ where: { id, attemptCount: { lt: 5 }, consumedAt: null, otpHash: challenge.otpHash, expiresAt: { gt: new Date() } }, data: { otpHash: null, consumedAt: new Date() } });
    if (consumed.count !== 1) { res.status(400).json({ success: false, message: 'This login code has expired. Sign in again.' }); return; }
    const user = challenge.user;
    const token = jwt.sign({ userId: user.id, role: user.role, status: user.status }, jwtSecret, { expiresIn: '7d' });
    res.cookie('ncc_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, message: 'Authentication successful.', token, user: {
      id: user.id, fullName: user.fullName, regimentalNumber: user.regimentalNumber, collegeRollNumber: user.collegeRollNumber,
      email: user.email, phone: user.phone, year: user.year, branch: user.branch, platoonName: user.platoonName,
      role: user.role, status: user.status, profilePhotoUrl: user.profilePhotoUrl,
    } });
  } catch { res.status(500).json({ success: false, message: 'Unable to verify login code.' }); }
};

export const startLoginOtp = async (req: Request, user: { id: string; fullName: string; email: string; emailVerified: boolean; phone: string | null; mobileVerified: boolean }, res: Response): Promise<void> => {
  if (limited(req, res, 'login-otp-request', 5)) return;
  if (!secret()) { res.status(503).json({ success: false, message: 'Login verification is temporarily unavailable.' }); return; }
  const useMobile = Boolean(user.phone && user.mobileVerified);
  const useEmail = Boolean(user.email && user.emailVerified);
  if (!useMobile && !useEmail) { res.status(403).json({ success: false, message: 'Verify your registered email through Forgot Password before signing in, or contact the NCC administration.' }); return; }
  const destination = useMobile ? normalizePhoneNumber(user.phone).normalized : user.email.toLowerCase();
  const channel = useMobile ? 'mobile' : 'email';
  const recentCount = await prisma.otpChallenge.count({ where: { purpose: OtpPurpose.LOGIN, destination, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  if (recentCount >= 5) { res.status(429).json({ success: false, message: 'Too many login codes requested. Please try again later.' }); return; }
  await prisma.otpChallenge.updateMany({ where: { purpose: OtpPurpose.LOGIN, userId: user.id, consumedAt: null }, data: { otpHash: null, consumedAt: new Date() } });
  const { challenge } = await createChallenge(OtpPurpose.LOGIN, destination, channel, user.id, user.fullName);
  const now = new Date();
  res.json({ success: true, otpRequired: true, challengeId: challenge.id, destination: useMobile ? maskPhone(destination) : maskEmail(destination), expiresAt: challenge.expiresAt, serverNow: now });
};
