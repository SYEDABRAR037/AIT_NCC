import assert from 'assert';
import bcrypt from 'bcryptjs';

// Recovery controller, persistence, mail and login adapters are all isolated.
const Module = require('module');
const jwtSecret = 'recovery-delivery-test-secret-at-least-32-characters';
process.env.JWT_SECRET = jwtSecret;
const user = {
  id: 'synthetic-recovery-delivery-user', fullName: 'Synthetic Recovery User',
  email: 'recovery-1@example.test', regimentalNumber: 'SYN-REC-1',
  collegeRollNumber: 'ROLL-REC-1', role: 'CADET', status: 'ACTIVE',
  passwordHash: bcrypt.hashSync('OldPassword!123', 4), emailVerified: true,
};
let identitySequence = 1;
const challenges = new Map<string, any>();
const dispatchedOtps: string[] = [];
let mailResult: 'success' | 'failure' | 'throw' = 'success';
let sequence = 0;
const matchesUser = (where: any) => {
  if (where?.AND) return where.AND.some((part: any) => part.email?.equals === user.email) && where.AND.some((part: any) => part.regimentalNumber?.equals === user.regimentalNumber);
  if (where?.OR) return where.OR.some((part: any) => Object.entries(part).some(([key, value]: any) => value?.equals?.toLowerCase?.() === String(user[key as keyof typeof user] || '').toLowerCase()));
  return false;
};
const fakePrisma: any = {
  user: {
    findFirst: async ({ where }: any) => matchesUser(where) ? { ...user } : null,
    update: async ({ data }: any) => { Object.assign(user, data); return user; },
  },
  recoveryChallenge: {
    findFirst: async ({ where }: any) => [...challenges.values()].find(c => c.lookupHash === where.lookupHash && c.createdAt >= where.createdAt.gte) || null,
    count: async ({ where }: any) => [...challenges.values()].filter(c => c.lookupHash === where.lookupHash && c.createdAt >= where.createdAt.gte).length,
    findUnique: async ({ where }: any) => challenges.get(where.id) || null,
    create: async ({ data }: any) => {
      const id = `recovery-delivery-${++sequence}`;
      const value = { id, sendCount: 1, ...data, createdAt: new Date(), usedAt: null, verifiedAt: null, user: data.userId ? { ...user } : null };
      challenges.set(id, value);
      return value;
    },
    delete: async ({ where }: any) => { const value = challenges.get(where.id); challenges.delete(where.id); return value; },
    update: async ({ where, data }: any) => { const value = challenges.get(where.id); Object.assign(value, data); return value; },
    updateMany: async ({ where, data }: any) => {
      const value = challenges.get(where.id);
      if (!value || (where.userId && value.userId !== where.userId) || (where.usedAt === null && value.usedAt !== null) || (where.verifiedAt === null && value.verifiedAt !== null)) return { count: 0 };
      for (const [key, next] of Object.entries(data)) {
        if (key === 'attemptCount' && (next as any)?.increment) value.attemptCount += (next as any).increment;
        else if (key === 'sendCount' && (next as any)?.increment) value.sendCount += (next as any).increment;
        else value[key] = next;
      }
      return { count: 1 };
    },
  },
  auditLog: { create: async () => ({ id: 'synthetic-audit' }) },
  $transaction: async (arg: any) => typeof arg === 'function' ? arg(fakePrisma) : Promise.all(arg),
};
const fakeDispatcher = {
  dispatch: async ({ otp }: { otp: string }) => {
    dispatchedOtps.push(otp);
    if (mailResult === 'throw') throw new Error('synthetic provider failure');
    return mailResult === 'success';
  },
};
const originalLoad = Module._load;
Module._load = function (request: string, parent: any, isMain: boolean) {
  if ((request === '../db' || request === './db') && parent?.filename.includes('/src/')) return { prisma: fakePrisma };
  if (request === '../services/recoveryOtpDispatcher' && parent?.filename.includes('recovery.controller')) return { recoveryOtpDispatcher: fakeDispatcher };
  if (request === './otpAuth.controller' && parent?.filename.includes('auth.controller')) return { startLoginOtp: async (_req: any, _user: any, res: any) => { res.json({ success: true, otpRequired: true }); } };
  return originalLoad.call(this, request, parent, isMain);
};
const { requestPasswordResetOtp, resendPasswordResetOtp, verifyPasswordResetOtp, resetPassword } = require('../controllers/recovery.controller') as typeof import('../controllers/recovery.controller');
const { login } = require('../controllers/auth.controller') as typeof import('../controllers/auth.controller');
Module._load = originalLoad;

const response = () => ({ statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; } });
const req = (body: any, ip = `synthetic-${Math.random()}`) => ({ body, ip, socket: { remoteAddress: ip } } as any);
const identify = () => { identitySequence += 1; user.email = `recovery-${identitySequence}@example.test`; user.regimentalNumber = `SYN-REC-${identitySequence}`; };

