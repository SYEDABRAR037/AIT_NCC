import {
  BiometricProvider,
  FaceDetectionResult,
  ImageQualityResult,
  OneToOneVerificationResult,
  PresentationAttackResult,
  ProviderCapability,
  ProviderMetadata,
  ProviderSample,
  SyntheticFixtureSample,
} from './providerTypes';

type Fixture = {
  readonly subjectId: string;
  readonly identityKey: string;
  readonly faceDetected: boolean;
  readonly quality: 'ACCEPTABLE' | 'REJECTED';
  readonly qualityReasons: readonly string[];
  readonly pad: 'PASS' | 'FAIL' | 'UNAVAILABLE';
};

const FIXTURES: Readonly<Record<string, Fixture>> = Object.freeze({
  'fixture-cadet-a-frontal': Object.freeze({
    subjectId: 'synthetic:cadet-a',
    identityKey: 'synthetic-identity-a',
    faceDetected: true,
    quality: 'ACCEPTABLE',
    qualityReasons: Object.freeze([]),
    pad: 'PASS',
  }),
  'fixture-cadet-a-alternate': Object.freeze({
    subjectId: 'synthetic:cadet-a',
    identityKey: 'synthetic-identity-a-alternate',
    faceDetected: true,
    quality: 'ACCEPTABLE',
    qualityReasons: Object.freeze([]),
    pad: 'PASS',
  }),
  'fixture-cadet-a-blurry': Object.freeze({
    subjectId: 'synthetic:cadet-a',
    identityKey: 'synthetic-identity-a',
    faceDetected: true,
    quality: 'REJECTED',
    qualityReasons: Object.freeze(['DEMO_BLUR']),
    pad: 'PASS',
  }),
  'fixture-cadet-b-frontal': Object.freeze({
    subjectId: 'synthetic:cadet-b',
    identityKey: 'synthetic-identity-b',
    faceDetected: true,
    quality: 'ACCEPTABLE',
    qualityReasons: Object.freeze([]),
    pad: 'PASS',
  }),
  'fixture-no-face': Object.freeze({
    subjectId: 'synthetic:cadet-a',
    identityKey: 'synthetic-identity-a',
    faceDetected: false,
    quality: 'REJECTED',
    qualityReasons: Object.freeze(['DEMO_NO_FACE']),
    pad: 'UNAVAILABLE',
  }),
  'fixture-pad-fail': Object.freeze({
    subjectId: 'synthetic:cadet-a',
    identityKey: 'synthetic-identity-a',
    faceDetected: true,
    quality: 'ACCEPTABLE',
    qualityReasons: Object.freeze([]),
    pad: 'FAIL',
  }),
});

const CAPABILITIES: readonly ProviderCapability[] = Object.freeze([
  'FACE_DETECTION',
  'IMAGE_QUALITY',
  'EMBEDDING_GENERATION',
  'ONE_TO_ONE_VERIFICATION',
  'PRESENTATION_ATTACK_DETECTION',
]);

const isSyntheticSubjectId = (value: string): boolean =>
  /^synthetic:[a-z0-9][a-z0-9_-]{0,63}$/i.test(value);

const isHostedRuntime = (): boolean =>
  [
    'RENDER', 'RENDER_SERVICE_ID', 'VERCEL', 'VERCEL_ENV', 'NETLIFY', 'CONTEXT',
    'AWS_EXECUTION_ENV', 'AWS_LAMBDA_FUNCTION_NAME', 'K_SERVICE', 'GAE_ENV',
    'DYNO', 'WEBSITE_INSTANCE_ID', 'FLY_APP_NAME', 'RAILWAY_ENVIRONMENT',
  ].some((name) => Boolean(process.env[name]?.trim()));

