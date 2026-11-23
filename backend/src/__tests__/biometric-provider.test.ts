import './test-isolation-guard';
import assert from 'assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createBiometricProvider } from '../biometrics/providerFactory';
import { validateBiometricProviderStartup } from '../biometrics/providerStartupPolicy';
import { createMockBiometricProviderForTestHarness } from '../biometrics/mockProvider';
import {
  isProductionEligibleVerification,
  isProviderMetadata,
  ProviderCapability,
  ProviderMetadata,
} from '../biometrics/providerTypes';

const envKeys = [
  'NODE_ENV',
  'PURE_MOCK_TEST',
  'BIOMETRIC_PROVIDER',
  'BIOMETRIC_MOCK_PROVIDER_ENABLED',
  'BIOMETRIC_PROTOTYPE_MODE',
  'BIOMETRIC_SYNTHETIC_ID_ALLOWLIST',
  'NCC_BIOMETRIC_TEST_HARNESS',
  'RENDER',
  'RENDER_SERVICE_ID',
  'VERCEL',
  'VERCEL_ENV',
  'NETLIFY',
  'CONTEXT',
  'AWS_EXECUTION_ENV',
  'AWS_LAMBDA_FUNCTION_NAME',
  'K_SERVICE',
  'GAE_ENV',
  'DYNO',
  'WEBSITE_INSTANCE_ID',
  'FLY_APP_NAME',
  'RAILWAY_ENVIRONMENT',
] as const;

