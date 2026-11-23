# AIT NCC Biometric Implementation Progress

**Last updated:** 2026-11-22  
**Scope:** Model clearance and preparation of a safe biometric workflow for the AIT NCC Cadet Management System.  
**Current operating position:** Automatic biometric attendance remains disabled. Manual attendance remains available and must be preserved.

## Phase status

| Phase | Status |
|---|---|
| Phase 1: Security foundation | Completed |
| Phase 1.1: Verification | Completed |
| Phase 2.1: Initial model research | Completed |
| Phase 2.2: Final model clearance | Awaiting maintainer clarification |
| Phase 3: Face registration | Pending |
| Phase 4: Face verification | Pending |
| Phase 5: Liveness detection | Pending |
| Phase 6: Attendance integration | Pending |
| Phase 7: Real-world testing | Pending |

The phase statuses above reflect the project status supplied by the project owner and the current clearance/readiness documents. A status of “completed” does not mean this update reran the phase’s tests.

## Completed work and evidence

### Phase 1 — Security foundation

Project status: **Completed**.

Current source evidence includes:

- `backend/src/services/biometricCrypto.service.ts` implements an AES-256-GCM envelope, validates 32-byte key material, binds encrypted data to the cadet ID with authenticated associated data, and records model/descriptor and consent metadata.
- `backend/src/controllers/attendance.controller.ts` scopes eligible cadets before template lookup/matching, checks template compatibility, rejects client-unattested records from production matching, records consent/revocation audit events, and retains manual attendance operations.
- `backend/src/routes/attendance.routes.ts` applies authentication and role checks to biometric and attendance endpoints.
- `backend/prisma/schema.prisma` defines a unique biometric template per cadet and a unique attendance record per `(sessionId, cadetId)`.
- Existing test artifacts include `backend/src/__tests__/biometric-hardening.test.ts`, `backend/src/__tests__/biometric-security.test.ts`, and `backend/src/__tests__/attendance-scope.test.ts`.

### Phase 1.1 — Verification

Project status: **Completed**. The test files above provide verification coverage for encryption, access control, matching scope, disabled biometric attendance, consent revocation, and attendance uniqueness. **No tests were executed during this progress-document update**, so this document does not make a new pass claim.

### Phase 2.1 — Initial model research

Project status: **Completed**. The initial research compared face-api, YuNet, SFace, AuraFace, FaceX, and PAD candidates. It concluded that free availability, source-code licensing, and reported benchmark performance do not by themselves establish pretrained-weight rights, training-data provenance, institutional use rights, or PAD reliability.

### Phase 2.2 — Final model clearance investigation

Investigation completed; clearance is **awaiting maintainer clarification**. `BIOMETRIC_MODEL_CLEARANCE/CLEARANCE_TRACKER.md` records the artifact/license/provenance state and the open questions for each candidate. `BIOMETRIC_MODEL_CLEARANCE/README.md` links the unsent drafts and defines clearance gates.

Current status:

- No candidate recognition or PAD weights are cleared for AIT NCC use.
- Maintainers have **not been contacted**. Drafts are prepared only; no email or public issue has been sent.
- AuraFace `glintr100.onnx`: Apache-2.0 and commercial-use statements are present, but training source names/rights and an immutable file hash/revision remain unresolved.
- OpenCV SFace `face_recognition_sface_2021dec.onnx`: the model directory has Apache-2.0 evidence and a reported SHA-256, but exact checkpoint training datasets/upstream authorization require confirmation.
- FaceX: the exact variant/revision/hash, per-variant weight grant, and MS1M-RefineV2 provenance/rights require clarification.
- Silent-Face-Anti-Spoofing/MiniFASNet: exact checkpoint revision/hash and named training data/rights remain unresolved; repository code licensing is not treated as sufficient weight clearance.

## Existing implementation snapshot

The application uses React/TypeScript, Express, PostgreSQL, and Prisma.

