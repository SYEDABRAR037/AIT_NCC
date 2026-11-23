# AIT NCC — Biometric Provider Security Review

**Review date:** 2026-11-22  
**Scope:** Provider contracts, deterministic mock, selection factory and focused tests. Read-only checks were supplemented by narrowly scoped hardening and regression tests.  
**Overall conclusion:** The isolated mock provider is suitable for synthetic unit-test use under its explicit configuration, but it is not an authorization component and is not integrated into attendance. **Do not use it to authorize enrollment, verification, liveness or attendance.**

## Findings

### PR-01 — Runtime result objects could invoke getters during production eligibility checking

- **Severity:** MEDIUM — fixed in this review.
- **Affected code:** `backend/src/biometrics/providerTypes.ts`, `isProductionEligibleVerification`.
- **Before:** TypeScript types constrained compile-time callers, but a runtime object passed as `unknown` could have accessor properties for `kind`, `outcome`, `provider` or `subjectId`. Reading those fields could execute caller-controlled code. Result shape was also not runtime-checked for unexpected keys.
- **Impact:** A future integration using this predicate could encounter unexpected exceptions or accept an object shape that its compile-time type did not describe. This was not an attendance bypass in the current app: the predicate is not wired to routes.
- **Correction:** Require a plain object with the exact expected own keys and data properties before reading values. Continue to require REAL classification, verified match, expected subject, valid metadata, exact registered metadata object identity, and an approved model identifier.
- **Evidence:** New regression test supplies a throwing getter and verifies rejection without invoking it. Provider test passes.
- **Remaining boundary:** This helper checks in-process provider-result provenance only. It does not authenticate the subject, validate consent/enrollment/session/PAD/eligibility, or authorize an attendance write.

### PR-02 — Production exclusion depends partly on deployment environment being truthful

- **Severity:** MEDIUM — residual risk.
- **Affected code:** `backend/src/biometrics/mockProvider.ts`, `createMockBiometricProvider`; `backend/src/biometrics/providerFactory.ts`, `createBiometricProvider`.
- **Behavior:** Mock construction rejects `NODE_ENV=production` and common hosting markers, and otherwise requires explicit provider selection, enablement, development prototype opt-in or pure-test mode, and a synthetic identity allowlist. Unsupported and missing provider selections fail closed; no fallback exists.
- **Risk:** An unrecognized production host with a misconfigured `NODE_ENV=development` and the required prototype settings could still instantiate the mock. Environment variables cannot prove that a machine is genuinely a local development machine. The provider currently is not wired to startup or any route, which sharply limits present exposure.
- **Recommendation:** Before any integration, enforce an independently controlled production startup policy (deployment identity/config validation), keep mock modules out of production request paths, and fail startup if the configured provider is not an explicitly approved real provider. Do not rely solely on `NODE_ENV` or provider result fields.
- **Evidence:** Tests cover production mode, one hosted marker, missing/invalid config, unsupported provider, and missing dev prototype mode. A complete inventory of every possible hosting platform is not a meaningful guarantee.

### PR-03 — Synthetic namespace separation is enforced by the mock but must remain separate from real account identity

- **Severity:** LOW — residual integration risk.
- **Affected code:** `backend/src/biometrics/mockProvider.ts`, `parseAllowlist` and `resolveFixture`.
- **Behavior:** Only fixed fixture identifiers and allowlisted `synthetic:` subject IDs are accepted; unknown IDs, real-looking IDs, fixture-subject mismatch and unknown fixtures are rejected. No account lookup occurs.
- **Risk:** A future adapter could incorrectly map a real cadet's account ID into the synthetic namespace or treat a fixture result as an authenticated user. The current component cannot prove how a future integration maps identities.
- **Recommendation:** Keep mock identity resolution in a separate synthetic test seam, never map fixture IDs to database users, and reject MOCK evidence before any production business decision.
- **Evidence:** Unit cases cover unknown and non-synthetic identity rejection and cross-fixture subject mismatch. Static dependency assertion confirms no account/database lookup import.

### PR-04 — Provider selection is not yet enforced by application startup or an HTTP boundary

