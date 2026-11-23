import { createHash, randomBytes } from 'crypto';

export interface VerificationChallengeBinding {
  sessionId: string;
  userId: string;
  authSessionId: string;
  createdAt: number;
  expiresAt: number;
}

export interface IssuedVerificationChallenge {
  token: string;
  expiresAt: number;
}

export type ConsumedVerificationChallenge =
  | { status: 'valid'; challenge: VerificationChallengeBinding }
  | { status: 'expired'; challenge: VerificationChallengeBinding }
  | { status: 'missing' };

/**
 * Process-local, fail-closed challenge store. Tokens are 256-bit random bearer
 * values; only their SHA-256 digest is retained. Because this store is not shared
 * across processes, a challenge issued on another worker is rejected (availability
 * loss, never acceptance). Multi-instance operation requires a shared atomic store.
 */
export class VerificationChallengeStore {
  private readonly challenges = new Map<string, VerificationChallengeBinding>();

  constructor(
    private readonly ttlMs = 30_000,
    private readonly perOperatorLimit = 10,
    private readonly globalLimit = 10_000,
  ) {}

  issue(binding: Omit<VerificationChallengeBinding, 'createdAt' | 'expiresAt'>, now = Date.now()): IssuedVerificationChallenge | null {
    this.pruneExpired(now);
    let userOutstanding = 0;
    for (const challenge of this.challenges.values()) {
      if (challenge.userId === binding.userId) userOutstanding += 1;
    }
    if (userOutstanding >= this.perOperatorLimit || this.challenges.size >= this.globalLimit) return null;

    const token = randomBytes(32).toString('hex');
    const key = createHash('sha256').update(token).digest('hex');
    this.challenges.set(key, {
      ...binding,
      createdAt: now,
      expiresAt: now + this.ttlMs,
    });
    return { token, expiresAt: now + this.ttlMs };
  }

  /** Synchronous get-and-delete makes single-use consumption atomic in one Node process. */
  consume(token: string, now = Date.now()): ConsumedVerificationChallenge {
    const key = createHash('sha256').update(token).digest('hex');
    const challenge = this.challenges.get(key);
    if (!challenge) return { status: 'missing' };
    this.challenges.delete(key);
    return challenge.expiresAt <= now
      ? { status: 'expired', challenge }
      : { status: 'valid', challenge };
  }

  pruneExpired(now = Date.now()): void {
    for (const [key, challenge] of this.challenges) {
      if (challenge.expiresAt <= now) this.challenges.delete(key);
    }
  }

  get size(): number {
    return this.challenges.size;
  }
}