- Registration and profile enrollment currently use browser-side face-api to capture a single frame and submit a 128-value descriptor. Current enrollment code is in `frontend/src/components/auth/RegisterModal.tsx` and `frontend/src/components/attendance/FaceEnrollmentModal.tsx`.
- Backend enrollment and attendance logic is in `backend/src/controllers/auth.controller.ts`, `backend/src/controllers/attendance.controller.ts`, and `backend/src/routes/attendance.routes.ts`.
- The descriptor is stored in `BiometricTemplate.descriptor` as an encrypted envelope. The encrypted payload carries model name/version, format, consent metadata, and `CLIENT_UNATTESTED` capture status for browser-derived descriptors.
- The current attendance UI and API still contain a face verification path, but backend challenge and verification endpoints refuse automatic operation unless `ENABLE_BIOMETRIC_ATTENDANCE` is explicitly true. Do not change this setting as part of pending phases.
- No server-side image inference or PAD service is established in the current architecture.
- Manual marking remains available through the authenticated attendance routes and UI. `TrainingAttendance` has a unique `(sessionId, cadetId)` key and manual writes use upsert/transaction behavior.
- Consent is presently represented by a UI assertion, encrypted payload metadata, and audit events. A dedicated consent/revocation record and guardian-consent workflow are not established. A revocation endpoint deletes the template and writes an audit event.

See `BIOMETRIC_IMPLEMENTATION_READINESS.md` for feature-by-feature gaps, likely files, API/schema dependencies, security risks, and tests.

## Outstanding licensing and provenance questions

Before selecting a model, record and verify for each exact artifact:

1. Immutable release/repository revision, exact filename, and independently verified SHA-256.
2. Whether the license applies to the pretrained weights themselves, separately from code.
3. Named training datasets, versions, sources, and the rights/permissions supporting downstream institutional use.
4. Permission for local self-hosting and institutional/nonprofit biometric verification or attendance.
5. Permission and conditions for redistribution, conversion, quantization, fine-tuning, and derivative weights.
6. Attribution, NOTICE, fees, or other obligations.
7. Restrictions involving biometric identification, attendance, institutions, cadets, and minors.
8. Separate rights/provenance for every detector, recognizer, and PAD model used together.

The current tracker links the official repositories, licenses, maintainer forums/issues, and exact clarification drafts. No model may be assumed cleared based on stars, availability, benchmark results, or code license alone.

## Privacy and legal review requirements

An authorized institutional privacy/legal reviewer must determine the applicable requirements before collecting or processing real biometric data. Review must cover:

- lawful basis and purpose limitation for face verification/attendance;
- informed and voluntary consent, age assessment, guardian/parent consent where required, and a meaningful non-biometric alternative;
- notices, retention duration, access controls, revocation, deletion, backup retention, and audit records;
- whether biometric attendance is appropriate for cadets and whether any local/institutional policy prohibits or limits it;
- handling of false matches, false rejections, appeals, accommodations, and human review;
- vendor/model terms and training-data rights, including permitted institutional and minor-related use.

This is a required approval gate, not a conclusion that any particular law has been satisfied.

## Database and implementation dependencies

- **No schema changes are approved or proposed for execution by this document.** Do not run migrations.
- Existing `BiometricTemplate` has one row per cadet; its `descriptor` field stores the encrypted versioned payload. Model metadata is currently inside that payload, not expressed as dedicated Prisma columns.
- A durable consent lifecycle, guardian/subject linkage where required, explicit revocation status, and deletion workflow may require a new Prisma model/API and migration. Present a migration plan and obtain separate approval before any schema change.
- Server-side processing requires an approved model/PAD pair, artifact pinning, a private inference service boundary, authenticated Express-to-inference requests, request limits, safe in-memory processing, and no biometric material in logs or routine API responses.
- One-to-one verification should be designed so the backend authorizes the claimed cadet and session before comparing. Current browser-generated descriptors are not trusted evidence; existing records marked `CLIENT_UNATTESTED` must not silently become trusted after a model change.
- Model/preprocessing/descriptor version changes require explicit compatibility handling and re-enrollment planning. Do not compare incompatible versions.
- Attendance integration depends on all licensing, privacy, security, PAD, and reliability gates. Manual attendance must remain independent and usable.

## Next actions and responsible person

