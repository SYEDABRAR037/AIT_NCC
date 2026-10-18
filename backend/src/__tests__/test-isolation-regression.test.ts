import './test-isolation-guard';
import assert from 'assert';
import { spawnSync } from 'child_process';
import path from 'path';
import { prisma } from '../db';
import { notificationQueueWorker, sendOtpSms } from '../services/attendanceNotification.service';
import { sendOtpEmail } from '../services/mail.service';

async function runIsolationRegressionSuite() {
  console.log('===============================================================');
  console.log('  NCC TEST ISOLATION FAIL-CLOSED REGRESSION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function record(testName: string, success: boolean, details?: string) {
    if (success) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}: ${details}`);
      failed++;
    }
  }

  const backendDir = path.resolve(__dirname, '../..');

  // --------------------------------------------------------------------------
  // Regression Check 1: Inherited production database URL is strictly rejected
  // --------------------------------------------------------------------------
  try {
    const child = spawnSync(
      'npx',
      [
        'ts-node',
        '-e',
        `
        process.env.NODE_ENV = 'test';
        delete process.env.PURE_MOCK_TEST;
        process.env.DATABASE_URL = 'postgresql://user:pass@dpg-prod-fake.render.com:5432/ncc_prod';
        require('./src/db');
      `,
      ],
      {
        cwd: backendDir,
        encoding: 'utf-8',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PURE_MOCK_TEST: '',
          DATABASE_URL: 'postgresql://user:pass@dpg-prod-fake.render.com:5432/ncc_prod',
        },
      }
    );

    const output = (child.stdout || '') + (child.stderr || '');
    assert(
      output.includes('[FAIL-CLOSED DB GUARD] Unsafe test execution environment!'),
      `Expected fail-closed guard error on inherited production URL, got: ${output.slice(0, 200)}`
    );
    assert.notStrictEqual(child.status, 0, 'Process must exit with non-zero status on unsafe environment');
    record('Regression 1: Inherited production database URL fails closed before PrismaClient is created', true);
  } catch (err: any) {
    record('Regression 1: Inherited production database URL rejection', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Regression Check 2: Cloud-hosted URL with disposable DB mode is rejected
  // --------------------------------------------------------------------------
  try {
    const child = spawnSync(
      'npx',
      [
        'ts-node',
        '-e',
        `
        process.env.NODE_ENV = 'test';
        process.env.ALLOW_DISPOSABLE_TEST_DB = 'true';
        process.env.DISPOSABLE_TEST_DATABASE_URL = 'postgresql://user:pass@dpg-disposable.render.com:5432/ncc_test_db';
        require('./src/db');
      `,
      ],
      {
        cwd: backendDir,
        encoding: 'utf-8',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          ALLOW_DISPOSABLE_TEST_DB: 'true',
          DISPOSABLE_TEST_DATABASE_URL: 'postgresql://user:pass@dpg-disposable.render.com:5432/ncc_test_db',
        },
      }
    );

    const output = (child.stdout || '') + (child.stderr || '');
    assert(
      output.includes('[FAIL-CLOSED DB GUARD]') &&
      (output.includes('not a permitted local loopback address') || output.includes('Cloud database domain')),
      `Expected cloud host rejection error, got: ${output.slice(0, 200)}`
    );
    assert.notStrictEqual(child.status, 0, 'Process must exit with non-zero status on cloud test DB');
    record('Regression 2: Cloud-hosted URL rejected even when disposable database mode is enabled', true);
  } catch (err: any) {
    record('Regression 2: Cloud-hosted disposable DB rejection', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Regression Check 3: Unmocked database operation fails closed
  // --------------------------------------------------------------------------
  try {
    let caught = false;
    try {
      await (prisma.trainingSession as any).findMany();
    } catch (err: any) {
      caught = true;
      assert(
        err.message.includes('[FAIL-CLOSED DB GUARD] Unmocked database operation attempted in Pure Mock test mode: prisma.TrainingSession.findMany'),
        `Unexpected error message: ${err.message}`
      );
    }
    assert.strictEqual(caught, true, 'Unmocked prisma.trainingSession.findMany must throw fail-closed guard error');
    record('Regression 3: Unmocked database operation trapped by Prisma query extension', true);
  } catch (err: any) {
    record('Regression 3: Unmocked database operation trap', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Regression Check 4: Unmocked audit-log write fails closed
  // --------------------------------------------------------------------------
  try {
    let caught = false;
    try {
      await (prisma.auditLog as any).create({
        data: {
          actorId: 'attacker-id',
          actorName: 'Attacker',
          action: 'UNAUTHORIZED_PROD_WRITE',
          targetType: 'SYSTEM',
        },
      });
    } catch (err: any) {
      caught = true;
      assert(
        err.message.includes('[FAIL-CLOSED DB GUARD] Unmocked database operation attempted in Pure Mock test mode: prisma.AuditLog.create'),
        `Unexpected error message: ${err.message}`
      );
    }
    assert.strictEqual(caught, true, 'Unmocked prisma.auditLog.create must throw fail-closed guard error');
    record('Regression 4: Unmocked audit-log write trapped before reaching network', true);
  } catch (err: any) {
    record('Regression 4: Unmocked audit-log write trap', false, err.message);
  }

  // --------------------------------------------------------------------------
  // Regression Check 5: Notification services never make real external calls in test
  // --------------------------------------------------------------------------
  try {
    // 5a. Worker queue dispatch SMS provider in test mode
    const smsRes = await (notificationQueueWorker as any).dispatchSmsProvider(
      '+919876543210',
      'Test SMS message'
    );
    assert.strictEqual(smsRes.success, true);
    assert(String(smsRes.providerMessageId).startsWith('MOCK_SMS_'), 'Provider message ID must be mock sentinel');

    // 5b. Worker queue dispatch WhatsApp provider in test mode
    const waRes = await (notificationQueueWorker as any).dispatchWhatsAppProvider(
      '+919876543210',
      'Test WhatsApp message'
    );
    assert.strictEqual(waRes.success, true);
    assert(String(waRes.providerMessageId).startsWith('MOCK_WA_'), 'Provider message ID must be mock sentinel');

    // 5c. OTP SMS in test mode
    const otpSmsRes = await sendOtpSms('+919876543210', 'Your OTP is 123456');
    assert.strictEqual(otpSmsRes, true);

    // 5d. OTP Email in test mode
    const emailRes = await sendOtpEmail({
      recipientEmail: 'cadet@example.com',
      cadetName: 'Test Cadet',
      otp: '123456',
      purpose: 'recovery',
    });
    assert.strictEqual(emailRes.success, true);
    assert(String(emailRes.messageId).startsWith('mock-email-'), 'Email message ID must be mock sentinel');

    record('Regression 5: Notification & email services return mock sentinels with zero network dispatch in test mode', true);
  } catch (err: any) {
    record('Regression 5: Notification & email service network isolation', false, err.message);
  }

  console.log('\n===============================================================');
  console.log(`  REGRESSION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runIsolationRegressionSuite().catch((err) => {
  console.error('Fatal regression suite error:', err);
  process.exit(1);
});
