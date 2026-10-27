import './test-isolation-guard';
import assert from 'assert';
import { prisma } from '../db';
import * as attendanceNotificationService from '../services/attendanceNotification.service';
import {
  issueVerificationChallenge,
  verifyFaceAttendance,
  getEligibleBiometrics,
  markAttendance,
} from '../controllers/attendance.controller';

// ============================================================================
// NCC BIOMETRIC ATTENDANCE SECURITY TEST SUITE (PHASE 2 HARDENING)
//
// Structured into two distinct testing categories:
// PART A: Unit Tests (Isolated Contract, Input Validation & Role Policy)
// PART B: Integration & Concurrency Tests (Challenge Lifecycles & Race Conditions)
// ============================================================================

async function runTestSuite() {
  console.log('===============================================================');
  console.log('  NCC BIOMETRIC SECURITY & INTEGRITY TEST SUITE (PHASE 2)');
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

  function createMockRes() {
    return {
      statusCode: 200,
      body: null as any,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        this.body = data;
        return this;
      },
    };
  }

  // Preserve and mock notification service boundary
  const originalTriggerPresent = attendanceNotificationService.triggerPresentAttendanceNotifications;
  const originalTriggerAbsent = attendanceNotificationService.triggerAbsentAttendanceNotifications;
  const originalQueueNotification = (attendanceNotificationService as any).queueAttendanceNotification;

  (attendanceNotificationService as any).triggerPresentAttendanceNotifications = async () => ({
    smsQueued: true,
    whatsappQueued: true,
  });
  (attendanceNotificationService as any).triggerAbsentAttendanceNotifications = async () => ({
    smsQueued: true,
    whatsappQueued: true,
  });
  if (originalQueueNotification) {
    (attendanceNotificationService as any).queueAttendanceNotification = async () => ({
      success: true,
      status: 'QUEUED',
    });
  }

  // Preserve original Prisma methods
  const originalSessionFindUnique = prisma.trainingSession.findUnique;
  const originalUserFindMany = prisma.user.findMany;
  const originalUserFindFirst = prisma.user.findFirst;
  const originalBiometricFindMany = prisma.biometricTemplate.findMany;
  const originalLeaveFindFirst = prisma.leave.findFirst;
  const originalAttendanceFindUnique = prisma.trainingAttendance.findUnique;
  const originalSeniorAssignmentFindMany = prisma.seniorAssignment.findMany;
  const originalAuditLogCreate = prisma.auditLog.create;
  const originalAttendanceNotificationCreate = (prisma as any).attendanceNotification?.create;

  // Global write mocks: ensure no real database write can escape in any test
  const auditLogsRecorded: any[] = [];
  (prisma.auditLog as any).create = async (args: any) => {
    auditLogsRecorded.push(args);
    return {
      id: `mock-audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorId: args?.data?.actorId || 'mock-actor',
      action: args?.data?.action || 'MANUAL_ATTENDANCE_OVERRIDE',
      targetId: args?.data?.targetId || 'mock-target',
      details: args?.data?.details || '{}',
      createdAt: new Date(),
    };
  };

  if ((prisma as any).attendanceNotification) {
    (prisma as any).attendanceNotification.create = async (args: any) => ({
      id: `mock-notif-${Date.now()}`,
      ...(args?.data || {}),
      createdAt: new Date(),
    });
  }

  // Default in-memory mocks for read models used during authentication/scope checks
  (prisma.seniorAssignment as any).findMany = async () => [];
  (prisma.biometricTemplate as any).findMany = async () => [];

  const originalTransaction = prisma.$transaction;

  console.log('---------------------------------------------------------------');
  console.log('  PART A: UNIT TESTS (ISOLATED CONTRACT & POLICY VERIFICATIONS)');
  console.log('---------------------------------------------------------------\n');

  // --------------------------------------------------------------------------
  // Unit Test 1: Automatic biometric attendance is disabled by default
  // --------------------------------------------------------------------------
  try {
    delete process.env.ENABLE_BIOMETRIC_ATTENDANCE;
    const req: any = {
      params: { sessionId: 'session-unit-1' },
      user: { id: 'senior-1', role: 'SENIOR', fullName: 'Senior Cadet' },
      body: {
        descriptor: new Array(128).fill(0.01),
        challengeToken: 'dummy-token',
      },
    };
    const res = createMockRes();
    await verifyFaceAttendance(req, res as any);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.code, 'BIOMETRIC_AUTOMATION_DISABLED');
    recordResult('Unit Test 1: verifyFace rejects with BIOMETRIC_AUTOMATION_DISABLED when disabled', true);
  } catch (err: any) {
    recordResult('Unit Test 1: verifyFace rejects when disabled', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Unit Test 2: Challenge issuance rejected when biometric automation is disabled
  // --------------------------------------------------------------------------
  try {
    delete process.env.ENABLE_BIOMETRIC_ATTENDANCE;
    const req: any = {
      params: { sessionId: 'session-unit-2' },
      user: { id: 'senior-1', role: 'SENIOR', fullName: 'Senior Cadet' },
    };
    const res = createMockRes();
    await issueVerificationChallenge(req, res as any);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.code, 'BIOMETRIC_AUTOMATION_DISABLED');
    recordResult('Unit Test 2: issueVerificationChallenge rejects when disabled', true);
  } catch (err: any) {
    recordResult('Unit Test 2: issueVerificationChallenge rejects when disabled', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Unit Test 3: Client livenessVerified claims cannot bypass challenge token requirement
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const req: any = {
      params: { sessionId: 'session-unit-3' },
      user: { id: 'senior-1', role: 'SENIOR', fullName: 'Senior Cadet' },
      body: {
        descriptor: new Array(128).fill(0.05),
        livenessVerified: true, // Spoofed client flag
      },
    };
    const res = createMockRes();
    await verifyFaceAttendance(req, res as any);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'CHALLENGE_REQUIRED');
    recordResult('Unit Test 3: Client livenessVerified claim cannot bypass challenge token requirement', true);
  } catch (err: any) {
    recordResult('Unit Test 3: Client livenessVerified claim rejection', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Unit Test 4: Descriptor dimensionality validation (<128 numbers rejected)
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const req: any = {
      params: { sessionId: 'session-unit-4' },
      user: { id: 'senior-1', role: 'SENIOR', fullName: 'Senior Cadet' },
      body: {
        descriptor: [0.1, 0.2, 0.3], // Invalid: only 3 numbers
        challengeToken: 'test-token',
      },
    };
    const res = createMockRes();
    await verifyFaceAttendance(req, res as any);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'INVALID_DESCRIPTOR');
    recordResult('Unit Test 4: Truncated descriptor (<128) rejected with INVALID_DESCRIPTOR', true);
  } catch (err: any) {
    recordResult('Unit Test 4: Truncated descriptor rejection', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Unit Test 5: Malformed non-numeric descriptor elements rejected
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const badDescriptor = new Array(128).fill(0.1);
    badDescriptor[10] = NaN; // Corrupt value
    const req: any = {
      params: { sessionId: 'session-unit-5' },
      user: { id: 'senior-1', role: 'SENIOR', fullName: 'Senior Cadet' },
      body: {
        descriptor: badDescriptor,
        challengeToken: 'test-token',
      },
    };
    const res = createMockRes();
    await verifyFaceAttendance(req, res as any);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'INVALID_DESCRIPTOR');
    recordResult('Unit Test 5: Non-numeric / NaN descriptor elements strictly rejected', true);
  } catch (err: any) {
    recordResult('Unit Test 5: Non-numeric descriptor rejection', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Unit Test 6: DRILL_INSTRUCTOR role policy consistency between route and controller
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const req: any = {
      params: { sessionId: 'session-unit-6' },
      user: { id: 'di-1', role: 'DRILL_INSTRUCTOR', fullName: 'Havildar Instructor' },
      body: {
        descriptor: new Array(128).fill(0.01),
        challengeToken: '', // Will fail on token, but confirms role check was passed!
      },
    };
    const res = createMockRes();
    await verifyFaceAttendance(req, res as any);

    // If role check failed, it would return 403. Returning 400 confirms DRILL_INSTRUCTOR is authorized.
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'CHALLENGE_REQUIRED');
    recordResult('Unit Test 6: DRILL_INSTRUCTOR role authorized in controller (resolves role discrepancy)', true);
  } catch (err: any) {
    recordResult('Unit Test 6: DRILL_INSTRUCTOR role authorization', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Unit Test 7: Unauthorized CADET role rejected with 403
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const req: any = {
      params: { sessionId: 'session-unit-7' },
      user: { id: 'cadet-1', role: 'CADET', fullName: 'Cadet Regular' },
      body: {
        descriptor: new Array(128).fill(0.01),
        challengeToken: 'dummy',
      },
    };
    const res = createMockRes();
    await verifyFaceAttendance(req, res as any);

    assert.strictEqual(res.statusCode, 403);
    recordResult('Unit Test 7: CADET role strictly forbidden from biometric verification (403)', true);
  } catch (err: any) {
    recordResult('Unit Test 7: CADET role forbidden', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Unit Test 8: Response contract - livenessConfirmed purged from API
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const req: any = {
      params: { sessionId: 'session-unit-8' },
      user: { id: 'senior-1', role: 'SENIOR', fullName: 'Senior Cadet' },
      body: {
        descriptor: new Array(128).fill(0.01),
        challengeToken: '',
      },
    };
    const res = createMockRes();
    await verifyFaceAttendance(req, res as any);

    assert(!('livenessConfirmed' in (res.body || {})));
    recordResult('Unit Test 8: livenessConfirmed purged from response schemas', true);
  } catch (err: any) {
    recordResult('Unit Test 8: Response contract', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Unit Test 9: Actual eligible-biometrics controller endpoint purges raw descriptors
  // --------------------------------------------------------------------------
  try {
    (prisma.trainingSession as any).findUnique = async () => ({
      id: 'session-muster',
      title: 'Unit Drill',
      status: 'ACTIVE',
      expectedCount: 1,
    });

    (prisma.user as any).findMany = async () => [
      {
        id: 'cadet-sample-id',
        fullName: 'Cadet Test',
        regimentalNumber: 'MH24SDA100001',
        collegeRollNumber: '10001',
        platoonName: 'ALPHA',
        biometricTemplate: {
          descriptor: JSON.stringify(new Array(128).fill(0.42)),
          qualityScore: 0.98,
        },
      },
    ];

    const req: any = {
      params: { sessionId: 'session-muster' },
      user: { id: 'senior-1', role: 'SENIOR', fullName: 'Senior Cadet' },
    };
    const res = createMockRes();
    await getEligibleBiometrics(req, res as any);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert(Array.isArray(res.body.cadets));
    assert.strictEqual(res.body.cadets.length, 1);

    const cadetResult = res.body.cadets[0];
    assert.strictEqual(cadetResult.hasBiometrics, true);
    assert.strictEqual('descriptor' in cadetResult, false);
    recordResult('Unit Test 9: getEligibleBiometrics endpoint handler executes and purges raw descriptors', true);
  } catch (err: any) {
    recordResult('Unit Test 9: getEligibleBiometrics endpoint', false, err.message);
  }

  console.log('\n---------------------------------------------------------------');
  console.log('  PART B: INTEGRATION & CONCURRENCY TESTS (MOCKED SESSION STORE)');
  console.log('---------------------------------------------------------------\n');

  // Setup safe in-memory mocks for database entities
  (prisma.trainingSession as any).findUnique = async ({ where }: any) => {
    if (where.id === 'session-closed') {
      return { id: where.id, status: 'CLOSED', expectedCount: 20, presentCount: 5, attendance: [] };
    }
    return { id: where.id, status: 'ACTIVE', expectedCount: 20, presentCount: 5, attendance: [] };
  };

  // --------------------------------------------------------------------------
  // Integration Test 10: Issue challenge token returns 32-byte hex nonce with 30s TTL
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const req: any = {
      params: { sessionId: 'session-integ-1' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
    };
    const res = createMockRes();
    await issueVerificationChallenge(req, res as any);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(typeof res.body.challengeToken, 'string');
    assert.strictEqual(res.body.challengeToken.length, 64);
    assert.strictEqual(res.body.ttlSeconds, 30);
    recordResult('Integration Test 10: Single-use challenge token issued (32-byte hex, 30s TTL)', true);
  } catch (err: any) {
    recordResult('Integration Test 10: Single-use challenge token issued', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Integration Test 11: Single-use token consumption prevents replay attacks
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const challengeReq: any = {
      params: { sessionId: 'session-replay' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
    };
    const challengeRes = createMockRes();
    await issueVerificationChallenge(challengeReq, challengeRes as any);
    const token = challengeRes.body.challengeToken;

    // First use consumes token
    const verifyReq1: any = {
      params: { sessionId: 'session-replay' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
      body: { descriptor: new Array(128).fill(0.01), challengeToken: token },
    };
    const verifyRes1 = createMockRes();
    await verifyFaceAttendance(verifyReq1, verifyRes1 as any);

    // Second use with identical token (replay attempt)
    const verifyReq2: any = {
      params: { sessionId: 'session-replay' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
      body: { descriptor: new Array(128).fill(0.01), challengeToken: token },
    };
    const verifyRes2 = createMockRes();
    await verifyFaceAttendance(verifyReq2, verifyRes2 as any);

    assert.strictEqual(verifyRes2.statusCode, 400);
    assert.strictEqual(verifyRes2.body.code, 'CHALLENGE_INVALID');
    recordResult('Integration Test 11: Replay attack blocked (token consumed on first use)', true);
  } catch (err: any) {
    recordResult('Integration Test 11: Replay attack prevention', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Integration Test 12: Concurrent token reuse race condition test
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const challengeReq: any = {
      params: { sessionId: 'session-concurrent' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
    };
    const challengeRes = createMockRes();
    await issueVerificationChallenge(challengeReq, challengeRes as any);
    const sharedToken = challengeRes.body.challengeToken;

    // Simulate 2 parallel incoming requests with the same challenge token
    const call1 = async () => {
      const res = createMockRes();
      await verifyFaceAttendance(
        {
          params: { sessionId: 'session-concurrent' },
          user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
          body: { descriptor: new Array(128).fill(0.01), challengeToken: sharedToken },
        } as any,
        res as any
      );
      return res;
    };

    const call2 = async () => {
      const res = createMockRes();
      await verifyFaceAttendance(
        {
          params: { sessionId: 'session-concurrent' },
          user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
          body: { descriptor: new Array(128).fill(0.01), challengeToken: sharedToken },
        } as any,
        res as any
      );
      return res;
    };

    const [res1, res2] = await Promise.all([call1(), call2()]);

    // Exactly one call should have successfully consumed the challenge,
    // while the parallel call MUST be rejected with CHALLENGE_INVALID.
    const invalidCount = [res1, res2].filter((r) => r.body?.code === 'CHALLENGE_INVALID').length;
    assert.strictEqual(invalidCount, 1, 'Exactly one concurrent call must receive CHALLENGE_INVALID');
    recordResult('Integration Test 12: Concurrent token reuse blocked (atomic retrieval and deletion)', true);
  } catch (err: any) {
    recordResult('Integration Test 12: Concurrent token reuse', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Integration Test 13: Cross-session challenge token mismatch rejected
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const challengeReq: any = {
      params: { sessionId: 'session-a' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
    };
    const challengeRes = createMockRes();
    await issueVerificationChallenge(challengeReq, challengeRes as any);
    const token = challengeRes.body.challengeToken;

    const verifyReq: any = {
      params: { sessionId: 'session-b' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
      body: { descriptor: new Array(128).fill(0.01), challengeToken: token },
    };
    const verifyRes = createMockRes();
    await verifyFaceAttendance(verifyReq, verifyRes as any);

    assert.strictEqual(verifyRes.statusCode, 400);
    assert.strictEqual(verifyRes.body.code, 'CHALLENGE_SESSION_MISMATCH');
    recordResult('Integration Test 13: Cross-session challenge token mismatch blocked', true);
  } catch (err: any) {
    recordResult('Integration Test 13: Cross-session token mismatch', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Integration Test 14: Cross-operator token forgery rejected (user-bound)
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const challengeReq: any = {
      params: { sessionId: 'session-shared' },
      user: { id: 'operator-alice', role: 'SENIOR', fullName: 'Alice' },
    };
    const challengeRes = createMockRes();
    await issueVerificationChallenge(challengeReq, challengeRes as any);
    const token = challengeRes.body.challengeToken;

    const verifyReq: any = {
      params: { sessionId: 'session-shared' },
      user: { id: 'operator-bob', role: 'SENIOR', fullName: 'Bob' },
      body: { descriptor: new Array(128).fill(0.01), challengeToken: token },
    };
    const verifyRes = createMockRes();
    await verifyFaceAttendance(verifyReq, verifyRes as any);

    assert.strictEqual(verifyRes.statusCode, 400);
    assert.strictEqual(verifyRes.body.code, 'CHALLENGE_USER_MISMATCH');
    recordResult('Integration Test 14: Cross-operator token forgery blocked (user-bound)', true);
  } catch (err: any) {
    recordResult('Integration Test 14: Cross-operator token forgery', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Integration Test 15: Closed session rejected
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const challengeReq: any = {
      params: { sessionId: 'session-closed' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
    };
    const challengeRes = createMockRes();
    await issueVerificationChallenge(challengeReq, challengeRes as any);

    assert.strictEqual(challengeRes.statusCode, 400);
    assert.strictEqual(challengeRes.body.code, 'SESSION_CLOSED');
    recordResult('Integration Test 15: Verification on closed session rejected (SESSION_CLOSED)', true);
  } catch (err: any) {
    recordResult('Integration Test 15: Closed session rejection', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Integration Test 16: Approved leave conflict simulation
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const challengeReq: any = {
      params: { sessionId: 'session-leave' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
    };
    const challengeRes = createMockRes();
    await issueVerificationChallenge(challengeReq, challengeRes as any);
    const token = challengeRes.body.challengeToken;

    (prisma.biometricTemplate as any).findMany = async () => [
      {
        cadetId: 'cadet-leave-id',
        descriptor: JSON.stringify(new Array(128).fill(0.1)),
        cadet: {
          id: 'cadet-leave-id',
          fullName: 'Leave Cadet',
          regimentalNumber: 'MH24SDA111111',
          status: 'ACTIVE',
          phone: '9999999999',
        },
      },
    ];

    (prisma.leave as any).findFirst = async () => ({
      id: 'leave-123',
      cadetId: 'cadet-leave-id',
      status: 'APPROVED',
      reason: 'Medical Leave',
    });
    // This synthetic Senior must be assigned to the cadet so the test reaches
    // the approved-leave policy instead of correctly failing the scope guard.
    (prisma.seniorAssignment as any).findMany = async () => [{ cadetId: 'cadet-leave-id' }];

    const verifyReq: any = {
      params: { sessionId: 'session-leave' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
      body: { descriptor: new Array(128).fill(0.1), challengeToken: token },
    };
    const verifyRes = createMockRes();
    await verifyFaceAttendance(verifyReq, verifyRes as any);

    assert.strictEqual(verifyRes.statusCode, 400);
    assert.strictEqual(verifyRes.body.code, 'APPROVED_LEAVE');
    recordResult('Integration Test 16: Cadet on approved leave blocked from present status', true);
  } catch (err: any) {
    recordResult('Integration Test 16: Approved leave conflict', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Integration Test 17: Duplicate attendance prevention
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const challengeReq: any = {
      params: { sessionId: 'session-duplicate' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
    };
    const challengeRes = createMockRes();
    await issueVerificationChallenge(challengeReq, challengeRes as any);
    const token = challengeRes.body.challengeToken;

    (prisma.biometricTemplate as any).findMany = async () => [
      {
        cadetId: 'cadet-dup-id',
        descriptor: JSON.stringify(new Array(128).fill(0.2)),
        cadet: {
          id: 'cadet-dup-id',
          fullName: 'Duplicate Cadet',
          regimentalNumber: 'MH24SDA222222',
          status: 'ACTIVE',
          phone: '9999999999',
        },
      },
    ];

    (prisma.leave as any).findFirst = async () => null;
    (prisma.trainingAttendance as any).findUnique = async () => ({
      sessionId: 'session-duplicate',
      cadetId: 'cadet-dup-id',
      status: 'PRESENT',
    });
    // Model an authorized Senior/cadet assignment and exercise duplicate logic.
    (prisma.seniorAssignment as any).findMany = async () => [{ cadetId: 'cadet-dup-id' }];

    const verifyReq: any = {
      params: { sessionId: 'session-duplicate' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
      body: { descriptor: new Array(128).fill(0.2), challengeToken: token },
    };
    const verifyRes = createMockRes();
    await verifyFaceAttendance(verifyReq, verifyRes as any);

    assert.strictEqual(verifyRes.statusCode, 409);
    assert.strictEqual(verifyRes.body.code, 'ALREADY_MARKED');
    assert.strictEqual(verifyRes.body.duplicate, true);
    recordResult('Integration Test 17: Duplicate attendance prevented (409 ALREADY_MARKED)', true);
  } catch (err: any) {
    recordResult('Integration Test 17: Duplicate attendance prevention', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Integration Test 18: Synthetic descriptor distance matching failure (422)
  // --------------------------------------------------------------------------
  try {
    process.env.ENABLE_BIOMETRIC_ATTENDANCE = 'true';
    const challengeReq: any = {
      params: { sessionId: 'session-match-fail' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
    };
    const challengeRes = createMockRes();
    await issueVerificationChallenge(challengeReq, challengeRes as any);
    const token = challengeRes.body.challengeToken;

    (prisma.biometricTemplate as any).findMany = async () => [
      {
        cadetId: 'cadet-enrolled-1',
        descriptor: JSON.stringify(new Array(128).fill(0.9)), // Enrolled template has 0.9
        cadet: {
          id: 'cadet-enrolled-1',
          fullName: 'Enrolled Cadet',
          regimentalNumber: 'MH24SDA333333',
          status: 'ACTIVE',
          phone: '9999999999',
        },
      },
    ];

    // Submit synthetic random vector far away (0.01 vs 0.9)
    const verifyReq: any = {
      params: { sessionId: 'session-match-fail' },
      user: { id: 'operator-1', role: 'SENIOR', fullName: 'Senior Operator' },
      body: { descriptor: new Array(128).fill(0.01), challengeToken: token },
    };
    const verifyRes = createMockRes();
    await verifyFaceAttendance(verifyReq, verifyRes as any);

    assert.strictEqual(verifyRes.statusCode, 422);
    assert.strictEqual(verifyRes.body.code, 'FACE_NOT_VERIFIED');
    recordResult('Integration Test 18: Non-matching synthetic descriptor rejected (422 FACE_NOT_VERIFIED)', true);
  } catch (err: any) {
    recordResult('Integration Test 18: Synthetic descriptor matching failure', false, err.message);
  }

  console.log('\n---------------------------------------------------------------');
  console.log('  PART C: MANUAL ATTENDANCE INTEGRITY TESTS (PHASE 3)');
  console.log('---------------------------------------------------------------\n');

  // Setup standard mock data for manual attendance
  const sampleActiveCadet = {
    id: 'cadet-man-1',
    fullName: 'Cadet Manual Test',
    regimentalNumber: 'MH24SDA444444',
    phone: '9876543210',
    role: 'CADET',
    status: 'ACTIVE',
  };

  (prisma.user as any).findFirst = async ({ where }: any) => {
    if (where.id === 'cadet-man-1' || where.id === 'cadet-leave-1' || where.id === 'cadet-allowed-1') {
      return sampleActiveCadet;
    }
    return null;
  };

  (prisma.$transaction as any) = async (cb: any) => {
    const txMock = {
      trainingAttendance: {
        upsert: async ({ create, update }: any) => ({
          id: 'attendance-rec-1',
          sessionId: 'session-man-active',
          cadetId: create?.cadetId || update?.cadetId || 'cadet-man-1',
          status: create?.status || update?.status || 'PRESENT',
          verificationMethod: 'MANUAL_AUDITED',
          verificationStatus: 'VERIFIED',
          cadet: sampleActiveCadet,
          createdAt: new Date(),
        }),
        count: async () => 1,
      },
      trainingSession: {
        update: async () => ({ id: 'session-man-active', presentCount: 1 }),
      },
    };
    return cb(txMock);
  };

  // --------------------------------------------------------------------------
  // Manual Test 19: markAttendance on CLOSED session returns 400 SESSION_CLOSED
  // --------------------------------------------------------------------------
  try {
    (prisma.trainingSession as any).findUnique = async () => ({
      id: 'session-man-closed',
      status: 'CLOSED',
      date: new Date(),
    });

    const req: any = {
      params: { sessionId: 'session-man-closed' },
      user: { id: 'officer-1', role: 'ADMIN_ANO', fullName: 'Capt ANO' },
      body: { cadetId: 'cadet-man-1', status: 'PRESENT' },
    };
    const res = createMockRes();
    await markAttendance(req, res as any);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'SESSION_CLOSED');
    recordResult('Manual Test 19: markAttendance rejects closed session with 400 SESSION_CLOSED', true);
  } catch (err: any) {
    recordResult('Manual Test 19: Closed session rejection', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Manual Test 20: markAttendance with status PRESENT on approved leave returns 400 APPROVED_LEAVE
  // --------------------------------------------------------------------------
  try {
    const sessionDate = new Date();
    (prisma.trainingSession as any).findUnique = async () => ({
      id: 'session-man-active',
      status: 'ACTIVE',
      date: sessionDate,
    });

    (prisma.leave as any).findFirst = async () => ({
      id: 'leave-man-1',
      cadetId: 'cadet-man-1',
      status: 'APPROVED',
      reason: 'Sanctioned Medical Leave',
    });

    const req: any = {
      params: { sessionId: 'session-man-active' },
      user: { id: 'officer-1', role: 'ADMIN_ANO', fullName: 'Capt ANO' },
      body: { cadetId: 'cadet-man-1', status: 'PRESENT' },
    };
    const res = createMockRes();
    await markAttendance(req, res as any);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'APPROVED_LEAVE');
    recordResult('Manual Test 20: markAttendance PRESENT blocked by approved leave (400 APPROVED_LEAVE)', true);
  } catch (err: any) {
    recordResult('Manual Test 20: Approved leave conflict for PRESENT', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Manual Test 21: markAttendance with status EXCUSED on approved leave permitted (200)
  // --------------------------------------------------------------------------
  try {
    const sessionDate = new Date();
    (prisma.trainingSession as any).findUnique = async () => ({
      id: 'session-man-active',
      status: 'ACTIVE',
      date: sessionDate,
    });

    (prisma.leave as any).findFirst = async () => ({
      id: 'leave-man-1',
      cadetId: 'cadet-man-1',
      status: 'APPROVED',
      reason: 'Sanctioned Medical Leave',
    });

    (prisma.trainingAttendance as any).findUnique = async () => null;

    const req: any = {
      params: { sessionId: 'session-man-active' },
      user: { id: 'officer-1', role: 'ADMIN_ANO', fullName: 'Capt ANO' },
      body: { cadetId: 'cadet-man-1', status: 'EXCUSED' },
    };
    const res = createMockRes();
    await markAttendance(req, res as any);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.record.status, 'EXCUSED');
    recordResult('Manual Test 21: markAttendance EXCUSED permitted for cadet on approved leave', true);
  } catch (err: any) {
    recordResult('Manual Test 21: EXCUSED permitted for approved leave', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Manual Test 22: Duplicate PRESENT submission returns 409 ALREADY_MARKED
  // --------------------------------------------------------------------------
  try {
    (prisma.trainingSession as any).findUnique = async () => ({
      id: 'session-man-active',
      status: 'ACTIVE',
      date: new Date(),
    });

    (prisma.leave as any).findFirst = async () => null;

    (prisma.trainingAttendance as any).findUnique = async () => ({
      sessionId: 'session-man-active',
      cadetId: 'cadet-man-1',
      status: 'PRESENT',
      createdAt: new Date(),
    });

    const req: any = {
      params: { sessionId: 'session-man-active' },
      user: { id: 'officer-1', role: 'ADMIN_ANO', fullName: 'Capt ANO' },
      body: { cadetId: 'cadet-man-1', status: 'PRESENT' },
    };
    const res = createMockRes();
    await markAttendance(req, res as any);

    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.body.code, 'ALREADY_MARKED');
    assert.strictEqual(res.body.duplicate, true);
    recordResult('Manual Test 22: Duplicate PRESENT submission rejected with 409 ALREADY_MARKED', true);
  } catch (err: any) {
    recordResult('Manual Test 22: Duplicate PRESENT rejection', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Manual Test 23: Legitimate status correction from ABSENT to PRESENT succeeds (200)
  // --------------------------------------------------------------------------
  try {
    (prisma.trainingSession as any).findUnique = async () => ({
      id: 'session-man-active',
      status: 'ACTIVE',
      date: new Date(),
    });

    (prisma.leave as any).findFirst = async () => null;

    (prisma.trainingAttendance as any).findUnique = async () => ({
      sessionId: 'session-man-active',
      cadetId: 'cadet-man-1',
      status: 'ABSENT',
      createdAt: new Date(),
    });

    const req: any = {
      params: { sessionId: 'session-man-active' },
      user: { id: 'officer-1', role: 'ADMIN_ANO', fullName: 'Capt ANO' },
      body: { cadetId: 'cadet-man-1', status: 'PRESENT' },
    };
    const res = createMockRes();
    await markAttendance(req, res as any);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.record.status, 'PRESENT');
    recordResult('Manual Test 23: Status correction from ABSENT to PRESENT permitted (200)', true);
  } catch (err: any) {
    recordResult('Manual Test 23: Status correction ABSENT to PRESENT', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Manual Test 24: Legitimate status correction from PRESENT to ABSENT succeeds (200)
  // --------------------------------------------------------------------------
  try {
    (prisma.trainingSession as any).findUnique = async () => ({
      id: 'session-man-active',
      status: 'ACTIVE',
      date: new Date(),
    });

    (prisma.leave as any).findFirst = async () => null;

    (prisma.trainingAttendance as any).findUnique = async () => ({
      sessionId: 'session-man-active',
      cadetId: 'cadet-man-1',
      status: 'PRESENT',
      createdAt: new Date(),
    });

    const req: any = {
      params: { sessionId: 'session-man-active' },
      user: { id: 'officer-1', role: 'ADMIN_ANO', fullName: 'Capt ANO' },
      body: { cadetId: 'cadet-man-1', status: 'ABSENT' },
    };
    const res = createMockRes();
    await markAttendance(req, res as any);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    recordResult('Manual Test 24: Status correction from PRESENT to ABSENT permitted (200)', true);
  } catch (err: any) {
    recordResult('Manual Test 24: Status correction PRESENT to ABSENT', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Manual Test 25: Senior cadet mentor squad scope authorization enforcement
  // --------------------------------------------------------------------------
  try {
    (prisma.trainingSession as any).findUnique = async () => ({
      id: 'session-man-active',
      status: 'ACTIVE',
      date: new Date(),
    });

    (prisma.seniorAssignment as any).findMany = async () => [
      { cadetId: 'cadet-assigned-only' },
    ];

    const req: any = {
      params: { sessionId: 'session-man-active' },
      user: { id: 'senior-mentor-1', role: 'SENIOR', fullName: 'Senior Mentor' },
      body: { cadetId: 'cadet-man-1', status: 'PRESENT' },
    };
    const res = createMockRes();
    await markAttendance(req, res as any);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.code, 'NOT_ELIGIBLE');
    recordResult('Manual Test 25: Senior mentor squad scope authorization enforced (403 NOT_ELIGIBLE)', true);
  } catch (err: any) {
    recordResult('Manual Test 25: Senior squad scope authorization', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Manual Test 26: Concurrent manual PRESENT submissions with Promise.all
  // --------------------------------------------------------------------------
  try {
    (prisma.trainingSession as any).findUnique = async () => ({
      id: 'session-concurrent-man',
      status: 'ACTIVE',
      date: new Date(),
    });
    (prisma.leave as any).findFirst = async () => null;

    // Simulate database unique constraint / transaction serialization
    let markedPresent = false;
    (prisma.trainingAttendance as any).findUnique = async () => {
      if (markedPresent) {
        return {
          sessionId: 'session-concurrent-man',
          cadetId: 'cadet-man-1',
          status: 'PRESENT',
          createdAt: new Date(),
        };
      }
      return null;
    };

    (prisma.$transaction as any) = async (cb: any) => {
      if (markedPresent) {
        throw new Error('Unique constraint failed on sessionId_cadetId');
      }
      markedPresent = true;
      const txMock = {
        trainingAttendance: {
          upsert: async () => ({
            id: 'attendance-rec-concurrent',
            sessionId: 'session-concurrent-man',
            cadetId: 'cadet-man-1',
            status: 'PRESENT',
            verificationMethod: 'MANUAL_AUDITED',
            verificationStatus: 'VERIFIED',
            cadet: sampleActiveCadet,
            createdAt: new Date(),
          }),
          count: async () => 1,
        },
        trainingSession: {
          update: async () => ({ id: 'session-concurrent-man', presentCount: 1 }),
        },
      };
      return cb(txMock);
    };

    const call1 = async () => {
      const res = createMockRes();
      await markAttendance(
        {
          params: { sessionId: 'session-concurrent-man' },
          user: { id: 'officer-1', role: 'ADMIN_ANO', fullName: 'Capt ANO' },
          body: { cadetId: 'cadet-man-1', status: 'PRESENT' },
        } as any,
        res as any
      );
      return res;
    };

    const call2 = async () => {
      const res = createMockRes();
      await markAttendance(
        {
          params: { sessionId: 'session-concurrent-man' },
          user: { id: 'officer-1', role: 'ADMIN_ANO', fullName: 'Capt ANO' },
          body: { cadetId: 'cadet-man-1', status: 'PRESENT' },
        } as any,
        res as any
      );
      return res;
    };

    const [res1, res2] = await Promise.all([call1(), call2()]);
    const codes = [res1.statusCode, res2.statusCode].sort();
    assert.strictEqual(codes[0], 200);
    assert.strictEqual(codes[1], 409);
    recordResult('Manual Test 26: Concurrent manual PRESENT requests safely handled (one 200, one 409)', true);
  } catch (err: any) {
    recordResult('Manual Test 26: Concurrent manual requests', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Manual Test 27: Rejected requests cause zero side effects (no audit logs created)
  // --------------------------------------------------------------------------
  try {
    let auditLogCreated = false;
    (prisma.auditLog as any).create = async () => {
      auditLogCreated = true;
    };

    (prisma.trainingSession as any).findUnique = async () => ({
      id: 'session-man-closed',
      status: 'CLOSED',
      date: new Date(),
    });

    const req: any = {
      params: { sessionId: 'session-man-closed' },
      user: { id: 'officer-1', role: 'ADMIN_ANO', fullName: 'Capt ANO' },
      body: { cadetId: 'cadet-man-1', status: 'PRESENT' },
    };
    const res = createMockRes();
    await markAttendance(req, res as any);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(auditLogCreated, false, 'Audit log must not be created on rejected request');
    recordResult('Manual Test 27: Rejected requests cause zero side effects or audit entries', true);
  } catch (err: any) {
    recordResult('Manual Test 27: Side effect safety', false, err.message);
  }

  // Restore notification boundary mocks
  (attendanceNotificationService as any).triggerPresentAttendanceNotifications = originalTriggerPresent;
  (attendanceNotificationService as any).triggerAbsentAttendanceNotifications = originalTriggerAbsent;
  if (originalQueueNotification) {
    (attendanceNotificationService as any).queueAttendanceNotification = originalQueueNotification;
  }

  // Restore environment & Prisma mocks
  delete process.env.ENABLE_BIOMETRIC_ATTENDANCE;
  (prisma.trainingSession as any).findUnique = originalSessionFindUnique;
  (prisma.user as any).findMany = originalUserFindMany;
  (prisma.user as any).findFirst = originalUserFindFirst;
  (prisma.biometricTemplate as any).findMany = originalBiometricFindMany;
  (prisma.leave as any).findFirst = originalLeaveFindFirst;
  (prisma.trainingAttendance as any).findUnique = originalAttendanceFindUnique;
  (prisma.seniorAssignment as any).findMany = originalSeniorAssignmentFindMany;
  (prisma.auditLog as any).create = originalAuditLogCreate;
  if ((prisma as any).attendanceNotification) {
    (prisma as any).attendanceNotification.create = originalAttendanceNotificationCreate;
  }
  (prisma.$transaction as any) = originalTransaction;

  console.log('\n===============================================================');
  console.log(`  FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
