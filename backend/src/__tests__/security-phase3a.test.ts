import './test-isolation-guard';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { Role, AccountStatus } from '@prisma/client';
import { prisma } from '../db';
import { getMyDigitalId, getCadetDigitalId, verifyDigitalId } from '../controllers/digitalId.controller';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { hashOtp, verifyChallengeCode, safeEqual, getOtpTransitionCutoff, verifyRegistrationOtp } from '../controllers/otpAuth.controller';
import { validateRuntimeConfig } from '../runtimeConfig';

function createMockContext() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
  };

  const req: any = {
    params: {},
    query: {},
    body: {},
    headers: {},
    cookies: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  };

  return { req, res };
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('  NCC PHASE 3A.1 SECURITY & VERIFICATION TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function recordResult(testName: string, success: boolean, details?: string) {
    if (success) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}: ${details}`);
      failed++;
    }
  }

  // Backup original prisma methods
  const originalUserFindUnique = prisma.user.findUnique;
  const originalUserFindFirst = prisma.user.findFirst;
  const originalUserUpdateMany = prisma.user.updateMany;
  const originalSeniorAssignmentFindFirst = prisma.seniorAssignment.findFirst;
  const originalPlatoonSeniorAssignmentFindFirst = prisma.platoonSeniorAssignment.findFirst;
  const originalAuthSessionFindFirst = prisma.authSession.findFirst;

  // Silence expected console.error during deliberate error injection tests
  const originalConsoleError = console.error;
  function silenceExpectedError() {
    console.error = () => {};
  }
  function restoreConsoleError() {
    console.error = originalConsoleError;
  }

  try {
    // ------------------------------------------------------------------------
    // Group 1: Digital ID database failures return safe generic JSON errors (D4)
    // ------------------------------------------------------------------------
    {
      const { req, res } = createMockContext();
      req.user = { id: 'cadet-1', role: Role.CADET, status: AccountStatus.ACTIVE };
      (prisma.user as any).findUnique = async () => {
        throw new Error('Database connection terminated unexpectedly');
      };

      silenceExpectedError();
      await getMyDigitalId(req, res);
      restoreConsoleError();

      const isSafe500 = res.statusCode === 500 &&
        res.body &&
        res.body.success === false &&
        res.body.message === 'Internal server error' &&
        !JSON.stringify(res.body).includes('Database connection');

      recordResult('1.1 getMyDigitalId returns safe 500 JSON without leaking DB error', isSafe500);
    }

    {
      const { req, res } = createMockContext();
      req.user = { id: 'officer-1', role: Role.ADMIN_ANO, status: AccountStatus.ACTIVE };
      req.params = { cadetId: 'cadet-1' };
      (prisma.user as any).findFirst = async () => {
        throw new Error('PrismaClientKnownRequestError: connection failure');
      };

      silenceExpectedError();
      await getCadetDigitalId(req, res);
      restoreConsoleError();

      const isSafe500 = res.statusCode === 500 &&
        res.body &&
        res.body.success === false &&
        res.body.message === 'Internal server error' &&
        !JSON.stringify(res.body).includes('PrismaClient');

      recordResult('1.2 getCadetDigitalId returns safe 500 JSON on database exception', isSafe500);
    }

    {
      const { req, res } = createMockContext();
      req.params = { token: 'valid-token-uuid-12345' };
      (prisma.user as any).findUnique = async () => {
        throw new Error('Postgres query timeout');
      };

      silenceExpectedError();
      await verifyDigitalId(req, res);
      restoreConsoleError();

      const isSafe500 = res.statusCode === 500 &&
        res.body &&
        res.body.success === false &&
        res.body.message === 'Internal server error' &&
        !JSON.stringify(res.body).includes('Postgres');

      recordResult('1.3 verifyDigitalId returns safe 500 JSON on database exception', isSafe500);
    }

    // ------------------------------------------------------------------------
    // Group 2: Digital ID successful responses remain unchanged
    // ------------------------------------------------------------------------
    {
      const mockCadet = {
        id: 'cadet-100',
        fullName: 'Aarav Sharma',
        rank: 'Cadet',
        regimentalNumber: 'MH24SDA100200',
        collegeRollNumber: '2024CE050',
        year: 'SE (2nd Year)',
        platoonName: 'Alpha Platoon',
        team: 'Alpha-1',
        status: AccountStatus.ACTIVE,
        profilePhotoUrl: 'https://storage.local/photo.jpg',
      };

      (prisma.user as any).findUnique = async ({ where, select }: any) => {
        if (where.id === 'cadet-100') {
          if (select?.digitalIdToken) return { digitalIdToken: 'tok-existing-uuid-100' };
          return mockCadet;
        }
        if (where.digitalIdToken === 'tok-existing-uuid-100') {
          return mockCadet;
        }
        return null;
      };

      const { req: reqMy, res: resMy } = createMockContext();
      reqMy.user = { id: 'cadet-100', role: Role.CADET, status: AccountStatus.ACTIVE };
      await getMyDigitalId(reqMy, resMy);

      const mySuccessMatches = resMy.statusCode === 200 &&
        resMy.body?.success === true &&
        resMy.body?.token === 'tok-existing-uuid-100' &&
        resMy.body?.cadet?.fullName === 'Aarav Sharma' &&
        resMy.body?.cadet?.regimentalNumber === 'MH24SDA100200';

      recordResult('2.1 getMyDigitalId returns correct payload and token on success', mySuccessMatches);

      const { req: reqVerify, res: resVerify } = createMockContext();
      reqVerify.params = { token: 'tok-existing-uuid-100' };
      await verifyDigitalId(reqVerify, resVerify);

      const verifySuccessMatches = resVerify.statusCode === 200 &&
        resVerify.body?.success === true &&
        resVerify.body?.status === 'VALID' &&
        resVerify.body?.cadet?.fullName === 'Aarav Sharma' &&
        resVerify.body?.cadet?.regimentalNumber === 'MH24SDA100200' &&
        resVerify.body?.cadet?.profilePhotoUrl === 'https://storage.local/photo.jpg';

      recordResult('2.2 verifyDigitalId returns VALID status and cadet verification fields', verifySuccessMatches);
    }

    // ------------------------------------------------------------------------
    // Group 3: Digital ID authorization remains strictly enforced
    // ------------------------------------------------------------------------
    {
      const { req, res } = createMockContext();
      req.user = undefined;
      await getMyDigitalId(req, res);
      recordResult('3.1 getMyDigitalId rejects unauthenticated request with 401', res.statusCode === 401);
    }

    {
      const { req, res } = createMockContext();
      req.user = { id: 'cadet-1', role: Role.CADET, status: AccountStatus.UNDER_REVIEW };
      await getMyDigitalId(req, res);
      recordResult('3.2 getMyDigitalId forbids non-ACTIVE cadet account with 403', res.statusCode === 403);
    }

    {
      const { req, res } = createMockContext();
      req.user = { id: 'senior-1', role: Role.SENIOR, status: AccountStatus.ACTIVE };
      req.params = { cadetId: 'cadet-unassigned' };
      (prisma.user as any).findFirst = async () => ({
        id: 'cadet-unassigned',
        role: Role.CADET,
        platoonName: 'Bravo',
      });
      (prisma.seniorAssignment as any).findFirst = async () => null;

      await getCadetDigitalId(req, res);
      recordResult('3.3 getCadetDigitalId forbids SENIOR without cadet assignment (403)', res.statusCode === 403);
    }

    {
      const { req, res } = createMockContext();
      req.params = { token: 'x'.repeat(81) };
      await verifyDigitalId(req, res);
      recordResult('3.4 verifyDigitalId rejects oversized tokens (>80 chars) with 400', res.statusCode === 400);
    }

    // ------------------------------------------------------------------------
    // Group 4: Registration logs never contain cadet PII (D1)
    // ------------------------------------------------------------------------
    {
      const authControllerSrc = fs.readFileSync(
        path.resolve(__dirname, '../controllers/auth.controller.ts'),
        'utf8'
      );

      const hasFullNameLog = /\[REGISTRATION\].*newUser\.fullName/.test(authControllerSrc);
      const hasRegimentalLog = /\[REGISTRATION\].*newUser\.regimentalNumber/.test(authControllerSrc);
      const hasProfilePhotoLog = /\[REGISTRATION\].*newUser\.profilePhotoUrl/.test(authControllerSrc);
      const hasSanitizedLog = /\[REGISTRATION\] New cadet registered: ID \$\{newUser\.id\}/.test(authControllerSrc);

      const piiSanitized = !hasFullNameLog && !hasRegimentalLog && !hasProfilePhotoLog && hasSanitizedLog;
      recordResult('4.1 Registration log outputs only non-identifying user ID without PII', piiSanitized);
    }

    // ------------------------------------------------------------------------
    // Group 5 & 6: JWT algorithm restriction — HS256 accepted, others rejected (D5)
    // ------------------------------------------------------------------------
    {
      const secret = 'ncc-test-jwt-secret-key-32chars!!';
      process.env.JWT_SECRET = secret;

      (prisma.authSession as any).findFirst = async ({ where }: any) => {
        if (where.id === 'valid-sid' && where.userId === 'user-jwt-1') {
          return { id: 'valid-sid', userId: 'user-jwt-1', expiresAt: new Date(Date.now() + 60000), revokedAt: null };
        }
        return null;
      };

      (prisma.user as any).findUnique = async ({ where }: any) => {
        if (where.id === 'user-jwt-1') {
          return {
            id: 'user-jwt-1',
            fullName: 'Valid User',
            regimentalNumber: 'MH24SDA100201',
            collegeRollNumber: '2024CE051',
            email: 'user@aitpune.edu.in',
            role: Role.CADET,
            status: AccountStatus.ACTIVE,
            platoonName: 'Alpha Platoon',
            profilePhotoUrl: null,
          };
        }
        return null;
      };

      // 5.1 Valid HS256 token
      const validHS256Token = jwt.sign(
        { userId: 'user-jwt-1', sid: 'valid-sid' },
        secret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const { req: reqValid, res: resValid } = createMockContext();
      reqValid.headers['authorization'] = `Bearer ${validHS256Token}`;
      let nextCalled = false;
      await authenticateToken(reqValid as AuthRequest, resValid, (() => { nextCalled = true; }) as any);

      recordResult('5.1 Valid HS256 signed token is verified and accepted', nextCalled && (reqValid as AuthRequest).user?.id === 'user-jwt-1');

      // 6.1 Disallowed algorithm HS384
      const hs384Token = jwt.sign(
        { userId: 'user-jwt-1', sid: 'valid-sid' },
        secret,
        { algorithm: 'HS384', expiresIn: '1h' }
      );

      const { req: req384, res: res384 } = createMockContext();
      req384.headers['authorization'] = `Bearer ${hs384Token}`;
      let nextCalled384 = false;
      await authenticateToken(req384 as AuthRequest, res384, (() => { nextCalled384 = true; }) as any);

      recordResult('6.1 HS384 token is rejected with 401 (algorithm restriction)', !nextCalled384 && res384.statusCode === 401);

      // 6.2 Disallowed algorithm none / unsigned token
      const unsignedToken = jwt.sign(
        { userId: 'user-jwt-1', sid: 'valid-sid' },
        '',
        { algorithm: 'none' }
      );

      const { req: reqNone, res: resNone } = createMockContext();
      reqNone.headers['authorization'] = `Bearer ${unsignedToken}`;
      let nextCalledNone = false;
      await authenticateToken(reqNone as AuthRequest, resNone, (() => { nextCalledNone = true; }) as any);

      recordResult('6.2 Unsigned / none algorithm token is rejected with 401', !nextCalledNone && resNone.statusCode === 401);
    }

    // ------------------------------------------------------------------------
    // Group 7: Expired and revoked sessions remain rejected
    // ------------------------------------------------------------------------
    {
      const secret = process.env.JWT_SECRET!;

      // 7.1 Expired token
      const expiredToken = jwt.sign(
        { userId: 'user-jwt-1', sid: 'valid-sid' },
        secret,
        { algorithm: 'HS256', expiresIn: '-1s' }
      );

      const { req: reqExp, res: resExp } = createMockContext();
      reqExp.headers['authorization'] = `Bearer ${expiredToken}`;
      let nextCalledExp = false;
      await authenticateToken(reqExp as AuthRequest, resExp, (() => { nextCalledExp = true; }) as any);

      recordResult('7.1 Expired token is rejected with 401', !nextCalledExp && resExp.statusCode === 401);

      // 7.2 Token with revoked session in database
      (prisma.authSession as any).findFirst = async () => null;

      const validTokenWithRevokedSession = jwt.sign(
        { userId: 'user-jwt-1', sid: 'revoked-sid' },
        secret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const { req: reqRev, res: resRev } = createMockContext();
      reqRev.headers['authorization'] = `Bearer ${validTokenWithRevokedSession}`;
      let nextCalledRev = false;
      await authenticateToken(reqRev as AuthRequest, resRev, (() => { nextCalledRev = true; }) as any);

      recordResult('7.2 Token presenting revoked/non-existent session is rejected with 401', !nextCalledRev && resRev.statusCode === 401 && resRev.body?.message?.includes('Session is no longer valid'));
    }

    // ------------------------------------------------------------------------
    // Group 8: v2: Prefix Scheme, Deterministic Cutoff & Rolling-Deployment Verification (Phase 3A.3.2)
    // ------------------------------------------------------------------------
    {
      const testOtpSecret = 'dedicated-otp-secret-32-characters-test!!';
      const testJwtSecret = 'separate-jwt-secret-32-characters-test!!';
      process.env.OTP_SECRET = testOtpSecret;
      process.env.JWT_SECRET = testJwtSecret;

      // Single explicit shared transition cutoff timestamp (5 minutes in future)
      const sharedCutoff = new Date(Date.now() + 300_000);
      process.env.OTP_TRANSITION_CUTOFF = sharedCutoff.toISOString();

      const newInstanceStartTime = new Date();

      // ---- 8.1: Legacy original OTP (sendCount=1, raw hex, JWT_SECRET, before cutoff) → accepted ----
      const legacyOriginalChallenge = {
        id: 'chall-legacy-original',
        otpHash: hashOtp('chall-legacy-original', '111222', testJwtSecret), // raw hex; legacy path
        createdAt: new Date(newInstanceStartTime.getTime() + 5_000), // issued after new instance, before cutoff
        expiresAt: new Date(Date.now() + 55_000), // unexpired
        sendCount: 1,
      };
      const legacyOriginalAccepted = verifyChallengeCode(legacyOriginalChallenge, '111222');
      recordResult('8.1 Legacy original OTP (raw hex, JWT_SECRET, before cutoff) is accepted', legacyOriginalAccepted === true);

      // ---- 8.2: Legacy OTP resent by old instance (raw hex, sendCount=2, before cutoff) → accepted via JWT_SECRET ----
      // Old instance can resend using JWT_SECRET, leaving sendCount > 1 with a raw hex hash.
      // The sendCount check has been removed from the legacy path so this is verifiable.
      const legacyResentByOldInstance = {
        id: 'chall-legacy-resent',
        otpHash: hashOtp('chall-legacy-resent', '333444', testJwtSecret), // raw hex; old instance wrote this on resend
        createdAt: new Date(newInstanceStartTime.getTime() + 2_000), // before cutoff
        expiresAt: new Date(Date.now() + 50_000), // unexpired
        sendCount: 2, // resent by old instance
      };
      const legacyResentAccepted = verifyChallengeCode(legacyResentByOldInstance, '333444');
      recordResult('8.2 Legacy OTP resent by old instance (raw hex, sendCount=2) accepted via bounded JWT_SECRET path', legacyResentAccepted === true);

      // ---- 8.3: New OTP created before cutoff (v2: prefix, OTP_SECRET) → accepted; never falls back to JWT_SECRET ----
      const newOtpBeforeCutoff = {
        id: 'chall-new-before-cutoff',
        otpHash: `v2:${hashOtp('chall-new-before-cutoff', '555666', testOtpSecret)}`, // new code path
        createdAt: new Date(newInstanceStartTime.getTime() + 1_000), // before cutoff
        expiresAt: new Date(Date.now() + 55_000),
        sendCount: 1,
      };
      const newBeforeCutoffAccepted = verifyChallengeCode(newOtpBeforeCutoff, '555666');
      // Also verify it does NOT fall back to JWT_SECRET: use wrong OTP but correct JWT_SECRET hash
      const newOtpBeforeCutoffWrongKey = {
        ...newOtpBeforeCutoff,
        otpHash: `v2:${hashOtp('chall-new-before-cutoff', '555666', testJwtSecret)}`, // v2: but signed with wrong key
      };
      const newBeforeCutoffWrongKeyRejected = !verifyChallengeCode(newOtpBeforeCutoffWrongKey, '555666');
      recordResult('8.3 New OTP (v2: prefix) created before cutoff: accepted via OTP_SECRET; never falls back to JWT_SECRET', newBeforeCutoffAccepted === true && newBeforeCutoffWrongKeyRejected === true);

      // ---- 8.4: New OTP created after cutoff (v2: prefix, OTP_SECRET, createdAt > cutoff) → accepted ----
      const newOtpAfterCutoff = {
        id: 'chall-new-after-cutoff',
        otpHash: `v2:${hashOtp('chall-new-after-cutoff', '777888', testOtpSecret)}`,
        createdAt: new Date(sharedCutoff.getTime() + 10_000), // after cutoff
        expiresAt: new Date(Date.now() + 50_000),
        sendCount: 1,
      };
      const newAfterCutoffAccepted = verifyChallengeCode(newOtpAfterCutoff, '777888');
      recordResult('8.4 New OTP (v2: prefix) created after cutoff is accepted via OTP_SECRET', newAfterCutoffAccepted === true);

      // ---- 8.5: New OTP resend (v2: prefix, OTP_SECRET, sendCount=2) → accepted ----
      const newOtpResent = {
        id: 'chall-new-resent',
        otpHash: `v2:${hashOtp('chall-new-resent', '999000', testOtpSecret)}`,
        createdAt: new Date(newInstanceStartTime.getTime() + 3_000),
        expiresAt: new Date(Date.now() + 50_000),
        sendCount: 2, // resent by new code — still v2:
      };
      const newResentAccepted = verifyChallengeCode(newOtpResent, '999000');
      recordResult('8.5 New OTP resend (v2: prefix, sendCount=2) is accepted via OTP_SECRET', newResentAccepted === true);

      // ---- 8.6: Expired legacy OTP (raw hex, before cutoff, expiresAt < now) → rejected ----
      const expiredLegacyChallenge = {
        id: 'chall-expired-legacy',
        otpHash: hashOtp('chall-expired-legacy', '112233', testJwtSecret),
        createdAt: new Date(newInstanceStartTime.getTime() + 2_000),
        expiresAt: new Date(Date.now() - 5_000), // EXPIRED
        sendCount: 1,
      };
      const expiredLegacyRejected = verifyChallengeCode(expiredLegacyChallenge, '112233');
      recordResult('8.6 Expired legacy OTP (before cutoff, expiresAt in past) is rejected', expiredLegacyRejected === false);

      // ---- 8.7: Missing OTP_TRANSITION_CUTOFF → legacy path disabled; new v2: still accepted ----
      const savedCutoff = process.env.OTP_TRANSITION_CUTOFF;
      delete process.env.OTP_TRANSITION_CUTOFF;

      const legacyWithNoCutoff = verifyChallengeCode(legacyOriginalChallenge, '111222');
      const v2WithNoCutoff = verifyChallengeCode(newOtpBeforeCutoff, '555666');
      process.env.OTP_TRANSITION_CUTOFF = savedCutoff;

      recordResult('8.7 Missing OTP_TRANSITION_CUTOFF disables legacy fallback; v2: challenges still verify', legacyWithNoCutoff === false && v2WithNoCutoff === true);

      // ---- 8.8: Invalid cutoff formats rejected by validateRuntimeConfig ----
      const mockEnv = {
        JWT_SECRET: 'x'.repeat(32),
        OTP_SECRET: 'x'.repeat(32),
        DATABASE_URL: 'postgresql://synthetic:placeholder@db.invalid:5432/ncc_test',
        PORT: '8080',
      };

      const invalidCutoffCases: Array<{ label: string; value: string }> = [
        { label: 'local-time string', value: '2026-11-07 22:30:00' },
        { label: 'bare year', value: '2026' },
        { label: 'invalid calendar date (Feb 31)', value: '2026-02-31T22:30:00Z' },
        { label: 'non-ISO string', value: 'not-a-valid-date' },
      ];

      let allInvalidCutoffsFail = true;
      for (const { label, value } of invalidCutoffCases) {
        let failed = false;
        try {
          validateRuntimeConfig({ ...mockEnv, OTP_TRANSITION_CUTOFF: value });
        } catch (e: any) {
          failed = e?.message?.includes('OTP_TRANSITION_CUTOFF');
        }
        if (!failed) {
          allInvalidCutoffsFail = false;
          console.error(`  [FAIL detail] 8.8: cutoff format '${label}' (${value}) was not rejected`);
        }
      }

      let missingOtpSecretFails = false;
      try { validateRuntimeConfig({ ...mockEnv, OTP_SECRET: undefined }); } catch (e: any) {
        missingOtpSecretFails = e?.message?.includes('OTP_SECRET');
      }
      let shortOtpSecretFails = false;
      try { validateRuntimeConfig({ ...mockEnv, OTP_SECRET: 'short' }); } catch (e: any) {
        shortOtpSecretFails = e?.message?.includes('OTP_SECRET');
      }
      let placeholderOtpSecretFails = false;
      try { validateRuntimeConfig({ ...mockEnv, OTP_SECRET: 'SET_ME' }); } catch (e: any) {
        placeholderOtpSecretFails = e?.message?.includes('OTP_SECRET');
      }

      // Valid cutoff should NOT throw
      let validCutoffAccepted = false;
      try {
        validateRuntimeConfig({ ...mockEnv, OTP_TRANSITION_CUTOFF: '2026-11-07T22:30:00Z' });
        validCutoffAccepted = true;
      } catch { validCutoffAccepted = false; }

      recordResult(
        '8.8 Invalid cutoff formats and missing/short/placeholder OTP_SECRET safely prevent startup; valid cutoff is accepted',
        allInvalidCutoffsFail && missingOtpSecretFails && shortOtpSecretFails && placeholderOtpSecretFails && validCutoffAccepted,
      );

      // ---- 8.9: Multiple instances with identical config produce deterministic, consistent results ----
      const instanceALegacy = verifyChallengeCode(legacyOriginalChallenge, '111222');
      const instanceBLegacy = verifyChallengeCode(legacyOriginalChallenge, '111222');
      const instanceAV2     = verifyChallengeCode(newOtpAfterCutoff, '777888');
      const instanceBV2     = verifyChallengeCode(newOtpAfterCutoff, '777888');
      const instanceAPostCutoff = verifyChallengeCode(
        { ...legacyOriginalChallenge, createdAt: new Date(sharedCutoff.getTime() + 1_000) },
        '111222',
      );
      const instanceBPostCutoff = verifyChallengeCode(
        { ...legacyOriginalChallenge, createdAt: new Date(sharedCutoff.getTime() + 1_000) },
        '111222',
      );
      const instancesConsistent =
        instanceALegacy === instanceBLegacy &&
        instanceAV2 === instanceBV2 &&
        instanceAPostCutoff === instanceBPostCutoff;
      recordResult('8.9 Multiple instances with identical shared config produce identical, deterministic results', instancesConsistent);

      // ---- 8.10: Attempt limits (429) and expiry (400) enforced by controller; timing-safe comparison ----
      (prisma.otpChallenge as any).findUnique = async ({ where }: any) => {
        if (where.id === 'chall-over-attempt') {
          return {
            id: 'chall-over-attempt',
            purpose: 'REGISTRATION_EMAIL',
            consumedAt: null,
            otpHash: `v2:${hashOtp('chall-over-attempt', '123456', testOtpSecret)}`,
            expiresAt: new Date(Date.now() + 30_000),
            attemptCount: 5, // exceeded limit
            createdAt: new Date(),
            sendCount: 1,
          };
        }
        if (where.id === 'chall-expired') {
          return {
            id: 'chall-expired',
            purpose: 'REGISTRATION_EMAIL',
            consumedAt: null,
            otpHash: `v2:${hashOtp('chall-expired', '123456', testOtpSecret)}`,
            expiresAt: new Date(Date.now() - 5_000), // expired
            attemptCount: 0,
            createdAt: new Date(),
            sendCount: 1,
          };
        }
        return null;
      };

      const { req: reqLimit, res: resLimit } = createMockContext();
      reqLimit.body = { challengeId: 'chall-over-attempt', otp: '123456', channel: 'email' };
      await verifyRegistrationOtp(reqLimit, resLimit);
      const attemptLimited = resLimit.statusCode === 429;

      const { req: reqExpChall, res: resExpChall } = createMockContext();
      reqExpChall.body = { challengeId: 'chall-expired', otp: '123456', channel: 'email' };
      await verifyRegistrationOtp(reqExpChall, resExpChall);
      const expiredRejected = resExpChall.statusCode === 400;

      // Timing-safe equality checks
      const hashA = hashOtp('id', '123456', testOtpSecret);
      const hashB = hashOtp('id', '123456', testOtpSecret);
      const hashC = hashOtp('id', '654321', testOtpSecret);
      const timingSafeCorrect = safeEqual(hashA, hashB) === true && safeEqual(hashA, hashC) === false;

      recordResult('8.10 Controller enforces attempt limit (429) and expiry (400); timing-safe comparison is correct', attemptLimited && expiredRejected && timingSafeCorrect);
    }

  } finally {
    // Restore prisma original methods
    (prisma.user as any).findUnique = originalUserFindUnique;
    (prisma.user as any).findFirst = originalUserFindFirst;
    (prisma.user as any).updateMany = originalUserUpdateMany;
    (prisma.seniorAssignment as any).findFirst = originalSeniorAssignmentFindFirst;
    (prisma.platoonSeniorAssignment as any).findFirst = originalPlatoonSeniorAssignmentFindFirst;
    (prisma.authSession as any).findFirst = originalAuthSessionFindFirst;
  }

  console.log('\n===============================================================');
  console.log(`  PHASE 3A.1–3A.3.2 SECURITY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

void runTestSuite();