const run = async () => {
  // Unknown account remains indistinguishable from a successful request while no email is dispatched.
  const unknownRes: any = response();
  await requestPasswordResetOtp(req({ email: user.email, regimentalNumber: 'SYN-UNKNOWN' }), unknownRes);
  assert.strictEqual(unknownRes.statusCode, 200);
  assert.strictEqual(unknownRes.body.challengeAccepted, true);
  assert.strictEqual(dispatchedOtps.length, 0);

  // Correct account plus successful provider waits for and records provider acceptance.
  const requestRes: any = response();
  await requestPasswordResetOtp(req({ email: user.email, regimentalNumber: user.regimentalNumber }), requestRes);
  assert.strictEqual(requestRes.statusCode, 200);
  assert.strictEqual(requestRes.body.challengeAccepted, true);
  const firstOtp = dispatchedOtps.at(-1)!;
  assert.ok(firstOtp);
  assert.strictEqual(JSON.stringify(requestRes.body).includes(firstOtp), false, 'OTP is never returned in the API response.');
  let challenge = challenges.get(requestRes.body.recoveryId);
  assert.strictEqual(challenge.deliveryStatus, 'SENT');

  const coolRes: any = response();
  await resendPasswordResetOtp(req({ recoveryId: challenge.id }), coolRes);
  assert.strictEqual(coolRes.statusCode, 429, 'Resend cooldown remains active.');

  // A permitted resend replaces the old OTP and reports only after dispatch succeeds.
  challenge.lastSentAt = new Date(Date.now() - 46_000);
  const resendRes: any = response();
  await resendPasswordResetOtp(req({ recoveryId: challenge.id }), resendRes);
  assert.strictEqual(resendRes.statusCode, 200);
  assert.strictEqual(challenge.sendCount, 2);
  assert.strictEqual(challenge.deliveryStatus, 'SENT');
  const resendOtp = dispatchedOtps.at(-1)!;
  assert.notStrictEqual(resendOtp, firstOtp);
  const wrongRes: any = response();
  await verifyPasswordResetOtp(req({ recoveryId: challenge.id, otp: firstOtp }), wrongRes);
  assert.strictEqual(wrongRes.statusCode, 400, 'The previous OTP is invalid after resend.');

  // Provider false and exception both produce a safe error and no usable challenge.
  for (const [index, outcome] of (['failure', 'throw'] as const).entries()) {
    identify();
    challenges.clear();
    mailResult = outcome;
    const failed: any = response();
    await requestPasswordResetOtp(req({ email: user.email, regimentalNumber: user.regimentalNumber }), failed);
    assert.strictEqual(failed.statusCode, 503);
    assert.strictEqual(failed.body.message, 'Unable to deliver a recovery code right now. Please try again later.');
    assert.strictEqual(challenges.size, 0, `Failed initial delivery ${index} must leave no challenge.`);
    assert.doesNotMatch(JSON.stringify(failed.body), /OTP|smtp|provider|secret|password|\d{6}/i);
  }

  identify(); challenges.clear(); mailResult = 'success';
  const resendFailureStart: any = response();
  await requestPasswordResetOtp(req({ email: user.email, regimentalNumber: user.regimentalNumber }), resendFailureStart);
  const failedResendChallenge = challenges.get(resendFailureStart.body.recoveryId);
  failedResendChallenge.lastSentAt = new Date(Date.now() - 46_000);
  mailResult = 'failure';
  const failedResend: any = response();
  await resendPasswordResetOtp(req({ recoveryId: failedResendChallenge.id }), failedResend);
  assert.strictEqual(failedResend.statusCode, 503);
  assert.ok(failedResendChallenge.usedAt instanceof Date, 'Failed resend invalidates the reserved OTP.');
  const failedCodeCheck: any = response();
  await verifyPasswordResetOtp(req({ recoveryId: failedResendChallenge.id, otp: dispatchedOtps.at(-1) }), failedCodeCheck);
  assert.strictEqual(failedCodeCheck.statusCode, 400);

  // Full request → OTP verification → reset → application login using the new password.
  identify(); challenges.clear(); mailResult = 'success';
  const fullRequest: any = response();
  await requestPasswordResetOtp(req({ email: user.email, regimentalNumber: user.regimentalNumber }), fullRequest);
  challenge = challenges.get(fullRequest.body.recoveryId);
  const validOtp = dispatchedOtps.at(-1)!;
  const verified: any = response();
  await verifyPasswordResetOtp(req({ recoveryId: challenge.id, otp: validOtp }), verified);
  assert.strictEqual(verified.statusCode, 200);
  assert.ok(verified.body.resetToken);
  const newPassword = 'Ncc-Reset-Success-2026!';
  const reset: any = response();
  await resetPassword(req({ resetToken: verified.body.resetToken, newPassword, confirmPassword: newPassword }), reset);
  assert.strictEqual(reset.statusCode, 200);
  assert.strictEqual(reset.body.passwordReset, true);
  assert.strictEqual(await bcrypt.compare(newPassword, user.passwordHash), true);
  assert.strictEqual(await bcrypt.compare('OldPassword!123', user.passwordHash), false);
  const oldLogin: any = response();
  await login(req({ identifier: user.regimentalNumber, password: 'OldPassword!123' }), oldLogin);
  assert.strictEqual(oldLogin.statusCode, 401);
  const newLogin: any = response();
  await login(req({ identifier: user.regimentalNumber, password: newPassword }), newLogin);
  assert.strictEqual(newLogin.statusCode, 200);
  assert.strictEqual(newLogin.body.otpRequired, true);

  // Missing SMTP variables fail before a transport can be constructed; no network send is attempted here.
  const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'GMAIL_APP_PASSWORD', 'MAIL_PASSWORD', 'SMTP_FROM_EMAIL'];
  const priorEnv = new Map(smtpKeys.map(key => [key, process.env[key]]));
  smtpKeys.forEach(key => delete process.env[key]);
  const { getTransporter } = require('../services/mail.service') as typeof import('../services/mail.service');
  assert.throws(() => getTransporter(), /SMTP host, user, and password must be configured/);
  for (const [key, value] of priorEnv) if (value !== undefined) process.env[key] = value;

  console.log('Recovery delivery tests passed: account lookup, synchronous provider success/failure, resend, OTP rotation, reset, and login with the new password.');
};

run().catch((error) => { console.error('Recovery delivery tests failed:', error instanceof Error ? error.message : 'unknown assertion error'); process.exitCode = 1; });