| Action | Responsible person | Status |
|---|---|---|
| Review and approve the four prepared maintainer clarification drafts | Project owner | Pending |
| Send approved requests through the official channels; save replies and any attachments | Project owner / authorized institutional representative | Not contacted yet |
| Update the clearance tracker with exact artifact hashes/revisions and maintainer evidence | Project owner with technical maintainer | Pending |
| Complete privacy/legal review, including cadet/minor consent and non-biometric alternative | Authorized institutional privacy/legal reviewer | Pending |
| Decide whether any candidate meets policy; document a no-go if evidence is insufficient | Project owner and institutional reviewers | Pending |
| Prepare server-side implementation design and any migration proposal after clearance | NCC technical maintainer | Blocked on prior gates |
| Execute controlled tests with consenting participants and document recognition/PAD metrics | QA lead and authorized reviewer | Pending; only after approval |

No maintainer has been contacted by this project package. The prepared drafts are under `BIOMETRIC_MODEL_CLEARANCE/`.

## Conditions before enabling biometric attendance

Do not enable `ENABLE_BIOMETRIC_ATTENDANCE` until **all** of these are met and documented:

1. Recognition and PAD artifacts have immutable identifiers/hashes and written, artifact-specific use and redistribution clearance adequate for the intended institutional workflow.
2. Training-data provenance and rights are established to the institution’s satisfaction.
3. Institutional privacy/legal review approves the purpose, consent process (including age/guardian requirements), retention, deletion, appeal process, and non-biometric alternative.
4. Server-side processing replaces trust in browser-submitted descriptors, quality scores, and liveness claims; the inference service is private and security-reviewed.
5. One-to-one verification, session/role/platoon scope, duplicate prevention, revocation, model-version compatibility, audit, and key management are tested.
6. PAD and recognition are independently evaluated under representative devices, lighting, poses, demographic groups, and attack scenarios, with operating thresholds and false-accept/false-reject risks reviewed.
7. Manual attendance fallback is confirmed operational and remains available if the camera, model, network, or verification fails.
8. Any required schema changes have an approved migration plan and explicit authorization before migration execution.
9. A final controlled rollout review approves activation. Until then, automatic attendance remains disabled.

## Documents

- `BIOMETRIC_MODEL_CLEARANCE/README.md`
- `BIOMETRIC_MODEL_CLEARANCE/CLEARANCE_TRACKER.md`
- `BIOMETRIC_MODEL_CLEARANCE/AURAFACE_CLARIFICATION.md`
- `BIOMETRIC_MODEL_CLEARANCE/SFACE_CLARIFICATION.md`
- `BIOMETRIC_MODEL_CLEARANCE/FACEX_CLARIFICATION.md`
- `BIOMETRIC_MODEL_CLEARANCE/MINIFASNET_CLARIFICATION.md`
- `BIOMETRIC_IMPLEMENTATION_READINESS.md`

## Security remediation sprint update — BSR-04/05/07/08 (2026-11-22)

This dated addendum records the scoped code changes and checks completed in the working tree. The phase-status table above is intentionally unchanged; this sprint did not provide evidence to advance the biometric implementation phases. Institutional approval is not assumed, the consent schema remains unimplemented, and `ENABLE_BIOMETRIC_ATTENDANCE` remains disabled.

- **BSR-04:** Authenticated API requests now require a live durable session ID; sid-less legacy JWTs are rejected and require sign-in. OTP session creation and success audit, logout revocation and audit, and single-session revocation and audit are transactional. Security middleware/session unit suites passed with mocks.
- **BSR-05:** In-process challenges now store only SHA-256 token digests, enforce per-operator and global pending limits, expire and consume once, and bind to the durable auth session. Store unit tests passed. Multi-instance availability remains unresolved: a worker mismatch rejects the challenge; no shared service or schema was introduced.
- **BSR-07:** Biometric attendance uses conditional claim/create and maps unique-key races to a duplicate conflict. Manual attendance retains its correction/upsert behavior. Controller/mocked duplicate tests passed; PostgreSQL concurrency was not run.
- **BSR-08:** Attendance state changes and their audit events are in the same transaction; post-commit notifications follow successful finalization/attendance writes. Successful OTP login/logout/session revocation audits are transactional. A mocked audit failure test passed. PostgreSQL rollback behavior was not exercised. Login-failure audit still has a best-effort catch, and attendance audit details still include direct cadet identifiers pending access/retention/minimization review.

