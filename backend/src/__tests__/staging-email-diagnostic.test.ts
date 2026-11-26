import assert from 'node:assert/strict';
import { ProcessLocalRateLimitStore } from '../services/rateLimitStore';
import { sendOtpEmail } from '../services/mail.service';
import { createStagingEmailDiagnosticHandler } from '../controllers/stagingEmailDiagnostic.controller';
import { isStagingEmailDiagnosticEnabled, isValidDiagnosticAuthorization, stagingEmailDiagnosticIdentity } from '../stagingEmailDiagnosticPolicy';
import { mountStagingEmailDiagnosticRoute, stagingEmailDiagnosticRouter } from '../routes/stagingEmailDiagnostic.routes';

const diagnosticSecret = 'x'.repeat(43); // Synthetic test value; never use as a real secret.
const validEnv: Record<string, string | undefined> = {
  NODE_ENV: 'production',
  RENDER: 'true',
  RENDER_SERVICE_ID: stagingEmailDiagnosticIdentity.serviceId,
  RENDER_SERVICE_NAME: 'ait-ncc-backend-staging',
  NCC_STAGING_EMAIL_DIAGNOSTIC_EXPECTED_SERVICE_ID: stagingEmailDiagnosticIdentity.serviceId,
  RENDER_GIT_BRANCH: stagingEmailDiagnosticIdentity.branch,
  RENDER_EXTERNAL_URL: stagingEmailDiagnosticIdentity.externalUrl,
  IS_PULL_REQUEST: 'false',
  NCC_STAGING_EMAIL_DIAGNOSTIC_ENABLED: 'true',
  NCC_STAGING_EMAIL_DIAGNOSTIC_SECRET: diagnosticSecret,
  NCC_STAGING_EMAIL_DIAGNOSTIC_RECIPIENT: 'controlled-inbox@gmail.com',
  BREVO_API_KEY: 'synthetic-brevo-test-key',
  BREVO_SENDER_EMAIL: 'verified-sender@example.com',
  JWT_SECRET: 'synthetic-jwt-secret',
  OTP_SECRET: 'synthetic-otp-secret',
};

const response = () => ({
  statusCode: 200,
  body: undefined as any,
  headers: {} as Record<string, string>,
  status(code: number) { this.statusCode = code; return this; },
  json(body: unknown) { this.body = body; return this; },
  setHeader(name: string, value: string) { this.headers[name] = value; return this; },
});

const request = (secret?: string, body?: unknown, ip = '203.0.113.8') => ({
  ip,
  socket: { remoteAddress: ip },
  body,
  get(name: string) { return name.toLowerCase() === 'x-ncc-staging-diagnostic-secret' ? secret : undefined; },
} as any);

