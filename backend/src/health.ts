export interface HealthResult {
  statusCode: 200 | 503;
  body: { status: 'ready' } | { status: 'unavailable' };
}

/** Pure readiness policy, injectable in tests without creating a DB connection. */
export async function checkReadiness(probe: () => Promise<unknown>): Promise<HealthResult> {
  try {
    await probe();
    return { statusCode: 200, body: { status: 'ready' } };
  } catch {
    return { statusCode: 503, body: { status: 'unavailable' } };
  }
}
