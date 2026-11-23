import './test-isolation-guard';
import assert from 'assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createBiometricProvider } from '../biometrics/providerFactory';
import { createMockBiometricProviderForTestHarness } from '../biometrics/mockProvider';
import { validateBiometricProviderStartup } from '../biometrics/providerStartupPolicy';

const envKeys = [
  'NODE_ENV', 'PURE_MOCK_TEST', 'NCC_BIOMETRIC_TEST_HARNESS', 'BIOMETRIC_PROVIDER',
  'BIOMETRIC_MOCK_PROVIDER_ENABLED', 'BIOMETRIC_PROTOTYPE_MODE', 'BIOMETRIC_SYNTHETIC_ID_ALLOWLIST',
  'RENDER', 'RENDER_SERVICE_ID', 'VERCEL', 'VERCEL_ENV', 'NETLIFY', 'CONTEXT',
  'AWS_EXECUTION_ENV', 'AWS_LAMBDA_FUNCTION_NAME', 'K_SERVICE', 'GAE_ENV', 'DYNO',
  'WEBSITE_INSTANCE_ID', 'FLY_APP_NAME', 'RAILWAY_ENVIRONMENT',
] as const;
const prior = new Map<string, string | undefined>(envKeys.map((key) => [key, process.env[key]]));

const withMockHarness = (): void => {
  process.env.NODE_ENV = 'test';
  process.env.PURE_MOCK_TEST = 'true';
  process.env.NCC_BIOMETRIC_TEST_HARNESS = 'true';
  process.env.BIOMETRIC_PROVIDER = 'mock';
  process.env.BIOMETRIC_MOCK_PROVIDER_ENABLED = 'true';
  process.env.BIOMETRIC_SYNTHETIC_ID_ALLOWLIST = 'synthetic:cadet-a';
  for (const key of envKeys.slice(7)) delete process.env[key];
};

