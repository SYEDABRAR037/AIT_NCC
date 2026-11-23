import './test-isolation-guard';
import assert from 'assert';
import { prisma } from '../db';
import { register } from '../controllers/auth.controller';

const createResponse = () => ({
  statusCode: 200,
  body: null as any,
  status(code: number) { this.statusCode = code; return this; },
  json(body: any) { this.body = body; return this; },
  setHeader() { return this; },
});

const createRequest = (overrides: Record<string, unknown> = {}) => ({
  body: {
    fullName: 'Synthetic Registration Fixture',
    regimentalNumber: 'TEST-OPT-BIO-001',
    collegeRollNumber: 'TEST-ROLL-001',
    email: 'optional-bio-001@aitpune.test',
    phone: '9876543210',
    password: 'Synthetic-Only-Password-482!',
    mobileChallengeId: 'mobile-proof-fixture',
    emailChallengeId: 'email-proof-fixture',
    ...overrides,
  },
} as any);

async function run() {
  const originals = {
    findChallenge: prisma.otpChallenge.findUnique,
    updateChallenges: prisma.otpChallenge.updateMany,
    userFindFirst: prisma.user.findFirst,
    userCreate: prisma.user.create,
    transaction: prisma.$transaction,
  };
  let userCreateCalls = 0;
  let templateCreateCalls = 0;
  let duplicateMode = false;
  const now = new Date();
  const proofs: Record<string, any> = {
    'mobile-proof-fixture': { id: 'mobile-proof-fixture', purpose: 'REGISTRATION_MOBILE', destination: '+919876543210', verifiedAt: now, proofExpiresAt: new Date(now.getTime() + 60_000), consumedAt: null },
    'email-proof-fixture': { id: 'email-proof-fixture', purpose: 'REGISTRATION_EMAIL', destination: 'optional-bio-001@aitpune.test', verifiedAt: now, proofExpiresAt: new Date(now.getTime() + 60_000), consumedAt: null },
  };

  try {
    (prisma.otpChallenge as any).findUnique = async ({ where }: any) => proofs[where.id];
    (prisma.user as any).findFirst = async () => duplicateMode ? { id: 'synthetic-existing-account' } : null;
    (prisma as any).$transaction = async (callback: any) => callback({
      otpChallenge: { updateMany: async () => ({ count: 1 }) },
      user: { create: async ({ data }: any) => {
        userCreateCalls++;
        return { id: `synthetic-user-${userCreateCalls}`, fullName: data.fullName, status: data.status, profilePhotoUrl: data.profilePhotoUrl };
      } },
      biometricTemplate: { create: async () => { templateCreateCalls++; throw new Error('Registration must not create a biometric template'); } },
    });

    // No descriptor, quality score, or consent field.
    const absentResponse = createResponse();
    await register(createRequest() as any, absentResponse as any);
    assert.strictEqual(absentResponse.statusCode, 201);
    assert.strictEqual(absentResponse.body.success, true);
    assert.strictEqual(absentResponse.body.status, 'UNDER_REVIEW');
    assert.strictEqual(absentResponse.body.biometricEnrolled, false);

    // Explicit refusal is also valid. Legacy biometric fields are ignored and never persisted.
    const refusedResponse = createResponse();
    await register(createRequest({
      regimentalNumber: 'TEST-OPT-BIO-002',
      collegeRollNumber: 'TEST-ROLL-002',
      biometricConsent: false,
      faceDescriptor: new Array(128).fill(0.25),
      qualityScore: 0.99,
    }) as any, refusedResponse as any);
    assert.strictEqual(refusedResponse.statusCode, 201);
    assert.strictEqual(refusedResponse.body.success, true);
    assert.strictEqual(refusedResponse.body.biometricEnrolled, false);
    assert.strictEqual(userCreateCalls, 2);
    assert.strictEqual(templateCreateCalls, 0);

    // Existing required-field and password-policy checks remain enforced.
    const missingFieldResponse = createResponse();
    await register(createRequest({ email: '' }) as any, missingFieldResponse as any);
    assert.strictEqual(missingFieldResponse.statusCode, 400);

    const weakPasswordResponse = createResponse();
    await register(createRequest({ password: 'weak' }) as any, weakPasswordResponse as any);
    assert.strictEqual(weakPasswordResponse.statusCode, 400);

    const invalidProofResponse = createResponse();
    await register(createRequest({ mobileChallengeId: 'missing-mobile-proof' }) as any, invalidProofResponse as any);
    assert.strictEqual(invalidProofResponse.statusCode, 400);
    assert.strictEqual(userCreateCalls, 2);

    duplicateMode = true;
    const duplicateResponse = createResponse();
    await register(createRequest() as any, duplicateResponse as any);
    assert.strictEqual(duplicateResponse.statusCode, 409);
    assert.strictEqual(userCreateCalls, 2);

    console.log('[PASS] Registration succeeds without biometric fields and does not create biometric templates');
    console.log('[PASS] Registration succeeds when biometric consent is false');
    console.log('[PASS] Existing required-field, password, OTP proof, and duplicate-account validations remain enforced');
  } finally {
    (prisma.otpChallenge as any).findUnique = originals.findChallenge;
    (prisma.otpChallenge as any).updateMany = originals.updateChallenges;
    (prisma.user as any).findFirst = originals.userFindFirst;
    (prisma.user as any).create = originals.userCreate;
    (prisma as any).$transaction = originals.transaction;
  }
}

run().catch((error) => {
  console.error('[FAIL] Optional registration tests:', error?.message || error);
  process.exitCode = 1;
});