const parseAllowlist = (raw: string | undefined): readonly string[] => {
  const ids = (raw ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  if (ids.length === 0 || ids.some((id) => !isSyntheticSubjectId(id)) || new Set(ids).size !== ids.length) {
    throw new Error('BIOMETRIC_PROVIDER_CONFIG_INVALID');
  }
  return Object.freeze(ids);
};

class MockBiometricProvider implements BiometricProvider {
  readonly kind = 'MOCK' as const;

  readonly metadata: ProviderMetadata = Object.freeze({
    providerName: 'ncc-synthetic-mock',
    providerVersion: '1.0.0',
    modelIdentifier: 'synthetic-fixture-set-v1',
    kind: 'MOCK',
    capabilities: Object.freeze([...CAPABILITIES]),
  });

  readonly recognition = Object.freeze({
    metadata: this.metadata,
    detectFace: async (sample: ProviderSample): Promise<FaceDetectionResult> => {
      const fixture = this.resolveFixture(sample);
      return Object.freeze({
        kind: 'MOCK',
        classification: 'DEMO_ONLY',
        provider: this.metadata as ProviderMetadata & { kind: 'MOCK' },
        outcome: fixture.faceDetected ? 'SIMULATED_FACE_DETECTED' : 'SIMULATED_NO_FACE',
      });
    },
    evaluateImageQuality: async (sample: ProviderSample): Promise<ImageQualityResult> => {
      const fixture = this.resolveFixture(sample);
      return Object.freeze({
        kind: 'MOCK',
        classification: 'DEMO_ONLY',
        provider: this.metadata as ProviderMetadata & { kind: 'MOCK' },
        outcome: fixture.quality === 'ACCEPTABLE' ? 'SIMULATED_ACCEPTABLE' : 'SIMULATED_REJECTED',
        reasonCodes: fixture.qualityReasons,
      });
    },
    generateEmbedding: async (sample: ProviderSample) => {
      this.resolveFixture(sample);
      return Object.freeze({
        kind: 'MOCK' as const,
        classification: 'DEMO_ONLY' as const,
        provider: this.metadata as ProviderMetadata & { kind: 'MOCK' },
        outcome: 'NOT_GENERATED' as const,
        reason: 'MOCK_NEVER_GENERATES_BIOMETRIC_EMBEDDINGS' as const,
      });
    },
    verifyOneToOne: async (input: {
      probe: ProviderSample;
      reference: ProviderSample;
      expectedSubjectId: string;
    }): Promise<OneToOneVerificationResult> => {
      const probe = this.resolveFixture(input.probe);
      const reference = this.resolveFixture(input.reference);
      if (!this.allowlistedSubjectIds.includes(input.expectedSubjectId)
        || probe.subjectId !== input.expectedSubjectId
        || reference.subjectId !== input.expectedSubjectId) {
        throw new Error('MOCK_FIXTURE_SUBJECT_MISMATCH');
      }
      return Object.freeze({
        kind: 'MOCK',
        classification: 'DEMO_ONLY',
        provider: this.metadata as ProviderMetadata & { kind: 'MOCK' },
        outcome: probe.identityKey === reference.identityKey ? 'SIMULATED_MATCH' : 'SIMULATED_NO_MATCH',
        subjectId: input.expectedSubjectId,
      });
    },
  });

  readonly presentationAttack = Object.freeze({
    metadata: this.metadata,
    evaluateSample: async (sample: ProviderSample): Promise<PresentationAttackResult> => {
      const fixture = this.resolveFixture(sample);
      return Object.freeze({
        kind: 'MOCK',
        classification: 'DEMO_ONLY',
        provider: this.metadata as ProviderMetadata & { kind: 'MOCK' },
        outcome: fixture.pad === 'PASS'
          ? 'SIMULATED_PASS'
          : fixture.pad === 'FAIL' ? 'SIMULATED_FAIL' : 'SIMULATION_UNAVAILABLE',
        limitation: 'THIS_IS_NOT_LIVENESS_OR_PAD',
      });
    },
  });

  private readonly allowlistedSubjectIds: readonly string[];

  constructor(allowlistedSubjectIds: readonly string[]) {
    this.allowlistedSubjectIds = Object.freeze([...allowlistedSubjectIds]);
    Object.freeze(this);
  }

  private resolveFixture(sample: ProviderSample): Fixture {
    // Reject image payloads before reading bytes. Require an exact plain-object
    // shape so a caller cannot attach image/caller-controlled fields to a fixture.
    if (!sample || typeof sample !== 'object' || Array.isArray(sample)
      || Object.getPrototypeOf(sample) !== Object.prototype
      || Reflect.ownKeys(sample).some((key) => typeof key !== 'string')
      || Reflect.ownKeys(sample).sort().join(',') !== 'fixtureId,kind,subjectId') {
      throw new Error('MOCK_PROVIDER_ACCEPTS_SYNTHETIC_FIXTURES_ONLY');
    }
    const descriptors = Object.getOwnPropertyDescriptors(sample);
    if (Object.values(descriptors).some((descriptor) => !('value' in descriptor)
      || descriptor.get || descriptor.set)) {
      throw new Error('MOCK_PROVIDER_ACCEPTS_SYNTHETIC_FIXTURES_ONLY');
    }
    const raw = sample as unknown as Record<string, unknown>;
    if (raw.kind !== 'SYNTHETIC_FIXTURE') throw new Error('MOCK_PROVIDER_ACCEPTS_SYNTHETIC_FIXTURES_ONLY');
    const fixtureSample = sample as SyntheticFixtureSample;
    if (typeof fixtureSample.subjectId !== 'string'
      || typeof fixtureSample.fixtureId !== 'string'
      || !isSyntheticSubjectId(fixtureSample.subjectId)
      || !this.allowlistedSubjectIds.includes(fixtureSample.subjectId)) {
      throw new Error('MOCK_SYNTHETIC_IDENTITY_NOT_ALLOWLISTED');
    }
    const fixture = FIXTURES[fixtureSample.fixtureId];
    if (!fixture) throw new Error('MOCK_FIXTURE_UNKNOWN');
    if (fixture.subjectId !== fixtureSample.subjectId) {
      throw new Error('MOCK_FIXTURE_SUBJECT_MISMATCH');
    }
    return fixture;
  }
}

/**
 * This exported constructor exists only for the isolated unit-test harness. The
 * application provider factory does not import this module or expose mock
 * selection. This function accepts no injectable environment object.
 */
export function createMockBiometricProviderForTestHarness(): BiometricProvider {
  if (process.env.NODE_ENV !== 'test' || process.env.PURE_MOCK_TEST !== 'true'
    || process.env.NCC_BIOMETRIC_TEST_HARNESS !== 'true' || isHostedRuntime()) {
    throw new Error('MOCK_PROVIDER_TEST_HARNESS_REQUIRED');
  }
  if (process.env.BIOMETRIC_PROVIDER?.trim().toLowerCase() !== 'mock'
    || process.env.BIOMETRIC_MOCK_PROVIDER_ENABLED !== 'true'
    || process.env.BIOMETRIC_SYNTHETIC_ID_ALLOWLIST === undefined) {
    throw new Error('BIOMETRIC_PROVIDER_CONFIG_INVALID');
  }
  return new MockBiometricProvider(parseAllowlist(process.env.BIOMETRIC_SYNTHETIC_ID_ALLOWLIST));
}