const previousEnv = new Map<string, string | undefined>(envKeys.map((key) => [key, process.env[key]]));
const setTestProviderEnv = () => {
  process.env.NODE_ENV = 'test';
  process.env.PURE_MOCK_TEST = 'true';
  process.env.BIOMETRIC_PROVIDER = 'mock';
  process.env.BIOMETRIC_MOCK_PROVIDER_ENABLED = 'true';
  process.env.BIOMETRIC_PROTOTYPE_MODE = '';
  process.env.NCC_BIOMETRIC_TEST_HARNESS = 'true';
  process.env.BIOMETRIC_SYNTHETIC_ID_ALLOWLIST = 'synthetic:cadet-a,synthetic:cadet-b';
  for (const key of envKeys.slice(7)) delete process.env[key];
};
const restoreEnv = () => {
  for (const key of envKeys) {
    const value = previousEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

const expectError = async (work: () => unknown | Promise<unknown>, expected: RegExp) => {
  await assert.rejects(async () => work(), expected);
};

async function run(): Promise<void> {
  try {
    setTestProviderEnv();
    const provider = createMockBiometricProviderForTestHarness();
    assert.strictEqual(provider.kind, 'MOCK');
    assert.ok(Object.isFrozen(provider));
    assert.ok(Object.isFrozen(provider.recognition));
    assert.ok(Object.isFrozen(provider.presentationAttack));
    assert.ok(Object.isFrozen(provider.recognition.metadata));
    assert.ok(Object.isFrozen(provider.recognition.metadata.capabilities));

    const sampleA = { kind: 'SYNTHETIC_FIXTURE' as const, subjectId: 'synthetic:cadet-a', fixtureId: 'fixture-cadet-a-frontal' };
    const sampleAAlternate = { ...sampleA, fixtureId: 'fixture-cadet-a-alternate' };
    const sampleABlurry = { ...sampleA, fixtureId: 'fixture-cadet-a-blurry' };
    const sampleB = { kind: 'SYNTHETIC_FIXTURE' as const, subjectId: 'synthetic:cadet-b', fixtureId: 'fixture-cadet-b-frontal' };

    const first = await provider.recognition.verifyOneToOne({
      probe: sampleA, reference: sampleA, expectedSubjectId: 'synthetic:cadet-a',
    });
    const repeat = await provider.recognition.verifyOneToOne({
      probe: sampleA, reference: sampleA, expectedSubjectId: 'synthetic:cadet-a',
    });
    assert.deepStrictEqual(first, repeat, 'identical synthetic fixture inputs are deterministic');
    assert.strictEqual(first.kind, 'MOCK');
    assert.strictEqual(first.classification, 'DEMO_ONLY');
    assert.strictEqual(first.outcome, 'SIMULATED_MATCH');
    assert.ok(Object.isFrozen(first), 'result cannot be mutated after provider return');
    assert.ok(Object.isFrozen(first.provider), 'provider metadata reference cannot be replaced or mutated');
    assert.strictEqual((await provider.recognition.verifyOneToOne({
      probe: sampleA, reference: sampleAAlternate, expectedSubjectId: 'synthetic:cadet-a',
    })).outcome, 'SIMULATED_NO_MATCH');

    await expectError(() => provider.recognition.verifyOneToOne({
      probe: sampleA, reference: sampleB, expectedSubjectId: 'synthetic:cadet-a',
    }), /MOCK_FIXTURE_SUBJECT_MISMATCH/);

    const detected = await provider.recognition.detectFace(sampleA);
    const quality = await provider.recognition.evaluateImageQuality(sampleABlurry);
    assert.strictEqual(detected.outcome, 'SIMULATED_FACE_DETECTED');
    assert.strictEqual(detected.classification, 'DEMO_ONLY');
    assert.strictEqual(quality.outcome, 'SIMULATED_REJECTED');
    assert.deepStrictEqual(quality.reasonCodes, ['DEMO_BLUR']);

    const embedding = await provider.recognition.generateEmbedding(sampleA);
    assert.strictEqual(embedding.kind, 'MOCK');
    assert.strictEqual(embedding.outcome, 'NOT_GENERATED');
    assert.ok(!('embedding' in embedding));

    const pad = await provider.presentationAttack.evaluateSample(sampleA);
    assert.strictEqual(pad.kind, 'MOCK');
    assert.strictEqual(pad.outcome, 'SIMULATED_PASS');
    assert.strictEqual(pad.limitation, 'THIS_IS_NOT_LIVENESS_OR_PAD');

    await expectError(() => provider.recognition.detectFace({
      kind: 'SYNTHETIC_FIXTURE', subjectId: 'synthetic:cadet-unknown', fixtureId: 'fixture-cadet-a-frontal',
    }), /MOCK_SYNTHETIC_IDENTITY_NOT_ALLOWLISTED/);
    await expectError(() => provider.recognition.detectFace({
      kind: 'SYNTHETIC_FIXTURE', subjectId: 'existing-user-123', fixtureId: 'fixture-cadet-a-frontal',
    }), /MOCK_SYNTHETIC_IDENTITY_NOT_ALLOWLISTED/);
    await expectError(() => provider.recognition.detectFace({
      kind: 'SYNTHETIC_FIXTURE', subjectId: 'synthetic:cadet-a', fixtureId: 'not-a-fixture',
    }), /MOCK_FIXTURE_UNKNOWN/);
    await expectError(() => provider.recognition.detectFace({
      kind: 'SYNTHETIC_FIXTURE', subjectId: 'synthetic:cadet-a',
      fixtureId: 'fixture-cadet-a-frontal', bytes: new Uint8Array([1, 2, 3]),
    } as any), /MOCK_PROVIDER_ACCEPTS_SYNTHETIC_FIXTURES_ONLY/);
    await expectError(() => provider.recognition.detectFace({
      kind: 'SYNTHETIC_FIXTURE',
      get subjectId(): string { throw new Error('SYNTHETIC_INPUT_GETTER_MUST_NOT_RUN'); },
      fixtureId: 'fixture-cadet-a-frontal',
    } as any), /MOCK_PROVIDER_ACCEPTS_SYNTHETIC_FIXTURES_ONLY/);

    const guardedImage = {
      kind: 'SERVER_IMAGE' as const,
      mimeType: 'image/jpeg' as const,
      get bytes(): Uint8Array { throw new Error('REAL_IMAGE_BYTES_MUST_NOT_BE_READ'); },
    };
    await expectError(() => provider.recognition.detectFace(guardedImage), /MOCK_PROVIDER_ACCEPTS_SYNTHETIC_FIXTURES_ONLY/);
    await expectError(() => provider.presentationAttack.evaluateSample(guardedImage), /MOCK_PROVIDER_ACCEPTS_SYNTHETIC_FIXTURES_ONLY/);

    const expectedRealProvider: ProviderMetadata & { kind: 'REAL' } = Object.freeze({
      providerName: 'approved-provider',
      providerVersion: '1.0.0',
      modelIdentifier: 'approved-model-v1',
      kind: 'REAL',
      capabilities: Object.freeze(['ONE_TO_ONE_VERIFICATION'] as ProviderCapability[]),
    });
    const expected = {
      subjectId: 'synthetic:cadet-a',
      provider: expectedRealProvider,
      approvedModelIdentifiers: new Set(['approved-model-v1']),
    };
    assert.strictEqual(isProviderMetadata(expectedRealProvider), true);
    assert.strictEqual(isProviderMetadata(undefined), false);
    assert.strictEqual(isProviderMetadata({
      providerName: 'forged',
      providerVersion: '1',
      modelIdentifier: 'model',
      kind: 'REAL',
      capabilities: ['ONE_TO_ONE_VERIFICATION'],
      extra: 'unexpected',
    }), false);
    assert.strictEqual(isProviderMetadata({
      get providerName(): string { throw new Error('METADATA_GETTER_MUST_NOT_RUN'); },
      providerVersion: '1',
      modelIdentifier: 'model',
      kind: 'REAL',
      capabilities: ['ONE_TO_ONE_VERIFICATION'],
    }), false);
    assert.strictEqual(isProductionEligibleVerification(first, expected), false);
    assert.strictEqual(isProductionEligibleVerification({
      kind: 'REAL',
      classification: 'SERVER_MODEL_OUTPUT',
      outcome: 'VERIFIED_MATCH',
      subjectId: 'synthetic:cadet-a',
      provider: { ...expectedRealProvider },
    }, expected), false, 'copied/forged metadata is rejected by identity');
    assert.strictEqual(isProductionEligibleVerification({
      kind: 'REAL',
      classification: 'SERVER_MODEL_OUTPUT',
      outcome: 'VERIFIED_MATCH',
      subjectId: 'synthetic:cadet-a',
    }, expected), false, 'omitted metadata is rejected');
    assert.strictEqual(isProductionEligibleVerification({
      kind: 'REAL',
      classification: 'SERVER_MODEL_OUTPUT',
      outcome: 'VERIFIED_MATCH',
      subjectId: 'synthetic:cadet-b',
      provider: expectedRealProvider,
    }, expected), false, 'wrong subject is rejected');
    assert.strictEqual(isProductionEligibleVerification({
      get kind(): string { throw new Error('VERIFICATION_RESULT_GETTER_MUST_NOT_RUN'); },
      classification: 'SERVER_MODEL_OUTPUT',
      outcome: 'VERIFIED_MATCH',
      subjectId: 'synthetic:cadet-a',
      provider: expectedRealProvider,
    }, expected), false, 'accessor-backed results are rejected without invoking caller code');

    // Ensure consumers cannot bypass configuration by injecting a fake env object
    // or constructing the mock class directly.
    const mockSource = readFileSync(resolve(__dirname, '../biometrics/mockProvider.ts'), 'utf8');
    assert.doesNotMatch(mockSource, /export class MockBiometricProvider/);
    assert.doesNotMatch(mockSource, /@prisma\/client|from ['"].*(?:db|prisma|controller|attendance|consent)/i);
    assert.deepStrictEqual(Object.keys(provider).sort(), ['kind', 'recognition', 'presentationAttack', 'metadata', 'allowlistedSubjectIds'].sort());
    assert.ok(!('createTemplate' in provider) && !('createAttendance' in provider) && !('grantConsent' in provider));

    // Application factory has no mock path, even when test variables are present.
    process.env.NODE_ENV = 'production';
    assert.throws(() => createBiometricProvider(), /BIOMETRIC_RUNTIME_MARKER_CONFLICT/);
    assert.throws(() => createMockBiometricProviderForTestHarness(), /MOCK_PROVIDER_TEST_HARNESS_REQUIRED/);
    process.env.NODE_ENV = 'test';
    process.env.RENDER = 'true';
    assert.throws(() => createBiometricProvider(), /BIOMETRIC_RUNTIME_MARKER_CONFLICT/);
    assert.throws(() => createMockBiometricProviderForTestHarness(), /MOCK_PROVIDER_TEST_HARNESS_REQUIRED/);
    delete process.env.RENDER;
    process.env.RENDER_SERVICE_ID = 'spoofed-marker';
    assert.throws(() => createMockBiometricProviderForTestHarness(), /MOCK_PROVIDER_TEST_HARNESS_REQUIRED/);
    delete process.env.RENDER_SERVICE_ID;
    delete process.env.PURE_MOCK_TEST;
    assert.throws(() => createMockBiometricProviderForTestHarness(), /MOCK_PROVIDER_TEST_HARNESS_REQUIRED/);
    process.env.PURE_MOCK_TEST = 'true';

    process.env.NODE_ENV = 'test';
    delete process.env.BIOMETRIC_PROVIDER;
    assert.throws(() => createBiometricProvider(), /BIOMETRIC_PROVIDER_CONFIG_MISSING/);
    process.env.BIOMETRIC_PROVIDER = 'unknown';
    assert.throws(() => createBiometricProvider(), /BIOMETRIC_PROVIDER_UNSUPPORTED/);
    process.env.BIOMETRIC_PROVIDER = 'mock';
    delete process.env.BIOMETRIC_MOCK_PROVIDER_ENABLED;
    assert.throws(() => createMockBiometricProviderForTestHarness(), /BIOMETRIC_PROVIDER_CONFIG_INVALID/);
    process.env.BIOMETRIC_MOCK_PROVIDER_ENABLED = 'true';
    process.env.NODE_ENV = 'development';
    delete process.env.BIOMETRIC_PROTOTYPE_MODE;
    assert.throws(() => validateBiometricProviderStartup(process.env), /BIOMETRIC_MOCK_APPLICATION_RUNTIME_FORBIDDEN/);
    process.env.BIOMETRIC_PROTOTYPE_MODE = 'true';
    assert.throws(() => createMockBiometricProviderForTestHarness(), /MOCK_PROVIDER_TEST_HARNESS_REQUIRED/);
    process.env.NODE_ENV = 'test';
    process.env.BIOMETRIC_SYNTHETIC_ID_ALLOWLIST = 'synthetic:cadet-a,real-person';
    assert.throws(() => createMockBiometricProviderForTestHarness(), /BIOMETRIC_PROVIDER_CONFIG_INVALID/);

    assert.strictEqual(validateBiometricProviderStartup({ NODE_ENV: 'production' }), 'DISABLED');
    assert.throws(() => validateBiometricProviderStartup({ NODE_ENV: 'staging', BIOMETRIC_PROVIDER: 'mock' }), /BIOMETRIC_RUNTIME_ENVIRONMENT_UNKNOWN/);
    assert.throws(() => validateBiometricProviderStartup({ NODE_ENV: 'development', BIOMETRIC_PROVIDER: 'mock', VERCEL: 'false' }), /BIOMETRIC_RUNTIME_MARKER_CONFLICT/);
    assert.throws(() => validateBiometricProviderStartup({ NODE_ENV: 'production', BIOMETRIC_PROVIDER: 'mock', NCC_BIOMETRIC_TEST_HARNESS: 'true', PURE_MOCK_TEST: 'true' }), /BIOMETRIC_RUNTIME_MARKER_CONFLICT/);
    assert.throws(() => validateBiometricProviderStartup({ NODE_ENV: 'test', BIOMETRIC_MOCK_PROVIDER_ENABLED: 'true' }), /BIOMETRIC_PROVIDER_CONFIG_MISSING/);
    assert.throws(() => validateBiometricProviderStartup({ NODE_ENV: 'test', BIOMETRIC_PROVIDER: 'real' }), /BIOMETRIC_PROVIDER_UNSUPPORTED/);
    process.env.NODE_ENV = 'production';
    delete process.env.PURE_MOCK_TEST;
    delete process.env.NCC_BIOMETRIC_TEST_HARNESS;
    assert.throws(() => (createBiometricProvider as any)({
      NODE_ENV: 'test', BIOMETRIC_PROVIDER: 'mock', NCC_BIOMETRIC_TEST_HARNESS: 'true',
    }), /BIOMETRIC_MOCK_APPLICATION_RUNTIME_FORBIDDEN/);

    console.log('[PASS] Deterministic, immutable simulation; recognition and PAD are separate and labeled MOCK/DEMO_ONLY');
    console.log('[PASS] Mock rejects unknown/real IDs, wrong subject, malformed fixtures, getters and image samples');
    console.log('[PASS] Mock does not generate embeddings and cannot pass production result validation');
    console.log('[PASS] Test-harness-only mock construction; app startup and factory fail closed');
    console.log('[PASS] Mock module has no DB, consent, template, attendance or controller dependency');
  } finally {
    restoreEnv();
  }
}

run().catch((error) => {
  console.error('[FAIL] Biometric provider tests:', error?.stack || error?.message || error);
  process.exitCode = 1;
});
