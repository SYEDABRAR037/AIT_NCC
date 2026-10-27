import assert from 'assert';
import { isSessionActive, revokePresentedSession } from '../services/sessionPolicy';

const now = new Date('2026-10-28T12:00:00.000Z');
const valid = { id: 'session-1', userId: 'user-1', expiresAt: new Date(now.getTime() + 60_000), revokedAt: null };
const assertStatus = (claims: any, record: any, expected: boolean) => assert.strictEqual(isSessionActive(claims, record, now), expected);

assertStatus({ userId: 'user-1', sid: 'session-1' }, valid, true);
assertStatus({ userId: 'user-1', sid: 'session-1' }, { ...valid, expiresAt: new Date(now.getTime()) }, false);
assertStatus({ userId: 'user-1', sid: 'session-1' }, { ...valid, revokedAt: now }, false);
assertStatus({ userId: 'other-user', sid: 'session-1' }, valid, false);
assertStatus({ userId: 'user-1', sid: 'missing-session' }, null, false);
// Compatibility for already issued seven-day tokens during the rollout.
assertStatus({ userId: 'user-1' }, null, true);

const run = async (): Promise<void> => {
  let revokedAt: Date | null = null;
  const fakeStore = {
    async updateMany({ where, data }: any) {
      if (where.id !== 'session-1' || where.userId !== 'user-1' || revokedAt) return { count: 0 };
      revokedAt = data.revokedAt;
      return { count: 1 };
    },
  };
  const claims = { userId: 'user-1', sid: 'session-1' };
  assert.strictEqual(await revokePresentedSession(fakeStore, claims, now), true);
  assert.strictEqual(await revokePresentedSession(fakeStore, claims, now), false);
  assert.strictEqual(revokedAt, now);
  console.log('Session policy unit tests passed, including repeated logout idempotency.');
};
void run();
