import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handler } from './recovery.ts';
import { isRecoveryAction, resolveRecoveryApiTarget } from './recoverySecurity.ts';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
  const modalSource = readFileSync(fileURLToPath(new URL('../../src/components/auth/ForgotPasswordModal.tsx', import.meta.url)), 'utf8');
const event = {
  httpMethod: 'POST',
  path: '/.netlify/functions/recovery',
  queryStringParameters: { action: 'verify-otp' },
  headers: { authorization: 'Bearer synthetic-test-token' },
  body: JSON.stringify({ challengeId: 'synthetic-challenge', otp: '000000' }),
};

try {
  assert.equal(isRecoveryAction('request-otp'), true);
  assert.equal(isRecoveryAction('other'), false);
  assert.equal(resolveRecoveryApiTarget(undefined, 'request-otp'), null);
  assert.equal(resolveRecoveryApiTarget('not a URL', 'request-otp'), null);
  assert.equal(resolveRecoveryApiTarget('file:///tmp', 'request-otp'), null);
  assert.equal(resolveRecoveryApiTarget('http://api.example.test', 'request-otp'), null);
  assert.equal(resolveRecoveryApiTarget('https://user:pass@example.test', 'request-otp'), null);
  assert.equal(resolveRecoveryApiTarget('http://localhost:5050', 'request-otp'), null);
  assert.equal(resolveRecoveryApiTarget('http://localhost:5050', 'request-otp', true), 'http://localhost:5050/api/auth/recovery/request-otp');
  assert.equal(resolveRecoveryApiTarget('https://api.example.test/stage/', 'verify-otp'), 'https://api.example.test/stage/api/auth/recovery/verify-otp');
  for (const action of ['request-otp', 'resend-otp', 'verify-otp', 'reset-password']) {
    assert.match(modalSource, new RegExp(`safeApiFetch\\(recoveryEndpoint\\('${action}'\\)`));
  }

  Object.assign(process.env, { NETLIFY: 'true', CONTEXT: 'production', NODE_ENV: 'production' });

  delete process.env.RECOVERY_API_BASE_URL;
  process.env.DATABASE_URL = 'present-but-unused';
  process.env.JWT_SECRET = 'present-but-unused';
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls++;
    throw new Error('unexpected fetch');
  };
  const missingConfig = await handler(event, {}, () => {});
  assert.equal(missingConfig.statusCode, 503);
  assert.equal(fetchCalls, 0);

  process.env.RECOVERY_API_BASE_URL = 'http://api.example.test';
  const invalidUrl = await handler(event, {}, () => {});
  assert.equal(invalidUrl.statusCode, 503);
  assert.equal(fetchCalls, 0);

  delete process.env.NETLIFY;
  delete process.env.NODE_ENV;
  const deployedContextHttpUrl = await handler(event, {}, () => {});
  assert.equal(deployedContextHttpUrl.statusCode, 503);
  assert.equal(fetchCalls, 0);
  process.env.NETLIFY = 'true';
  process.env.NODE_ENV = 'production';

  process.env.RECOVERY_API_BASE_URL = 'https://api.example.test';
  globalThis.fetch = async () => { throw new Error('synthetic upstream failure'); };
  const apiFailure = await handler(event, {}, () => {});
  assert.equal(apiFailure.statusCode, 503);
  assert.equal(apiFailure.body.includes('synthetic upstream failure'), false);

  let forwardedRequest;
  globalThis.fetch = async (url, options) => {
    forwardedRequest = { url, options };
    return new Response(JSON.stringify({ success: true, challengeAccepted: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const success = await handler(event, {}, () => {});
  assert.equal(success.statusCode, 200);
  assert.equal(forwardedRequest.url, 'https://api.example.test/api/auth/recovery/verify-otp');
  assert.equal(forwardedRequest.options.method, 'POST');
  assert.equal(forwardedRequest.options.redirect, 'error');
  assert.equal(forwardedRequest.options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(forwardedRequest.options.body), JSON.parse(event.body));
  assert.deepEqual(JSON.parse(success.body), { success: true, challengeAccepted: true });

  console.log('Recovery routing tests passed.');
} finally {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
