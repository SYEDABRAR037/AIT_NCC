import './test-isolation-guard';
import assert from 'assert';
import { prisma } from '../db';
import { recordLoginFailure } from '../controllers/auth.controller';

async function run() {
  const originalCreate = prisma.auditLog.create;
  let captured: any;
  (prisma.auditLog as any).create = async ({ data }: any) => { captured = data; return { id: 'audit-test' }; };
  try {
    await recordLoginFailure('synthetic-user-id');
    assert.strictEqual(captured.actorId, 'synthetic-user-id');
    assert.strictEqual(captured.targetId, 'synthetic-user-id');
    assert.strictEqual(captured.action, 'AUTH_LOGIN_FAILED');
    assert.strictEqual(captured.details, null);
    assert.ok(!JSON.stringify(captured).includes('identifierDigest'));

    await recordLoginFailure();
    assert.strictEqual(captured.actorId, 'UNKNOWN');
    assert.strictEqual(captured.targetId, null);
    assert.strictEqual(captured.details, null);

    (prisma.auditLog as any).create = async () => { throw new Error('sensitive database detail'); };
    const originalError = console.error;
    const messages: string[] = [];
    console.error = (...args: unknown[]) => messages.push(args.join(' '));
    try {
      await assert.rejects(recordLoginFailure(), (error: any) => error.code === 'AUTH_AUDIT_UNAVAILABLE');
    } finally {
      console.error = originalError;
    }
    assert.deepStrictEqual(messages, ['[SECURITY_AUDIT_FAILURE] Login failure audit could not be persisted.']);
    console.log('[PASS] Login failure audit omits submitted identifiers and fails closed with sanitized diagnostics');
  } finally {
    (prisma.auditLog as any).create = originalCreate;
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
