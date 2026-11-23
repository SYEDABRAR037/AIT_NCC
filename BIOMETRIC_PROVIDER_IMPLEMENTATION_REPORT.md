# AIT NCC — Biometric Provider Implementation Report

**Date:** 2026-11-22  
**Scope:** Model-independent provider contracts and deterministic synthetic mock only.

## Pre-implementation findings and design conflicts

- The architecture document proposed provider injection but no provider abstraction existed in backend services.
- Attendance controller still contains a process-local challenge store and a legacy client-descriptor flow. Both remain separate and the biometric route remains disabled by default.
- The mock must not be connected to attendance, consent, template persistence, or Prisma. It is therefore implemented as a standalone service with no controller/database imports.
- The current database test guard supports isolated pure tests with a sentinel and blocks unmocked Prisma operations. No database is needed for this provider component.
- No cleared recognition or PAD model exists, so only simulated outcomes are implemented. A mock result cannot be considered a real match or liveness result.

## Implemented

### Provider contracts

Created backend/src/biometrics/providerTypes.ts with independent interfaces/types for provider metadata, face detection, image quality, embedding generation, 1:1 verification, and PAD. Requests distinguish synthetic fixture samples from future server image samples. Response unions distinguish MOCK/DEMO_ONLY results from REAL/SERVER_MODEL_OUTPUT. The mock embedding result contains no embedding value.

The exported production-result predicate runtime-checks an exact plain-object shape with data properties only, then checks result kind, evidence classification, verified-match outcome, expected subject, valid metadata, exact registered metadata object identity and an approved model identifier. It is a provenance check only; it does not replace authentication, session, consent, enrollment, PAD, subject/session eligibility, rate limits, audit, or attendance transaction checks. This is not cryptographic attestation; trusted in-process code can still fabricate values.

### Deterministic synthetic provider

Created backend/src/biometrics/mockProvider.ts with fixed server-owned fixture mappings. It:

- Accepts only synthetic-prefixed subject IDs present in an explicit allowlist.
- Requires known fixture IDs and fixture-to-subject consistency.
- Returns deterministic simulated detection, quality, 1:1 and PAD outcomes.
- Returns NOT_GENERATED for embedding generation.
- Rejects image input and extra caller-controlled fields using exact object-shape/data-property validation, before accessing bytes.
- Labels all outputs MOCK and DEMO_ONLY; PAD output states it is not liveness/PAD.
- Has no Prisma, database, controller, consent, template, attendance or repository dependency.

### Provider factory

The application factory in backend/src/biometrics/providerFactory.ts no longer imports or selects the mock. The application startup policy rejects any mock selection in every environment; unsupported real-provider selections also fail closed because no real provider exists. No fallback is implemented. With no provider-related settings, startup retains the existing provider-disabled behavior. Startup validates settings in backend/src/start.ts after dotenv loading and before requiring the server graph, and backend/src/server.ts validates again before listening. The mock has a separate direct constructor for the explicit pure-test harness only, requiring NODE_ENV=test, PURE_MOCK_TEST=true, NCC_BIOMETRIC_TEST_HARNESS=true, explicit mock settings, synthetic allowlist and absence of deployment markers. This test marker is not treated as proof of locality: normal application startup and the factory still reject mock.

The production TypeScript project excludes backend/src/__tests__ and backend/src/biometrics/mockProvider.ts from normal emit. This structurally keeps mock construction out of the application artifact. Hosting markers are deny signals only; deployment image/settings control remains external and cannot be proven by arbitrary process variables.

No HTTP route calls this factory, no provider is selected at application startup, and no attendance or consent behavior is wired to it.

## Tests and verification

- Tests: backend/src/__tests__/biometric-provider.test.ts and backend/src/__tests__/biometric-provider-startup.test.ts.
- The test uses the repository's test-isolation guard first and does not create a Prisma client or access a database.
- Provider behavior test passed with five PASS summary groups, including runtime result-shape/accessor validation.
- Backend TypeScript check passed: npx tsc --noEmit.
- Existing guarded backend suite passed: npm test. It covered DB isolation guard regressions, public routes, biometric security, manual attendance behavior, phase-3A authentication/security, OTP/recovery/password policy and session policy.

The initial implementation verification caught a TypeScript environment type mismatch and was corrected. This security review then added exact runtime verification-result shape checks and an accessor regression test. The final provider test and typecheck passed. No source behavior was weakened.

## Files changed in this implementation

- backend/src/biometrics/providerTypes.ts — created.
- backend/src/biometrics/mockProvider.ts — created.
- backend/src/biometrics/providerFactory.ts — created.
- backend/src/__tests__/biometric-provider.test.ts — created.
- BIOMETRIC_PROVIDER_SECURITY_REVIEW.md — created after adversarial review.
- BIOMETRIC_PROVIDER_STARTUP_TRUST_DESIGN.md and BIOMETRIC_PROVIDER_STARTUP_TRUST_TEST_REPORT.md — record the trust policy and verification evidence.
- BIOMETRIC_PROVIDER_IMPLEMENTATION_REPORT.md — created.
- BIOMETRIC_MOCK_PROVIDER_TEST_REPORT.md — created.
- BIOMETRIC_IMPLEMENTATION_PROGRESS.md — appended verified implementation evidence; phase table unchanged.

## Safety and limits

- No database connection, migration, schema edit, package installation, model download, real image, biometric template, consent mutation, or attendance record was used/created.
- ENABLE_BIOMETRIC_ATTENDANCE and production flags were not changed.
- Existing manual attendance source behavior was not modified; guarded regressions passed.
- Existing unrelated dirty/untracked files were preserved.
- This is not real face recognition, PAD, liveness, consent, or authorization. The mock is not wired into the app and must never authorize attendance.
- Factory environment checks are defense-in-depth, not proof of deployment identity. Production startup must independently reject mock selection before any future integration.
- The backend production build was not run because its script invokes Prisma generation; `npx tsc --noEmit` passed without generating Prisma artifacts.

## Remaining work

The PostgreSQL challenge store remains process-local pending BSR-05 design remediation, separate migration approval and verified disposable-database tests. Consent persistence is not implemented. No real inference provider/model is selected or installed. Further prototype integration should begin only by injecting the provider into a non-persistent synthetic test seam while retaining all production biometric gates.
