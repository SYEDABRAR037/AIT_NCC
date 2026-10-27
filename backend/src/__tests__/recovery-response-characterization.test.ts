import assert from 'assert';

// Mock dependencies before importing the controller. No real client or mail adapter is created.
const Module = require('module');
const syntheticUser = { id: 'synthetic-recovery-user', fullName: 'Synthetic Test Cadet', email: 'synthetic@example.test', regimentalNumber: 'SYN-001' };
const challenges = new Map<string, any>();
let mailDispatchSucceeds = true;
let challengeSequence = 0;
let dispatchCount = 0;
const fakePrisma: any = {
  user: {
    findFirst: async ({ where }: any) => where.AND[0].email.equals === syntheticUser.email && where.AND[1].regimentalNumber.equals === syntheticUser.regimentalNumber ? syntheticUser : null,
    update: async () => ({}),
  },
  recoveryChallenge: {
    findFirst: async ({ where }: any) => [...challenges.values()].find((c) => c.lookupHash === where.lookupHash && c.createdAt >= where.createdAt.gte) || null,
    count: async ({ where }: any) => [...challenges.values()].filter((c) => c.lookupHash === where.lookupHash && c.createdAt >= where.createdAt.gte).length,
    findUnique: async ({ where }: any) => challenges.get(where.id) || null,
    create: async ({ data }: any) => {
      const id = `synthetic-recovery-${++challengeSequence}`;
      const value = { id, ...data, createdAt: new Date(), usedAt: null, verifiedAt: null, user: data.userId ? syntheticUser : null };
      challenges.set(id, value);
      return value;
    },
    updateMany: async ({ where, data }: any) => {
      const value = challenges.get(where.id);
      if (!value) return { count: 0 };
      if (data.attemptCount?.increment) value.attemptCount += data.attemptCount.increment;
      for (const [key, val] of Object.entries(data)) if (key !== 'attemptCount') value[key] = val;
      return { count: 1 };
    },
    update: async ({ where, data }: any) => { const value = challenges.get(where.id); Object.assign(value, data); return value; },
  },
  auditLog: { create: async () => ({ id: 'synthetic-audit-id' }) },
  $transaction: async (fn: any) => fn(fakePrisma),
};
const fakeDispatcher = { dispatch: async () => { dispatchCount += 1; return mailDispatchSucceeds; } };
const originalLoad = Module._load;
Module._load = function (request: string, parent: any, isMain: boolean) {
  if (request === '../db' && parent?.filename.includes('recovery.controller')) return { prisma: fakePrisma };
  if (request === '../services/recoveryOtpDispatcher' && parent?.filename.includes('recovery.controller')) return { recoveryOtpDispatcher: fakeDispatcher };
  return originalLoad.call(this, request, parent, isMain);
};
const { requestPasswordResetOtp, verifyPasswordResetOtp } = require('../controllers/recovery.controller') as typeof import('../controllers/recovery.controller');
Module._load = originalLoad;

const response = () => ({
  statusCode: 200,
  body: undefined as any,
  status(code: number) { this.statusCode = code; return this; },
  json(body: unknown) { this.body = body; return this; },
});
const invoke = async (regimentalNumber: string, ip: string) => {
  const res: any = response();
  await requestPasswordResetOtp({ body: { email: syntheticUser.email, regimentalNumber }, ip, socket: { remoteAddress: ip } } as any, res);
  return res;
};
const verify = async (recoveryId: string, otp = '000000') => {
  const res: any = response();
  const ip = `synthetic-verify-${Math.random()}`;
  await verifyPasswordResetOtp({ body: { recoveryId, otp }, ip, socket: { remoteAddress: ip } } as any, res);
  return res;
};
const comparable = (body: any) => ({ success: body.success, challengeAccepted: body.challengeAccepted, nextStep: body.nextStep, message: body.message, maskedEmail: body.maskedEmail });

const run = async (): Promise<void> => {
  const known = await invoke(syntheticUser.regimentalNumber, 'synthetic-known-ip');
  const unknown = await invoke('SYN-404', 'synthetic-unknown-ip');
  assert.strictEqual(known.statusCode, 200);
  assert.strictEqual(unknown.statusCode, 200);
  assert.deepStrictEqual(comparable(known.body), comparable(unknown.body));
  assert.ok(known.body.recoveryId && unknown.body.recoveryId);
  assert.strictEqual(dispatchCount, 1, 'Only the matching synthetic account is dispatched.');

  const cooldown = await invoke(syntheticUser.regimentalNumber, 'synthetic-cooldown-ip');
  assert.deepStrictEqual(comparable(cooldown.body), comparable(known.body));
  assert.strictEqual(dispatchCount, 1, 'Cooldown challenge is not dispatched.');

  const knownChallenge = challenges.get(known.body.recoveryId);
  const unknownChallenge = challenges.get(unknown.body.recoveryId);
  challenges.clear(); // Isolate the provider-failure case from the cooldown case.
  mailDispatchSucceeds = false;
  const mailFailure = await invoke(syntheticUser.regimentalNumber, 'synthetic-mail-failure-ip');
  mailDispatchSucceeds = true;
  assert.deepStrictEqual(comparable(mailFailure.body), comparable(known.body));
  assert.strictEqual(dispatchCount, 2, 'The mocked provider was invoked once for the eligible request.');

  challenges.set(known.body.recoveryId, knownChallenge);
  challenges.set(unknown.body.recoveryId, unknownChallenge);
  const expired = challenges.get(known.body.recoveryId);
  expired.expiresAt = new Date(Date.now() - 1);
  const expiredResult = await verify(known.body.recoveryId);
  assert.strictEqual(expiredResult.statusCode, 400);
  assert.deepStrictEqual(expiredResult.body, { success: false, message: 'Invalid or expired OTP. Please request a new one.' });

  const invalidChallenge = challenges.get(unknown.body.recoveryId);
  invalidChallenge.expiresAt = new Date(Date.now() + 60_000);
  for (let i = 0; i < 5; i += 1) {
    const invalid = await verify(unknown.body.recoveryId);
    assert.strictEqual(invalid.statusCode, 400);
    assert.deepStrictEqual(invalid.body, expiredResult.body);
  }
  console.log('Recovery mocked regressions passed: known/unknown, cooldown, mail failure, expiry, and invalid-attempt cap.');
};

run().catch((error) => {
  console.error('Recovery mocked regressions failed:', error instanceof Error ? error.message : 'unknown assertion error');
  process.exitCode = 1;
});