- **Severity:** MEDIUM — integration gate, not a current route vulnerability.
- **Affected code:** `backend/src/biometrics/providerFactory.ts`; application startup and attendance routes currently have no provider integration.
- **Behavior:** The factory safely rejects absent/unsupported selection and does not fall back. The `MockBiometricProvider` class is not exported; mock creation rechecks the real process environment and accepts no injected environment object.
- **Risk:** Future code could avoid the factory or pass client-supplied result data directly to business logic. This codebase currently does neither because no provider integration exists.
- **Recommendation:** Integrate through one startup-constructed provider instance, keep construction inaccessible to controllers, accept no provider metadata/results from request bodies, and make route authorization independently enforce auth, durable session, consent, enrollment, PAD, scope, rate limits, audit and transactional duplicate handling.
- **Evidence:** Repository search found provider factory usage only in the provider test and its mock-provider import. Attendance remains separately gated and unmodified in this review.

### PR-05 — Provider metadata and evidence are runtime-validated but not cryptographic attestations

- **Severity:** MEDIUM — inherent trust boundary for future adapters.
- **Affected code:** `backend/src/biometrics/providerTypes.ts`, `isProviderMetadata` and `isProductionEligibleVerification`.
- **Behavior:** Metadata must be a plain object with exact keys and data properties; provider kind, known capability set and unique capabilities are checked. The result gate also requires the exact metadata object held by the expected provider instance.
- **Risk:** Any trusted in-process code can construct objects and claim `REAL`; object identity is not cryptographic proof and does not attest an external service response. This is acceptable only as a local wiring guard, not a cross-process trust protocol.
- **Recommendation:** A future private inference adapter must validate its authenticated service response and stamp trusted provider metadata server-side. Never accept these fields from a browser or unauthenticated service response.
- **Evidence:** Tests reject omitted, extra-key, accessor-backed and copied/forged metadata; wrong subject and MOCK result are also rejected.

### PR-06 — Recognition and PAD are separate contracts, while the provider exposes them as one bundle

- **Severity:** LOW — design observation.
- **Affected code:** `backend/src/biometrics/providerTypes.ts`, `FaceRecognitionProvider`, `PresentationAttackDetectionProvider`, and `BiometricProvider`.
- **Behavior:** Recognition and PAD use separate interfaces and typed result unions, but `BiometricProvider` groups both interfaces into a single replaceable provider bundle.
- **Impact:** Current mock clearly labels PAD as simulated and explicitly says it is not liveness/PAD. A future deployment may operate recognition and PAD as separate services or require independent versioning/availability, which the bundle can still represent only with distinct metadata but not independent factory selection.
- **Recommendation:** Keep the contracts separate. If operationally separate providers are selected later, split the factory/configuration and require independent policy/version validation. Do not treat a mock simulated pass as liveness.

### PR-07 — No fallback on provider errors; the failure behavior is fail-closed

- **Severity:** INFORMATIONAL — verified safe behavior.
- **Affected code:** `backend/src/biometrics/providerFactory.ts` and `backend/src/biometrics/mockProvider.ts`.
- **Behavior:** Missing/unsupported/invalid configuration throws controlled internal error codes. The factory has no catch-and-fallback path. The mock throws on unknown identity, fixture or sample shape.
- **Impact:** Callers must map errors to sanitized API errors if an integration is added; they must not turn provider errors into a successful verification or attendance result.
- **Evidence:** Configuration and rejection tests pass. There is no current API error mapper for this unused component.

### PR-08 — Mock write isolation is structural, not a database integration proof

- **Severity:** INFORMATIONAL — verified within the component boundary.
- **Affected code:** `backend/src/biometrics/mockProvider.ts` and `backend/src/__tests__/biometric-provider.test.ts`.
- **Behavior:** Mock imports no Prisma, controller, attendance, consent or repository code, exposes no write methods, uses static fixtures, and never generates embeddings. It does not access image bytes.
- **Impact:** The focused test proves this module boundary, not that arbitrary future callers cannot perform writes after receiving a mock result.
- **Evidence:** Static dependency and surface assertions pass; no database was connected. A future integration needs a test that MOCK evidence cannot reach persistence or mutation services.

## Adversarial checklist