Verification executed: `npm run test:biometric` (33 passed, 0 failed in the biometric security suite; hardening checks passed), `session-policy.test.ts` (passed), `verification-challenge-store.test.ts` (passed), `security-phase3a.test.ts` (26 passed, 0 failed), and backend `npx tsc --noEmit` (passed). These were mocked/pure checks only; no database was connected and no migration or schema change was made. See `BIOMETRIC_FINAL_SECURITY_REVIEW.md` for detail and remaining risks.

## Follow-up remediation record — BSR-04/05/07/08 (2026-11-22)

The phase table above remains unchanged. This work is security remediation and design only; it does not complete model clearance, consent schema work, face registration, liveness or attendance rollout.

- **BSR-04:** Confirmed successful OTP verification issues a JWT containing the created durable `AuthSession.id` as `sid`; logout and session revocation use that durable row. No refresh endpoint is mounted. Existing sid-less legacy tokens require re-login (password plus OTP), not password reset. This compatibility behavior is documented in `BIOMETRIC_FINAL_SECURITY_REVIEW.md` and the BSR design report.
- **BSR-05:** Prepared a PostgreSQL shared challenge-store schema and atomic transaction design in `BIOMETRIC_BSR05_BSR08_BSR07_DESIGN.md`. It requires a new model/table and migration, so no implementation/schema work was made. Current in-memory worker-local challenge limitations remain.
- **BSR-07:** Prepared a two-client disposable PostgreSQL contention test design in the BSR design report. No database was created or contacted; database concurrency remains unverified. Existing mocked tests cover race handling. Manual attendance correction behavior was preserved.
- **BSR-08:** Login-failure auditing no longer stores identifier hashes or swallows audit persistence errors; it uses internal user identity when known and a generic unknown actor otherwise, returning a sanitized 503 when audit storage is unavailable. Attendance audit detail now uses internal cadet/session IDs and omits names/regimental numbers. Audit and attendance writes remain transactionally paired.

Verification for this follow-up: `NODE_ENV=test PURE_MOCK_TEST=true npx ts-node src/__tests__/login-failure-audit.test.ts` passed; `npm test` passed all configured guarded/pure suites (isolation, DB safety, public routes, biometric security 33/0, phase 3A security 26/0, OTP/recovery/password/session suites); `npx tsc --noEmit` passed. No database, migration, model, flag, or production service was accessed or changed. PostgreSQL rollback/concurrency and endpoint-level login-audit 503 behavior remain unverified by runtime tests. See `BIOMETRIC_FINAL_SECURITY_REVIEW.md` for exact evidence and limits.

## Provider abstraction prototype — verified implementation (2026-11-22)

Added a provider contract and isolated deterministic mock component; this does not select a model or enable biometric functionality.

- `backend/src/biometrics/providerTypes.ts` defines framework-independent recognition, detection, quality, embedding, 1:1 verification, PAD and metadata contracts. Mock outcomes use separate MOCK/DEMO_ONLY discriminants; mock embedding generation explicitly returns no embedding.
- `backend/src/biometrics/mockProvider.ts` accepts only allowlisted synthetic fixture identities, rejects image payloads without reading image bytes, returns deterministic simulations and has no Prisma/controller/consent/attendance dependency.
- `backend/src/biometrics/providerFactory.ts` has no mock import or selection route. Mock construction is restricted to the explicit pure-test harness; production application startup rejects mock selection.
- `backend/src/__tests__/biometric-provider.test.ts` covers deterministic outcomes, allowlisting, wrong subject, image rejection, absent embeddings, simulated PAD, factory rejection, mock-result rejection by the production-result gate, and absence of persistence dependencies. `biometric-provider-startup.test.ts` covers startup trust policy and build exclusion.
- `BIOMETRIC_PROVIDER_IMPLEMENTATION_REPORT.md` and `BIOMETRIC_MOCK_PROVIDER_TEST_REPORT.md` record scope and evidence.

