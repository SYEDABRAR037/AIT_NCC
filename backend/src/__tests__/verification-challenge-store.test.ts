import assert from 'assert';
import { VerificationChallengeStore } from '../services/verificationChallengeStore';

const store = new VerificationChallengeStore(30_000, 2, 10);
const binding = { sessionId: 'attendance-1', userId: 'operator-1', authSessionId: 'auth-1' };
const first = store.issue(binding, 1_000);
const second = store.issue(binding, 1_001);
assert.ok(first && second);
assert.strictEqual(store.issue(binding, 1_002), null, 'per-operator pending challenge cap is enforced');

const consumed = store.consume(first!.token, 1_003);
assert.strictEqual(consumed.status, 'valid');
if (consumed.status === 'valid') assert.deepStrictEqual(consumed.challenge, {
  ...binding,
  createdAt: 1_000,
  expiresAt: 31_000,
});
assert.strictEqual(store.consume(first!.token, 1_004).status, 'missing', 'replay is rejected');
assert.strictEqual(store.consume(second!.token, 31_002).status, 'expired', 'expired challenge is consumed and rejected');
assert.strictEqual(store.consume(second!.token, 31_003).status, 'missing', 'expired token cannot be replayed');

const otherOperator = store.issue({ ...binding, userId: 'operator-2', authSessionId: 'auth-2' }, 32_000);
assert.ok(otherOperator, 'one operator cannot consume another operator quota');
assert.strictEqual(store.consume('not-a-token', 32_001).status, 'missing');
console.log('[PASS] Verification challenge storage hashes tokens, binds context, caps per operator, expires, and consumes once');
