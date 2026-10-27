const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1']);

export function requireIsolatedTestApiUrl(rawUrl = process.env.TEST_API_URL): string {
  if (!rawUrl) throw new Error('[FAIL-CLOSED API GUARD] TEST_API_URL is required; no default target is allowed.');

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('[FAIL-CLOSED API GUARD] TEST_API_URL must be a valid URL.');
  }
  if (url.protocol !== 'http:' || !LOOPBACK.has(url.hostname.toLowerCase()) || url.username || url.password) {
    throw new Error('[FAIL-CLOSED API GUARD] Test API must be unauthenticated HTTP on a loopback host.');
  }
  return url.origin;
}

export async function assertIsolatedTestApi(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/health`);
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok || body.isolatedTestEnvironment !== true) {
    throw new Error(
      '[FAIL-CLOSED API GUARD] API health check did not identify a test server connected to a disposable database; no workflow requests were sent.'
    );
  }
}
