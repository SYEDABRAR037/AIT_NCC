/**
 * Model-independent server-side biometric contracts.
 *
 * These contracts intentionally contain no Express or Prisma types. Mock results
 * use separate discriminants and cannot be mistaken for server-model decisions.
 */

export type ProviderKind = 'MOCK' | 'REAL';

export type ProviderCapability =
  | 'FACE_DETECTION'
  | 'IMAGE_QUALITY'
  | 'EMBEDDING_GENERATION'
  | 'ONE_TO_ONE_VERIFICATION'
  | 'PRESENTATION_ATTACK_DETECTION';

export interface ProviderMetadata {
  readonly providerName: string;
  readonly providerVersion: string;
  readonly modelIdentifier: string;
  readonly kind: ProviderKind;
  readonly capabilities: readonly ProviderCapability[];
}

const SUPPORTED_CAPABILITIES: ReadonlySet<string> = new Set([
  'FACE_DETECTION',
  'IMAGE_QUALITY',
  'EMBEDDING_GENERATION',
  'ONE_TO_ONE_VERIFICATION',
  'PRESENTATION_ATTACK_DETECTION',
]);

export function isProviderMetadata(value: unknown): value is ProviderMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const metadata = value as Record<string, unknown>;
  const keys = Reflect.ownKeys(metadata);
  if (keys.some((key) => typeof key !== 'string')
    || keys.sort().join(',') !== 'capabilities,kind,modelIdentifier,providerName,providerVersion') return false;
  const descriptors = Object.getOwnPropertyDescriptors(metadata);
  if (Object.values(descriptors).some((descriptor) => !('value' in descriptor)
    || descriptor.get || descriptor.set)) return false;
  if (typeof metadata.providerName !== 'string' || !metadata.providerName.trim()
    || typeof metadata.providerVersion !== 'string' || !metadata.providerVersion.trim()
    || typeof metadata.modelIdentifier !== 'string' || !metadata.modelIdentifier.trim()
    || (metadata.kind !== 'MOCK' && metadata.kind !== 'REAL')
    || !Array.isArray(metadata.capabilities)) return false;
  return metadata.capabilities.every((capability) =>
    typeof capability === 'string' && SUPPORTED_CAPABILITIES.has(capability))
    && new Set(metadata.capabilities).size === metadata.capabilities.length;
}

export interface SyntheticFixtureSample {
  readonly kind: 'SYNTHETIC_FIXTURE';
  readonly subjectId: string;
  readonly fixtureId: string;
}

/**
 * Reserved for a future reviewed server-side provider. The mock rejects this
 * input before reading bytes. Browser data must never be trusted as an embedding.
 */
export interface ServerImageSample {
  readonly kind: 'SERVER_IMAGE';
  readonly bytes: Uint8Array;
  readonly mimeType: 'image/jpeg' | 'image/png';
}

export type ProviderSample = SyntheticFixtureSample | ServerImageSample;

export type MockEvidence = {
  readonly provider: ProviderMetadata & { readonly kind: 'MOCK' };
  readonly classification: 'MOCK' | 'DEMO_ONLY';
};

export type RealEvidence = {
  readonly provider: ProviderMetadata & { readonly kind: 'REAL' };
  readonly classification: 'SERVER_MODEL_OUTPUT';
};

export type FaceDetectionResult =
  | (MockEvidence & {
      readonly kind: 'MOCK';
      readonly outcome: 'SIMULATED_FACE_DETECTED' | 'SIMULATED_NO_FACE';
    })
  | (RealEvidence & {
      readonly kind: 'REAL';
      readonly outcome: 'FACE_DETECTED' | 'NO_FACE' | 'UNAVAILABLE';
      readonly faceCount: number;
    });

export type ImageQualityResult =
  | (MockEvidence & {
      readonly kind: 'MOCK';
      readonly outcome: 'SIMULATED_ACCEPTABLE' | 'SIMULATED_REJECTED';
      readonly reasonCodes: readonly string[];
    })
  | (RealEvidence & {
      readonly kind: 'REAL';
      readonly outcome: 'ACCEPTABLE' | 'REJECTED' | 'UNAVAILABLE';
      readonly reasonCodes: readonly string[];
    });