Verification actually run: direct guarded provider test passed (5 PASS summary groups); backend `npx tsc --noEmit` passed; backend `npm test` passed the configured fail-closed isolation, DB-safety, public-route, biometric-security (33), phase-3A security (26), OTP/recovery/password and session suites. Existing biometric security cases included manual attendance correction, duplicate/concurrent manual marking, rollback on audit failure, role/session controls, and the disabled-by-default biometric gate. An initial provider-test/typecheck attempt failed on required environment typing; the type was corrected and both commands then passed.

No database was connected, no migration/schema/feature flag was changed, no model was downloaded, and no real image or biometric template was created. The provider interfaces are not wired to Express attendance routes. Persistent consent, PostgreSQL challenge storage, genuine recognition/PAD, production authorization, and cross-instance provider operation remain unimplemented.

## Phase 2.7 — Provider startup trust policy (verified code-only work, 2026-11-22)

Created `BIOMETRIC_PROVIDER_STARTUP_TRUST_DESIGN.md` before implementation and recorded execution evidence in `BIOMETRIC_PROVIDER_STARTUP_TRUST_TEST_REPORT.md`.

- Added fail-closed startup validation in `backend/src/biometrics/providerStartupPolicy.ts`. `backend/src/start.ts` validates after dotenv loading and before loading the server/Prisma graph; `backend/src/server.ts` validates again before the listener. No provider settings preserve the existing disabled mode. Partial, unknown, mock, or unsupported selections fail startup; no fallback exists.
- Removed the mock import and selection route from `backend/src/biometrics/providerFactory.ts`. Mock creation now requires `NODE_ENV=test`, `PURE_MOCK_TEST=true`, `NCC_BIOMETRIC_TEST_HARNESS=true`, explicit mock settings, a synthetic allowlist, and absence of recognized deployment markers.
- Updated `backend/tsconfig.json` to exclude the mock provider and test tree from normal application emit. The TypeScript file-list check confirmed those paths are excluded.
- No real provider is implemented or wired into attendance. Deployment host/image settings remain external trust controls; arbitrary environment strings cannot attest runtime identity.

Verified: provider test and startup trust test passed (five PASS groups each); guarded `npm test` passed with isolation (5), database/API safety (12), public routes (7), biometric security (33), Phase 3A security (26), OTP/recovery/password and session suites; backend `npx tsc --noEmit` passed; filtered TypeScript emit file-list check confirmed tests/mock are excluded; `git diff --check` passed after documentation was finalized. No database was connected, no migration/schema or feature flag was changed, and manual attendance remains unaffected. Production build was not run because its script invokes Prisma generation.

## Provider security review — verified hardening (2026-11-22)

Independent adversarial review is recorded in `BIOMETRIC_PROVIDER_SECURITY_REVIEW.md`. It found that the production-result predicate relied on compile-time types for result-object shape; runtime accessor properties could execute when fields were read. The predicate now accepts only an exact plain-object shape with data properties before inspecting result values. A regression test confirms a throwing result getter is rejected without being invoked.

Additional verification confirms: mock construction is not exported as a class, provider selection has no injected environment override or fallback, common hosting markers and production mode reject mock selection, synthetic fixture inputs are exact-shape validated, image bytes are not read, metadata is shape-checked, and mock embedding remains absent. A custom production host misconfigured to look like development remains a deployment trust risk; environment checks alone are not proof of runtime identity. The factory remains unused by application routes.

Executed after the review hardening: direct guarded provider test (5 PASS summary groups), backend `npx tsc --noEmit` (passed), and backend `npm test` (exit 0; all configured isolation, DB/API safety, public-route, biometric, Phase 3A security, OTP/recovery/password and session suites passed). The production build was not run because it invokes Prisma generation. No database connection, migration, schema change, model download, application integration or feature-flag change occurred. Manual attendance remains as before and its guarded regression cases passed. These results do not establish genuine recognition, PAD, consent, liveness, or production readiness.

