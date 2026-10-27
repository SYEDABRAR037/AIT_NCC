export interface SessionClaims {
  userId?: string;
  sid?: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface SessionRevocationStore {
  updateMany(args: { where: { id: string; userId: string; revokedAt: null }; data: { revokedAt: Date } }): Promise<{ count: number }>;
}

/** Compare-and-set revocation makes repeated logout requests harmless. */
export const revokePresentedSession = async (
  store: SessionRevocationStore,
  claims: SessionClaims,
  now = new Date(),
): Promise<boolean> => {
  if (!claims.sid || !claims.userId) return false;
  const result = await store.updateMany({
    where: { id: claims.sid, userId: claims.userId, revokedAt: null },
    data: { revokedAt: now },
  });
  return result.count === 1;
};

/** Accepts pre-session JWTs only during the finite compatibility rollout. */
export const isSessionActive = (claims: SessionClaims, record: SessionRecord | null, now = new Date()): boolean => {
  if (!claims.sid) return true;
  return Boolean(
    claims.userId && record && record.id === claims.sid && record.userId === claims.userId &&
    !record.revokedAt && record.expiresAt.getTime() > now.getTime()
  );
};