export type EmbeddingGenerationResult =
  | (MockEvidence & {
      readonly kind: 'MOCK';
      readonly outcome: 'NOT_GENERATED';
      readonly reason: 'MOCK_NEVER_GENERATES_BIOMETRIC_EMBEDDINGS';
    })
  | (RealEvidence & {
      readonly kind: 'REAL';
      readonly outcome: 'GENERATED' | 'UNAVAILABLE';
      readonly dimensions?: number;
      /** Internal server-only output. Never serialize to an ordinary API response. */
      readonly embedding?: Float32Array;
    });

export type OneToOneVerificationResult =
  | (MockEvidence & {
      readonly kind: 'MOCK';
      readonly outcome: 'SIMULATED_MATCH' | 'SIMULATED_NO_MATCH' | 'SIMULATION_UNAVAILABLE';
      readonly subjectId: string;
    })
  | (RealEvidence & {
      readonly kind: 'REAL';
      readonly outcome: 'VERIFIED_MATCH' | 'NO_MATCH' | 'UNAVAILABLE';
      readonly subjectId: string;
    });

export type PresentationAttackResult =
  | (MockEvidence & {
      readonly kind: 'MOCK';
      readonly outcome: 'SIMULATED_PASS' | 'SIMULATED_FAIL' | 'SIMULATION_UNAVAILABLE';
      readonly limitation: 'THIS_IS_NOT_LIVENESS_OR_PAD';
    })
  | (RealEvidence & {
      readonly kind: 'REAL';
      readonly outcome: 'PASS' | 'FAIL' | 'UNAVAILABLE';
      readonly policyVersion: string;
    });

export interface FaceRecognitionProvider {
  readonly metadata: ProviderMetadata;
  detectFace(sample: ProviderSample): Promise<FaceDetectionResult>;
  evaluateImageQuality(sample: ProviderSample): Promise<ImageQualityResult>;
  generateEmbedding(sample: ProviderSample): Promise<EmbeddingGenerationResult>;
  verifyOneToOne(input: {
    readonly probe: ProviderSample;
    readonly reference: ProviderSample;
    readonly expectedSubjectId: string;
  }): Promise<OneToOneVerificationResult>;
}

export interface PresentationAttackDetectionProvider {
  readonly metadata: ProviderMetadata;
  evaluateSample(sample: ProviderSample): Promise<PresentationAttackResult>;
}

export interface BiometricProvider {
  readonly kind: ProviderKind;
  readonly recognition: FaceRecognitionProvider;
  readonly presentationAttack: PresentationAttackDetectionProvider;
}

/**
 * This checks provider-result provenance from an in-process provider. Metadata
 * must be the exact object registered by the trusted provider instance; serialized
 * client/provider JSON is not accepted. It is not a complete biometric
 * attendance authorization decision; callers must separately enforce identity,
 * session, consent, enrollment, PAD, eligibility, rate limits and audit policy.
 */
export function isProductionEligibleVerification(
  result: unknown,
  expected: {
    readonly subjectId: string;
    readonly provider: ProviderMetadata & { readonly kind: 'REAL' };
    readonly approvedModelIdentifiers: ReadonlySet<string>;
  },
): result is Extract<OneToOneVerificationResult, { kind: 'REAL' }> {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  const candidate = result as Record<string, unknown>;
  if (Object.getPrototypeOf(result) !== Object.prototype) return false;
  const resultKeys = Reflect.ownKeys(candidate);
  if (resultKeys.some((key) => typeof key !== 'string')
    || resultKeys.sort().join(',') !== 'classification,kind,outcome,provider,subjectId') return false;
  const resultDescriptors = Object.getOwnPropertyDescriptors(candidate);
  if (Object.values(resultDescriptors).some((descriptor) => !('value' in descriptor)
    || descriptor.get || descriptor.set)) return false;
  if (candidate.kind !== 'REAL'
    || candidate.classification !== 'SERVER_MODEL_OUTPUT'
    || candidate.outcome !== 'VERIFIED_MATCH'
    || candidate.subjectId !== expected.subjectId
    || !isProviderMetadata(candidate.provider)
    || candidate.provider !== expected.provider
    || candidate.provider.kind !== 'REAL'
    || !isProviderMetadata(expected.provider)) return false;

  const actual = candidate.provider;
  const trusted = expected.provider;
  if (actual.providerName !== trusted.providerName
    || actual.providerVersion !== trusted.providerVersion
    || actual.modelIdentifier !== trusted.modelIdentifier
    || actual.kind !== trusted.kind
    || [...actual.capabilities].sort().join(',') !== [...trusted.capabilities].sort().join(',')) return false;

  return expected.approvedModelIdentifiers.has(actual.modelIdentifier);
}
