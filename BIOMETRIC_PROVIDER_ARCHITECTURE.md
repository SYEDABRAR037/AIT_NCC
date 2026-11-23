# AIT NCC — Model-Independent Biometric Provider Architecture

**Status:** Design only. No model selected, no code/schema/dependency changes, no feature-flag changes.

## Flow

React → authenticated Express API → authentication/session/role validation → consent and enrollment authorization → private inference provider → 1:1 decision → transaction-safe attendance persistence and audit.

The browser may submit bounded capture bytes only. It must not submit trusted embeddings, match scores, model identity, quality score, subject authority, consent timestamp, provider identity, or authorization. Express derives subject/session/purpose from verified server context. Inference is private server-to-server; embeddings/raw images never appear in normal API responses or logs.

## Provider interfaces

    type ModelIdentity = {
      provider: string; model: string; version: string; artifactSha256: string
    };
    type Capture = { bytes: Uint8Array; mimeType: 'image/jpeg' | 'image/png' };
    type Quality = { accepted: boolean; reasonCodes: string[] };
    type Pad = { outcome: 'PASS' | 'FAIL' | 'UNAVAILABLE'; policyVersion: string };
    type Verification = {
      outcome: 'MATCH' | 'NO_MATCH' | 'UNAVAILABLE';
      model: ModelIdentity; quality: Quality; pad: Pad
    };

    interface FaceDetectionProvider {
      inspect(capture: Capture): Promise<Quality>;
    }
    interface FaceRecognitionProvider {
      verifyOneToOne(input: {
        capture: Capture; enrolledTemplate: Uint8Array;
        expectedCadetId: string; expectedModel: ModelIdentity
      }): Promise<Verification>;
    }
    interface PresentationAttackProvider {
      assess(input: { capture: Capture; challenge: string }): Promise<Pad>;
    }
    interface BiometricProvider {
      readonly identity: ModelIdentity;
      inspect(capture: Capture): Promise<Quality>;
      verify(input: VerifyInput): Promise<Verification>;
    }

Provider implementations are injected into services. An approved model registry pins provider/model/version/hash and preprocessing. Unknown identity, output shape, dimensions, NaN/Inf, stale version or provider error fails closed.

## Synthetic mock provider

Use deterministic fixtures for allowlisted synthetic test identities and scenario keys: MATCH, NO_MATCH, LOW_QUALITY, PAD_FAIL, UNAVAILABLE. Do not use real images or generated facial vectors. The mock must not accept arbitrary client-supplied match booleans and must never create/update BiometricTemplate or TrainingAttendance. Label every result DEMO_ONLY and synthetic. It is selectable only in local development/test with an explicit switch and must fail startup in production. The attendance feature flag remains off; tests verify its disabled response.

## Responsibilities

| Component | Responsibility |
|---|---|
| React | Optional flow and manual alternative; capture only after user action; submit bounded bytes, display limited result. |
| Express middleware | Durable authenticated session, role/scope, CSRF/origin as appropriate, content/type/size checks, rate limit and correlation ID. |
| Consent service | Subject/purpose/policy/version, freshness, revocation, staff authorization and one-time challenge checks; deny when unverifiable. |
| Inference adapter | Authenticated call to private provider; timeout, response schema and resource validation. |
| Template service | Authorized decrypt-on-use; exact model compatibility; encrypt-on-write; no client template exposure. |
| Attendance service | 1:1 only; recheck session/eligibility at commit; unique attendance claim and required audit in one transaction. |
| Manual path | Remains independent during camera, provider, consent, challenge or database biometric-store outage. |

## Optional self-hosted Python service

A private FastAPI service can host a later cleared model on CPU. React calls Express only; Express sends authenticated, network-isolated requests to inference. Python must not connect directly to NCC persistence or own consent/attendance policy. Enforce image limits, decode safety, timeout, memory/CPU limits, service authentication and no raw payload logs. Self-hostability does not establish license rights.

## Failure behavior and tests

Missing/revoked consent, invalid challenge, wrong subject, poor quality, PAD failure, no match, stale model or invalid response means no attendance write. Provider outage returns a sanitized unavailable result; manual attendance still works. Mock contract tests should cover scoping, no persistence side effects, timeout/version mismatch, and flag-off behavior without setting the feature flag on.

No model, PAD method, liveness claim, threshold, institutional policy, production inference service or real-cadet capture is approved here.