try {
  assert.strictEqual(validateBiometricProviderStartup({}), 'DISABLED', 'no provider settings preserve disabled behavior');
  assert.throws(() => validateBiometricProviderStartup({
    NODE_ENV: 'production', BIOMETRIC_PROVIDER: 'mock',
  }), /BIOMETRIC_MOCK_APPLICATION_RUNTIME_FORBIDDEN/);
  assert.throws(() => validateBiometricProviderStartup({
    NODE_ENV: 'production', BIOMETRIC_PROVIDER: 'mock', NCC_BIOMETRIC_TEST_HARNESS: 'true',
    PURE_MOCK_TEST: 'true', BIOMETRIC_MOCK_PROVIDER_ENABLED: 'true',
  }), /BIOMETRIC_RUNTIME_MARKER_CONFLICT/);
  assert.throws(() => validateBiometricProviderStartup({
    NODE_ENV: 'mystery', BIOMETRIC_PROVIDER: 'mock',
  }), /BIOMETRIC_RUNTIME_ENVIRONMENT_UNKNOWN/);
  assert.throws(() => validateBiometricProviderStartup({
    NODE_ENV: 'development', BIOMETRIC_PROVIDER: 'mock', RENDER: 'false',
  }), /BIOMETRIC_RUNTIME_MARKER_CONFLICT/);
  assert.throws(() => validateBiometricProviderStartup({
    NODE_ENV: 'production', BIOMETRIC_PROVIDER: 'mock', VERCEL_ENV: 'preview',
  }), /BIOMETRIC_RUNTIME_MARKER_CONFLICT/);
  assert.throws(() => validateBiometricProviderStartup({
    NODE_ENV: 'production', PURE_MOCK_TEST: 'true', NCC_BIOMETRIC_TEST_HARNESS: 'true',
  }), /BIOMETRIC_RUNTIME_MARKER_CONFLICT/);
  assert.throws(() => validateBiometricProviderStartup({
    NODE_ENV: 'test', BIOMETRIC_MOCK_PROVIDER_ENABLED: 'true',
  }), /BIOMETRIC_PROVIDER_CONFIG_MISSING/);
  assert.throws(() => validateBiometricProviderStartup({
    NODE_ENV: 'test', BIOMETRIC_PROVIDER: '  ',
  }), /BIOMETRIC_PROVIDER_CONFIG_MISSING/);
  assert.throws(() => validateBiometricProviderStartup({
    NODE_ENV: 'production', BIOMETRIC_PROVIDER: 'unknown', BIOMETRIC_PROTOTYPE_MODE: 'true',
  }), /BIOMETRIC_PROVIDER_UNSUPPORTED/);

  withMockHarness();
  const provider = createMockBiometricProviderForTestHarness();
  assert.strictEqual(provider.kind, 'MOCK', 'explicit isolated harness supports synthetic unit tests');
  assert.throws(() => createBiometricProvider(), /BIOMETRIC_MOCK_APPLICATION_RUNTIME_FORBIDDEN/,
    'application factory cannot select mock even in test environment');

  delete process.env.NCC_BIOMETRIC_TEST_HARNESS;
  assert.throws(() => createMockBiometricProviderForTestHarness(), /MOCK_PROVIDER_TEST_HARNESS_REQUIRED/,
    'missing test harness opt-in blocks direct mock construction');
  withMockHarness();
  process.env.VERCEL = 'spoofed';
  assert.throws(() => createMockBiometricProviderForTestHarness(), /MOCK_PROVIDER_TEST_HARNESS_REQUIRED/,
    'spoofed hosted marker blocks test harness');
  withMockHarness();
  process.env.NODE_ENV = 'production';
  process.env.VERCEL_ENV = 'production';
  assert.throws(() => createMockBiometricProviderForTestHarness(), /MOCK_PROVIDER_TEST_HARNESS_REQUIRED/,
    'test flags cannot override production runtime');

  process.env.NODE_ENV = 'production';
  delete process.env.PURE_MOCK_TEST;
  delete process.env.NCC_BIOMETRIC_TEST_HARNESS;
  delete process.env.VERCEL_ENV;
  process.env.BIOMETRIC_PROVIDER = 'mock';
  assert.throws(() => (createBiometricProvider as any)({
    NODE_ENV: 'development', BIOMETRIC_PROVIDER: 'mock',
  }), /BIOMETRIC_MOCK_APPLICATION_RUNTIME_FORBIDDEN/,
  'factory ignores caller-supplied environment and keeps production restrictions');

  const factorySource = readFileSync(resolve(__dirname, '../biometrics/providerFactory.ts'), 'utf8');
  const serverSource = readFileSync(resolve(__dirname, '../server.ts'), 'utf8');
  const startSource = readFileSync(resolve(__dirname, '../start.ts'), 'utf8');
  const tsconfig = JSON.parse(readFileSync(resolve(__dirname, '../../tsconfig.json'), 'utf8'));
  assert.doesNotMatch(factorySource, /mockProvider/,
    'application factory has no import path to the mock provider');
  assert.ok(serverSource.indexOf('validateBiometricProviderStartup(process.env)') < serverSource.indexOf('app.listen(PORT'),
    'provider configuration is validated before the HTTP listener starts');
  assert.ok(startSource.indexOf('validateBiometricProviderStartup(process.env)') < startSource.indexOf("require('./server')"),
    'normal start entrypoint validates before loading the server graph');
  assert.ok(tsconfig.exclude.includes('src/__tests__/**/*'));
  assert.ok(tsconfig.exclude.includes('src/biometrics/mockProvider.ts'));

  console.log('[PASS] Startup allows provider-disabled default and rejects partial/unknown/unsupported config');
  console.log('[PASS] Production, unknown and conflicting hosted markers cannot select the mock');
  console.log('[PASS] Explicit test harness can construct synthetic mock; app factory still rejects mock');
  console.log('[PASS] Missing/spoofed test markers and caller override attempts fail closed');
  console.log('[PASS] Production factory has no mock import; build excludes mock and test files');
} finally {
  for (const key of envKeys) {
    const value = prior.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