| Question | Result |
|---|---|
| Can MOCK/DEMO_ONLY become a genuine verification? | **No through the current typed gate.** The gate requires REAL and SERVER_MODEL_OUTPUT and exact registered metadata. The mock is not wired to attendance. Future callers must still enforce the other authorization checks. |
| Can production select mock through environment misconfiguration? | **Blocked for `NODE_ENV=production` and recognized host markers; not universally provable.** A misidentified, unrecognized production host can mimic development configuration. Residual PR-02 remains. |
| Can synthetic identities impersonate actual cadets? | **No within this component.** Fixed fixtures and synthetic prefix/allowlist are required; no real identity lookup exists. Future identity mapping remains a boundary to preserve. |
| Can arbitrary images reach the mock? | **No.** Exact own-key/data-property shape is required; image samples and extra byte fields are rejected before reading bytes. |
| Can the mock return embedding-like data? | **No.** Embedding call returns `NOT_GENERATED` without an embedding field. |
| Can provider metadata be forged or omitted? | **Not accepted by the current result gate when copied, malformed or omitted.** In-process trusted code can still fabricate data; metadata is not cryptographic attestation. |
| Can future Express integration bypass safeguards? | **No current integration exists.** A future controller could bypass factory/gates unless architecture enforces a single startup provider and does not accept request-supplied evidence. |
| Can provider errors cause insecure fallback? | **No factory fallback exists.** Error mapping in any future controller must remain fail-closed and sanitized. |
| Can mock indirectly write templates, consent or attendance? | **No through its code/dependencies.** It has no persistence dependency or write API. This is not a proof about future callers. |
| Are recognition and PAD separated? | **Yes at the interface and result-type level.** They are bundled in `BiometricProvider`; independent deployment selection can be added later if required. |

## Verification performed

- `NODE_ENV=test PURE_MOCK_TEST=true npx ts-node src/__tests__/biometric-provider.test.ts` — **PASS**, 5 grouped assertions covering deterministic/immutable simulation, rejection of invalid subjects/samples/images, no embedding and MOCK result rejection, factory configuration, and absence of persistence dependencies.
- `npx tsc --noEmit` in `backend` — **PASS**.
- `npm test` in `backend` — **PASS**, exit code 0. Configured guarded suites: isolation (5), database/API safety (12), public routes (7), biometric security (33), Phase 3A security (26), login OTP fallback, recovery characterization/delivery, password policy and session policy. Manual attendance correction, duplicate/concurrent marking and audit rollback cases passed. The new provider test is a separate command and is not part of `npm test`.
- `git diff --check` — **PASS**, exit code 0 after the review documentation was finalized.
- Production bundle build — **NOT RUN**. The package build runs `prisma generate && tsc`; Prisma generation was intentionally not invoked. TypeScript check is not a claim that a production artifact was built.
- No database connection, migration, schema edit, model installation/download, real image, external notification, attendance provider wiring or flag change occurred.

## Required gates before any provider integration

1. Keep `ENABLE_BIOMETRIC_ATTENDANCE` disabled and manual attendance intact.
2. Obtain artifact-specific model and PAD licensing/provenance clearance; none is established by this review.
3. Implement and verify the consent lifecycle and required database migration only after its separate approval and disposable PostgreSQL validation.
4. Define the production startup trust policy and ensure mock code cannot be selected in any production runtime, including misconfigured custom hosts.
5. Add authenticated server-side image/inference adapter, model/version validation and safe error mapping; never trust browser descriptors or provider metadata.
6. Verify subject, purpose, consent, enrollment authorization, durable session, attendance session, eligibility, rate limits, audit and transactional persistence independently of provider results.
7. Add integration tests proving MOCK evidence cannot mutate consent, templates or attendance, and verify real-provider outage behavior fails closed.

**Disposition:** Provider abstraction hardening is verified for isolated synthetic tests. It is not approved for application integration or production use. Genuine recognition and PAD are absent; consent, model clearance, deployment trust, and end-to-end authorization remain gates.

## Phase 2.7 startup trust update — 2026-11-22

The earlier PR-02 and PR-04 findings described the pre-Phase 2.7 factory, which could select the mock in development/test configuration and had no application startup validation. They are superseded for the current source state by the new startup trust policy:

- The application provider factory no longer imports the mock and rejects mock selection regardless of runtime markers.
- Startup validation runs after dotenv loading and before the standard start entrypoint loads the server; the server also validates before its HTTP listener.
- With no provider settings, biometric provider use remains disabled. Partial, unknown, mock, or unsupported provider configuration fails closed; no fallback exists.
- Direct mock construction requires the explicit test-only harness configuration, and the normal TypeScript emit excludes both tests and the mock implementation.
- Focused startup/provider tests, backend TypeScript check, guarded `npm test`, emit-file-list exclusion check, and `git diff --check` passed. See `BIOMETRIC_PROVIDER_STARTUP_TRUST_TEST_REPORT.md`.

Residual deployment limitation: the repository cannot attest its hosting control plane or prove that a deployment environment was not deliberately misconfigured. This is mitigated in application code by removing mock selection from startup/factory and excluding mock/test modules from normal application emit, but image provenance and deployment settings still require operational controls. No real provider is available and no attendance integration occurred.
