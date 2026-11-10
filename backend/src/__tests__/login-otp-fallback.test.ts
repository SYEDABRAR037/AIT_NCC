import assert from 'assert';

// Mock persistence and both delivery adapters before importing the controller.
const Module = require('module');
const challenges = new Map<string, any>();
let sequence = 0;
let smsResult = false;
let smsFailure: 'NOT_CONFIGURED' | 'PROVIDER_REJECTED' = 'PROVIDER_REJECTED';
let emailResult = true;
let deliveredEmailOtp = '';
let recentChallengeCount = 0;
const deliveryCalls: string[] = [];
const fakePrisma: any = {
  otpChallenge: {
    create: async ({ data }: any) => {
      const challenge = { ...data, createdAt: new Date(), lastSentAt: new Date(), sendCount: 1, attemptCount: 0, consumedAt: null, verifiedAt: null, proofExpiresAt: null };
      challenges.set(challenge.id, challenge);
      return challenge;
    },
    findUnique: async ({ where }: any) => challenges.get(where.id) || null,
    delete: async ({ where }: any) => { challenges.delete(where.id); return {}; },
    deleteMany: async () => ({ count: 0 }),
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const challenge of challenges.values()) {
        if (where.userId && challenge.userId !== where.userId) continue;
        if (where.destination && challenge.destination !== where.destination) continue;
        if (where.purpose && challenge.purpose !== where.purpose) continue;
        if (where.consumedAt === null && challenge.consumedAt !== null) continue;
        if (where.id && challenge.id !== where.id) continue;
        if (where.otpHash && challenge.otpHash !== where.otpHash) continue;
        if (data.consumedAt) challenge.consumedAt = data.consumedAt;
        if (Object.prototype.hasOwnProperty.call(data, 'otpHash')) challenge.otpHash = data.otpHash;
        if (data.verifiedAt) challenge.verifiedAt = data.verifiedAt;
        if (data.proofExpiresAt) challenge.proofExpiresAt = data.proofExpiresAt;
        if (data.attemptCount?.increment) challenge.attemptCount += data.attemptCount.increment;
        count += 1;
      }
      return { count };
    },
    count: async () => recentChallengeCount,
  },
  user: { findFirst: async () => null },
};
const originalLoad = Module._load;
Module._load = function (request: string, parent: any, isMain: boolean) {
  if (request === '../db' && parent?.filename.includes('otpAuth.controller')) return { prisma: fakePrisma };
  if (request === '../services/attendanceNotification.service' && parent?.filename.includes('otpAuth.controller')) {
    return {
      normalizePhoneNumber: (phone: string) => ({ isValid: true, normalized: phone }),
      sendOtpSmsWithResult: async () => { deliveryCalls.push('mobile'); return smsResult ? { success: true, provider: 'FAST2SMS' } : { success: false, failure: smsFailure }; },
    };
  }
  if (request === '../services/mail.service' && parent?.filename.includes('otpAuth.controller')) {
    return { sendOtpEmail: async ({ otp }: any) => { deliveryCalls.push('email'); deliveredEmailOtp = otp; return { success: emailResult }; } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { startLoginOtp, requestRegistrationOtp, verifyRegistrationOtp } = require('../controllers/otpAuth.controller') as typeof import('../controllers/otpAuth.controller');
Module._load = originalLoad;

const response = () => ({ statusCode: 200, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; } });
const user = { id: 'synthetic-user', fullName: 'Test Cadet', email: 'cadet@example.test', emailVerified: true, phone: '+919876543210', mobileVerified: true, role: 'CADET' };

const run = async () => {
  process.env.OTP_SECRET = 'synthetic-otp-secret-for-isolated-test-only';
  deliveryCalls.length = 0;
  challenges.clear();
  smsResult = false;
  emailResult = true;
  const fallbackRes: any = response();
  await startLoginOtp({ ip: 'fallback-test', socket: { remoteAddress: 'fallback-test' } } as any, user as any, fallbackRes);
  assert.strictEqual(fallbackRes.statusCode, 200);
  assert.strictEqual(fallbackRes.body.otpRequired, true);
  assert.deepStrictEqual(deliveryCalls, ['mobile', 'email']);
  assert.strictEqual(challenges.size, 1, 'Failed SMS challenge is removed; only the email challenge remains.');
  assert.strictEqual([...challenges.values()][0].destination, user.email);
  assert.ok(!JSON.stringify(fallbackRes.body).includes([...challenges.values()][0].otpHash));
  assert.ok(!JSON.stringify(fallbackRes.body).includes('OTP'));

  deliveryCalls.length = 0;
  challenges.clear();
  emailResult = false;
  const failedRes: any = response();
  await startLoginOtp({ ip: 'delivery-failure-test', socket: { remoteAddress: 'delivery-failure-test' } } as any, user as any, failedRes);
  assert.strictEqual(failedRes.statusCode, 503);
  assert.deepStrictEqual(deliveryCalls, ['mobile', 'email']);
  assert.strictEqual(challenges.size, 0, 'No undeliverable OTP challenge remains active.');
  assert.ok(!JSON.stringify(failedRes.body).match(/secret|provider|password|\d{6}/i));

  deliveryCalls.length = 0;
  challenges.clear();
  recentChallengeCount = 5;
  const priorChallenge = { id: 'prior-active-challenge', userId: user.id, destination: user.phone, purpose: 'LOGIN', otpHash: 'synthetic-hash', consumedAt: null };
  challenges.set(priorChallenge.id, priorChallenge);
  const limitedRes: any = response();
  await startLoginOtp({ ip: 'rate-limit-preservation-test', socket: { remoteAddress: 'rate-limit-preservation-test' } } as any, user as any, limitedRes);
  assert.strictEqual(limitedRes.statusCode, 429);
  assert.deepStrictEqual(deliveryCalls, [], 'A rate-limited request must not dispatch.');
  assert.strictEqual(priorChallenge.consumedAt, null, 'A rejected request must preserve the existing active OTP.');
  recentChallengeCount = 0;

  deliveryCalls.length = 0;
  challenges.clear();
  emailResult = true;
  const emailUnverifiedRes: any = response();
  await startLoginOtp({ ip: 'email-policy-test', socket: { remoteAddress: 'email-policy-test' } } as any, { ...user, emailVerified: false } as any, emailUnverifiedRes);
  assert.strictEqual(emailUnverifiedRes.statusCode, 503);
  assert.deepStrictEqual(deliveryCalls, ['mobile'], 'An unverified cadet email must not be used for fallback.');
  assert.strictEqual(challenges.size, 0);

  // Registration channels are exercised independently and never use cross-channel fallback.
  deliveryCalls.length = 0;
  challenges.clear();
  smsFailure = 'NOT_CONFIGURED';
  const mobileFailureRes: any = response();
  await requestRegistrationOtp({ ip: 'registration-mobile-unconfigured', body: { channel: 'mobile', destination: '+919876543210' } } as any, mobileFailureRes);
  assert.strictEqual(mobileFailureRes.statusCode, 503);
  assert.match(mobileFailureRes.body.message, /SMS delivery is not configured/i);
  assert.deepStrictEqual(deliveryCalls, ['mobile']);
  assert.strictEqual(challenges.size, 0, 'An undeliverable registration challenge is removed.');
  assert.ok(!JSON.stringify(mobileFailureRes.body).match(/secret|provider|password|\d{6}/i));

  deliveryCalls.length = 0;
  emailResult = false;
  const emailFailureRes: any = response();
  await requestRegistrationOtp({ ip: 'registration-email-provider-reject', body: { channel: 'email', destination: 'cadet@example.test' } } as any, emailFailureRes);
  assert.strictEqual(emailFailureRes.statusCode, 503);
  assert.match(emailFailureRes.body.message, /could not deliver the email verification code/i);
  assert.deepStrictEqual(deliveryCalls, ['email']);
  assert.strictEqual(challenges.size, 0, 'Email delivery failure leaves no challenge behind.');

  deliveryCalls.length = 0;
  emailResult = true;
  const emailSuccessRes: any = response();
  await requestRegistrationOtp({ ip: 'registration-email-success', body: { channel: 'email', destination: 'cadet@example.test', name: 'Synthetic Cadet' } } as any, emailSuccessRes);
  assert.strictEqual(emailSuccessRes.statusCode, 200);
  assert.strictEqual(emailSuccessRes.body.success, true);
  assert.strictEqual(challenges.get(emailSuccessRes.body.challengeId).destination, 'cadet@example.test');
  const emailVerifyRes: any = response();
  await verifyRegistrationOtp({ ip: 'registration-email-verify', body: { channel: 'email', challengeId: emailSuccessRes.body.challengeId, otp: deliveredEmailOtp } } as any, emailVerifyRes);
  assert.strictEqual(emailVerifyRes.statusCode, 200);
  assert.strictEqual(emailVerifyRes.body.verified, true);

  deliveryCalls.length = 0;
  challenges.clear();
  const firstLoginRes: any = response();
  await startLoginOtp({ ip: 'duplicate-challenge-first', socket: { remoteAddress: 'duplicate-challenge-first' } } as any, user as any, firstLoginRes);
  const firstChallenge = challenges.get(firstLoginRes.body.challengeId);
  const secondLoginRes: any = response();
  await startLoginOtp({ ip: 'duplicate-challenge-second', socket: { remoteAddress: 'duplicate-challenge-second' } } as any, user as any, secondLoginRes);
  const activeChallenges = [...challenges.values()].filter((challenge) => challenge.userId === user.id && !challenge.consumedAt);
  assert.strictEqual(firstChallenge.consumedAt instanceof Date, true, 'A new successful login invalidates the prior challenge.');
  assert.strictEqual(activeChallenges.length, 1, 'Only the newest login OTP remains active.');

  delete process.env.OTP_SECRET;
  console.log('[PASS] Login OTP falls back from failed SMS to eligible email without exposing OTP/provider details.');
  console.log('[PASS] Unavailable SMS and email return controlled 503 and remove undeliverable challenges.');
  console.log('[PASS] Rate-limited login preserves the prior active challenge; unverified email is not used as fallback.');
  console.log('[PASS] Repeated successful login leaves only one active OTP challenge.');
  console.log('[PASS] Registration email delivery, proof verification, channel-specific SMS readiness error, and failed-challenge cleanup.');
};

run().catch((error) => { console.error(error); process.exitCode = 1; });