async function run() {
  assert.equal(isStagingEmailDiagnosticEnabled(validEnv), true, 'exact staging identity enables diagnostic');
  assert.equal(isValidDiagnosticAuthorization(validEnv, diagnosticSecret), true);
  assert.equal(isValidDiagnosticAuthorization(validEnv, 'wrong'), false);

  for (const [key, value] of [
    ['NODE_ENV', 'development'], ['RENDER', 'false'], ['RENDER_SERVICE_ID', 'production-service'],
    ['RENDER_SERVICE_NAME', 'ait-ncc'], ['IS_PULL_REQUEST', 'true'],
    ['NCC_STAGING_EMAIL_DIAGNOSTIC_EXPECTED_SERVICE_ID', 'production-service'],
    ['RENDER_GIT_BRANCH', 'main'], ['RENDER_EXTERNAL_URL', 'https://ait-ncc-backend-staging.onrender.com/'],
    ['NCC_STAGING_EMAIL_DIAGNOSTIC_ENABLED', 'false'], ['BREVO_API_KEY', ''],
    ['NCC_STAGING_EMAIL_DIAGNOSTIC_SECRET', 'short'], ['NCC_STAGING_EMAIL_DIAGNOSTIC_RECIPIENT', 'not-an-email'],
  ] as const) {
    assert.equal(isStagingEmailDiagnosticEnabled({ ...validEnv, [key]: value }), false, `${key} mismatch fails closed`);
  }
  assert.equal(isStagingEmailDiagnosticEnabled({ ...validEnv, NCC_STAGING_EMAIL_DIAGNOSTIC_SECRET: validEnv.JWT_SECRET }), false, 'diagnostic secret cannot reuse JWT secret');

  const mounted: Array<{ path: string; router: unknown }> = [];
  assert.equal(mountStagingEmailDiagnosticRoute({ use: (path: string, router: unknown) => mounted.push({ path, router }) } as any, validEnv), true);
  assert.equal(mounted.length, 1);
  assert.equal(mounted[0].path, '/api/internal/staging');
  assert.equal(mountStagingEmailDiagnosticRoute({ use: () => { throw new Error('must not mount'); } } as any, { ...validEnv, NODE_ENV: 'development' }), false);
  const registeredRoute = (stagingEmailDiagnosticRouter as any).stack.find((layer: any) => layer.route)?.route;
  assert.equal(registeredRoute?.path, '/email-diagnostic');
  assert.equal(registeredRoute?.methods?.post, true);

  const mailEnvKeys = ['NODE_ENV', 'PURE_MOCK_TEST', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME'] as const;
  const previousMailEnv = Object.fromEntries(mailEnvKeys.map((key) => [key, process.env[key]]));
  const previousFetch = global.fetch;
  const mailLogs: string[] = [];
  const originalConsoleLog = console.log;
  let providerRequest: any;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.PURE_MOCK_TEST;
    process.env.BREVO_API_KEY = 'synthetic-provider-key-that-must-not-be-logged';
    process.env.BREVO_SENDER_EMAIL = 'verified-sender@example.com';
    process.env.BREVO_SENDER_NAME = 'NCC Staging Test';
    global.fetch = (async (_input: any, init?: RequestInit) => {
      providerRequest = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ messageId: 'synthetic-provider-message-id' }), { status: 201 });
    }) as typeof fetch;
    console.log = (...parts: unknown[]) => mailLogs.push(parts.join(' '));
    const serviceRecipient = 'controlled-inbox@gmail.com';
    const serviceCode = '654321';
    const result = await sendOtpEmail({ recipientEmail: serviceRecipient, cadetName: 'NCC staging email diagnostic', otp: serviceCode, purpose: 'login' });
    assert.equal(result.success, true);
    assert.equal(providerRequest.to[0].email, serviceRecipient);
    assert.ok(providerRequest.textContent.includes(serviceCode));
    assert.ok(providerRequest.htmlContent.includes(serviceCode));
    for (const secretValue of [serviceRecipient, serviceCode, process.env.BREVO_API_KEY!]) {
      assert.equal(mailLogs.join(' ').includes(secretValue), false, 'mail service logs omit recipient, code and API key');
    }
  } finally {
    global.fetch = previousFetch;
    console.log = originalConsoleLog;
    for (const key of mailEnvKeys) {
      const previous = previousMailEnv[key];
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  }

  const delivered: any[] = [];
  const handler = createStagingEmailDiagnosticHandler({
    env: () => validEnv,
    rateLimitStore: new ProcessLocalRateLimitStore(),
    state: { attempted: false },
    sendEmail: async (message) => { delivered.push(message); return { success: true, messageId: 'synthetic-id' }; },
  });

  const missingAuth = response();
  await handler(request(undefined), missingAuth as any);
  assert.equal(missingAuth.statusCode, 401);
  assert.equal(delivered.length, 0);

  const recipientAttempt = response();
  await handler(request(diagnosticSecret, { recipientEmail: 'attacker@example.test', otp: '123456' }, '203.0.113.9'), recipientAttempt as any);
  assert.equal(recipientAttempt.statusCode, 400, 'request cannot supply recipient or code');
  assert.equal(delivered.length, 0);
  const textPayload = response();
  await handler(request(diagnosticSecret, 'recipientEmail=attacker@example.com&otp=123456', '203.0.113.9'), textPayload as any);
  assert.equal(textPayload.statusCode, 400, 'non-JSON payloads cannot supply a recipient or code');

  const captured: string[] = [];
  const oldLogs = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...parts: unknown[]) => captured.push(parts.join(' '));
  console.warn = (...parts: unknown[]) => captured.push(parts.join(' '));
  console.error = (...parts: unknown[]) => captured.push(parts.join(' '));
  const accepted = response();
  try { await handler(request(diagnosticSecret), accepted as any); }
  finally { Object.assign(console, oldLogs); }
  assert.equal(accepted.statusCode, 202);
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].recipientEmail, validEnv.NCC_STAGING_EMAIL_DIAGNOSTIC_RECIPIENT);
  assert.match(delivered[0].otp, /^\d{6}$/);
  assert.equal(JSON.stringify(accepted.body).includes(delivered[0].otp), false);
  assert.equal(JSON.stringify(accepted.body).includes(validEnv.NCC_STAGING_EMAIL_DIAGNOSTIC_RECIPIENT!), false);
  assert.equal(JSON.stringify(accepted.body).includes(diagnosticSecret), false);
  assert.equal(captured.join(' ').includes(delivered[0].otp), false);
  assert.equal(captured.join(' ').includes(validEnv.NCC_STAGING_EMAIL_DIAGNOSTIC_RECIPIENT!), false);
  assert.equal(captured.join(' ').includes(validEnv.BREVO_API_KEY!), false);
  assert.equal(JSON.stringify(accepted.body).includes(validEnv.BREVO_API_KEY!), false);

  const secondSend = response();
  await handler(request(diagnosticSecret), secondSend as any);
  assert.equal(secondSend.statusCode, 409);
  assert.equal(delivered.length, 1, 'a process sends at most once');

  let releaseSend!: (value: { success: boolean }) => void;
  const concurrentSends: any[] = [];
  const concurrentHandler = createStagingEmailDiagnosticHandler({
    env: () => validEnv,
    rateLimitStore: new ProcessLocalRateLimitStore(),
    state: { attempted: false },
    sendEmail: async (message) => { concurrentSends.push(message); return new Promise((resolve) => { releaseSend = resolve; }); },
  });
  const concurrentA = response();
  const concurrentB = response();
  const first = concurrentHandler(request(diagnosticSecret, undefined, '203.0.113.10'), concurrentA as any);
  const second = concurrentHandler(request(diagnosticSecret, undefined, '203.0.113.11'), concurrentB as any);
  await second;
  assert.equal(concurrentSends.length, 1, 'concurrent requests invoke provider once');
  assert.equal(concurrentB.statusCode, 409);
  releaseSend({ success: true });
  await first;
  assert.equal(concurrentA.statusCode, 202);

  const failedHandler = createStagingEmailDiagnosticHandler({
    env: () => validEnv,
    rateLimitStore: new ProcessLocalRateLimitStore(),
    state: { attempted: false },
    sendEmail: async () => ({ success: false, error: `provider failure ${diagnosticSecret}` }),
  });
  const savedLog = console.error;
  const logs: string[] = [];
  console.error = (...parts: unknown[]) => logs.push(parts.join(' '));
  try {
    const failed = response();
    await failedHandler(request(diagnosticSecret, undefined, '203.0.113.12'), failed as any);
    assert.equal(failed.statusCode, 503);
    assert.equal(JSON.stringify(failed.body).includes(diagnosticSecret), false);
    assert.equal(logs.join(' ').includes(diagnosticSecret), false);
    const retry = response();
    await failedHandler(request(diagnosticSecret, undefined, '203.0.113.12'), retry as any);
    assert.equal(retry.statusCode, 409, 'ambiguous provider failure cannot cause a duplicate retry');
  } finally {
    console.error = savedLog;
  }

  const thrownProviderHandler = createStagingEmailDiagnosticHandler({
    env: () => validEnv,
    rateLimitStore: new ProcessLocalRateLimitStore(),
    state: { attempted: false },
    sendEmail: async () => { throw new Error(`provider exception ${diagnosticSecret}`); },
  });
  const thrownFailure = response();
  await thrownProviderHandler(request(diagnosticSecret, undefined, '203.0.113.13'), thrownFailure as any);
  assert.equal(thrownFailure.statusCode, 503);
  assert.equal(JSON.stringify(thrownFailure.body).includes(diagnosticSecret), false);

  const limitedHandler = createStagingEmailDiagnosticHandler({
    env: () => validEnv,
    rateLimitStore: new ProcessLocalRateLimitStore(),
    state: { attempted: false },
    sendEmail: async () => ({ success: true }),
  });
  for (let index = 0; index < 5; index += 1) {
    const denied = response();
    await limitedHandler(request('wrong-secret', undefined, '203.0.113.20'), denied as any);
    assert.equal(denied.statusCode, 401);
  }
  const throttled = response();
  await limitedHandler(request('wrong-secret', undefined, '203.0.113.20'), throttled as any);
  assert.equal(throttled.statusCode, 429);
  assert.ok(throttled.headers['Retry-After']);

  console.log('Staging email diagnostic policy/handler tests passed. No email or database operation occurred.');
}

run().catch((error) => {
  console.error('Staging email diagnostic tests failed.');
  process.exitCode = 1;
  void error;
});
