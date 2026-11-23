# AIT NCC biometric implementation readiness — Phases 3–7

**Purpose:** Model-independent inspection and planning. No model is selected or implemented. Automatic biometric attendance remains disabled. Manual attendance is retained.

**Inspection note:** The requested `BIOMETRIC_IMPLEMENTATION_PROGRESS.md` was not present in the workspace. This report is based on direct inspection of current source and schema plus the Phase 2.2 investigation in the project conversation. Existing working-tree changes were preserved. No source, environment, database, or Prisma schema was modified.

## Current architecture and workflow

- **Registration:** `RegisterModal.tsx` loads face-api models in the browser and collects one camera frame/descriptor. It submits `faceDescriptor` and consent with the cadet registration payload. `auth.controller.ts` creates the user and encrypted biometric template in a transaction.
- **Profile enrollment:** `FaceEnrollmentModal.tsx` also captures one browser frame and sends a 128-value descriptor plus a client-supplied quality score to `POST /api/attendance/biometrics/enroll`.
- **Storage:** `BiometricTemplate.descriptor` is a text field. The application encrypts the payload with AES-256-GCM and includes model name/version, descriptor format, capture status, and consent metadata. Browser-derived records are marked `CLIENT_UNATTESTED`; they are not compatible with production matching. A dedicated consent/revocation entity and explicit model-version columns are absent.
- **Attendance:** The face attendance component loads face-api models in the browser and can construct a descriptor. Backend matching and challenge endpoints return a disabled response unless `ENABLE_BIOMETRIC_ATTENDANCE === 'true'`. No server-side image inference or PAD service is present. The manual marking workflow continues through authenticated attendance routes.
- **Manual attendance:** Officers create sessions, load the eligible roster, mark attendance, close sessions, and view summaries. Attendance is unique per `(sessionId, cadetId)` and writes use upsert/transactions. This path is independent of biometric activation.

## Phase readiness matrix

### 1. Cadet registration and profile workflows

- **Existing implementation:** Registration form in `frontend/src/components/auth/RegisterModal.tsx`; profile enrollment modal in `frontend/src/components/attendance/FaceEnrollmentModal.tsx`; registration persistence in `backend/src/controllers/auth.controller.ts`; enrollment API in `backend/src/controllers/attendance.controller.ts` and `backend/src/routes/attendance.routes.ts`.
- **Missing / limitation:** Both browser flows capture a single frame and submit a client-generated descriptor. There is no capture-session provenance, multi-frame aggregation, server-side face detection, or server-verified descriptor. Quality checks are limited to client detector score/face size and a backend range check on the submitted score; the score itself is client controlled. Enrollment UI replacement flow passes `replaceExisting: true`, so future changes should add explicit re-enrollment authorization/confirmation safeguards.
- **Files likely to change:** `RegisterModal.tsx`, `FaceEnrollmentModal.tsx`, `auth.controller.ts`, `attendance.controller.ts`, authentication context/API helper as needed, and new server-side inference-service client/controller modules.
- **API changes:** Accept bounded image/frame uploads or a server-created capture session; stop treating submitted descriptors or quality scores as evidence. Return an enrollment ID/status and safe user-facing result, never a raw embedding.
- **Database changes:** Current encrypted string field can technically hold a server-generated envelope, but a capture record/model revision may require schema changes. No migration is proposed here.
- **Security risks:** Browser descriptors and client claims can be forged; image payloads may leak via logs/temp storage; replacement can overwrite an enrolled template; consent is an asserted checkbox and not evidence of informed/guardian consent.
- **Tests required:** Upload size/type validation, multiple-frame quality rejection/acceptance, no-face/multiple-face cases, server-produced descriptor only, replacement authorization, subject binding, encryption, audit events, synthetic fixture exclusion.

### 2. Multi-frame registration and image quality validation

- **Existing implementation:** One frame per enrollment. The browser checks exactly one detected face, detector score threshold, minimum bounding-box proportion, basic frame dimensions, finite 128 values, and nonzero vector.
- **Missing / limitation:** No multi-frame capture or stable-template aggregation. No server-calculated blur, exposure, pose, occlusion, face size, or cross-frame consistency checks. The application has not validated these thresholds on NCC camera conditions.
- **Files likely to change:** `RegisterModal.tsx`, `FaceEnrollmentModal.tsx`, new inference service; `auth.controller.ts` and enrollment controller for server-side enforcement.
- **API changes:** Capture-session start/submit/finalize or bounded batch upload, with server-issued IDs and server-returned validation codes.
- **Database changes:** Optional capture-attempt metadata may require a new table; do not store raw frames by default.
- **Security risks:** More captured frames increase biometric exposure and potential retention; frontend-only quality gate is bypassable.
- **Tests required:** Image constraints, frame-count limits, stale/replayed capture session, poor lighting/blur/pose, no/multiple faces, duplicate enrollment, cleanup of temporary buffers.

### 3. Secure server-side image processing

- **Existing implementation:** AES-256-GCM encryption and key rotation identifiers exist in `backend/src/services/biometricCrypto.service.ts`; current payload encryption uses cadet ID as authenticated associated data. The payload explicitly labels browser captures `CLIENT_UNATTESTED`.
- **Missing / limitation:** No server-side image inference service. Browser sends descriptors. No operational key-management system is evidenced by code inspection; secrets are environment-configured. No logged proof that raw images are kept only in memory or erased from temporary storage.
- **Files likely to change:** New private inference service/client; `backend/src/controllers/auth.controller.ts`, `attendance.controller.ts`, `server.ts` or service configuration; deployment configuration only after separate approval.
- **API changes:** Express-authenticated image/frame endpoint, strict request limits, service-to-service authentication, versioned inference response. API must not return embeddings/templates.
- **Database changes:** Existing encrypted field can store a new versioned envelope, but descriptor model/version currently appears in encrypted payload rather than indexed schema columns. Additional operational metadata may warrant an approved migration.
- **Security risks:** Service exposure on a public interface, image leakage, malicious image/decompression payload, key compromise, timing/log side channels, unsafe broad roster comparisons.
- **Tests required:** Service inaccessible externally, authentication/authorization before forwarding, size/type limits, no image/template in logs or response, key missing/invalid behavior, tamper rejection, model mismatch, failure isolation.

### 4. One-to-one face verification

- **Existing implementation:** `verifyFaceAttendance` validates a 128-value descriptor and compares against templates for the eligible muster. It decrypts and checks model/format/capture status. Current production-compatible check rejects `CLIENT_UNATTESTED`; the default-disabled flag rejects the flow before matching. Matching code therefore exists but does not constitute an enabled, trusted verification path.
- **Missing / limitation:** The current matching design is scoped 1:N against the eligible session roster, not explicit 1:1 against a claimed cadet. The submitted descriptor is browser generated. The current threshold is a compatibility constant and has not been calibrated for selected weights or NCC participants.
- **Files likely to change:** `FaceAttendanceModal.tsx`, `attendance.controller.ts`, biometric utilities/services, and potentially template metadata model.
- **API changes:** Provide asserted cadet/session identifiers or controlled roster selection; server verifies one claimed identity only, applies model/format/version compatibility, returns generic verification result, and never exposes templates.
- **Database changes:** Store server model ID/version, preprocessing version, descriptor format, key ID, and enrollment status in a schema-supported versioned envelope or approved columns/table.
- **Security risks:** False acceptance/rejection, cross-person/template confusion, enrollment takeover, model-version mismatch, threshold leakage, out-of-scope identity disclosure.
- **Tests required:** Authenticated 1:1 matching, wrong-person rejection, out-of-scope ID indistinguishable response, incompatible version rejection, encrypted template isolation, calibrated FAR/FRR/ROC on consented representative data.

### 5. Liveness / presentation-attack detection

- **Existing implementation:** A time-limited single-use server challenge is present. Code comments correctly state that the nonce is not liveness proof. There is no selected PAD model/service, and biometric verification is disabled.
- **Missing / limitation:** No hardware-backed capture attestation, passive PAD, validated active PAD protocol, or measured attack-resistance evidence. No candidate model was cleared in Phase 2.2.
- **Files likely to change:** Future camera UI in `FaceAttendanceModal.tsx`, private inference service, `attendance.controller.ts`, tests and configuration. Depends on a separately cleared model and evaluation.
- **API changes:** Server-controlled frame sequence/nonce tied to an active session, operator, and claimed cadet; return PAD evaluation status. A nonce must never be labeled liveness confirmation by itself.
- **Database changes:** Optional versioned PAD decision/audit evidence may require schema design; do not store raw frame/biometric imagery by default.
- **Security risks:** Print/screen/video/mask attacks, replay, generated media, camera bypass, demographic/device bias, false accept leading to incorrect attendance.
- **Tests required:** Independent protocol against print, screen replay, recorded video, masks, low light, camera variations, and spoof attack datasets/consented local trials; report APCER/BPCER or appropriate operational metrics with confidence intervals.

### 6. Session-based attendance authorization

- **Existing implementation:** Authenticated roles are checked in attendance routes/controllers. `getAuthorizedCadetIds`, `getEligibleCadetsForMuster`, and `drillInstructorMayAccessTarget` scope officers and session access. Session status, date, leave, roster eligibility, and operator are checked in biometric/manual controllers. The verification challenge is user/session bound and single use, but in-memory.
- **Missing / limitation:** The challenge is process-memory state and may not survive multiple backend instances/restarts. Duplicate attendance-session creation has no database uniqueness rule visible in `TrainingSession`; roster/session duplicate policy needs explicit definition. All authorization checks must be repeated at final record write, not trusted from UI preload.
- **Files likely to change:** `attendance.controller.ts`, `attendance.routes.ts`, `attendanceScope.ts`, possibly session/assignment middleware and session UI.
- **API changes:** Use durable, single-use, short-expiry challenge storage if multi-instance/restart safety is required; bind to session, operator, and identity claim; make status and scope errors non-enumerating.
- **Database changes:** Challenge persistence/unique session policy may require schema migration; none is proposed or applied.
- **Security risks:** Stale/reused challenge, role/scope changes between issuance and use, race conditions, duplicated session records, access through stale preloaded roster.
- **Tests required:** Role matrix, wrong-session/operator challenge, expiry/replay, closed session, role revocation, platoon reassignment, leave/eligibility changes, concurrent create/verify requests.

### 7. Duplicate attendance prevention

- **Existing implementation:** `TrainingAttendance` has `@@unique([sessionId, cadetId])`. Both manual and biometric record paths use Prisma upsert/transactions; session stats are re-counted from database records.
- **Missing / limitation:** Upsert prevents duplicate rows but intentionally permits status updates. Product policy must decide whether duplicate face scans are idempotent, rejected, or recorded as separate attempts. A unique attendance-session constraint is not present.
- **Files likely to change:** `attendance.controller.ts`, `FaceAttendanceModal.tsx`, and tests; schema only if a session-level uniqueness rule is approved.
- **API changes:** Return idempotent “already marked” or update semantics explicitly; separate verification-attempt audit from attendance row.
- **Database changes:** Existing unique attendance key is adequate for one row per cadet/session; optional attempt/audit entity or session de-duplication constraint requires review.
- **Security risks:** A repeated scan could overwrite manual correction/status without careful policy; concurrent writes must keep counts correct.
- **Tests required:** Repeat identical marking, present→absent update permission, concurrent duplicate marks, closed session mutation rejection, counts remain accurate.

### 8. Consent, revocation, and biometric deletion

- **Existing implementation:** UI asks for a consent checkbox. Encrypted payload records purpose, policy version, timestamp, subject ID, recorder ID and role. Audit logs record consent given/replaced/revoked. `DELETE /api/attendance/biometrics/:cadetId` allows cadets to revoke their own consent and scoped officers to act within authorized scope, then deletes the template.
- **Missing / limitation:** No dedicated consent record/model, signed policy artifact, guardian consent flow, consent expiry, or separate revocation state. The template deletion removes the active encrypted record; audit history is not a structured consent lifecycle entity. There is no explicit user-facing deletion request/status workflow reviewed here. `User` deletion cascades to biometric template, but retention/audit implications need policy.
- **Files likely to change:** `FaceEnrollmentModal.tsx`, `RegisterModal.tsx`, `attendance.routes.ts`, `attendance.controller.ts`, `biometricCrypto.service.ts`, profile/privacy screens, audit service.
- **API changes:** Consent grant/review/revoke endpoints with purpose and policy version; deletion endpoint returning auditable status; role/subject validation and idempotency. Avoid exposing biometric data.
- **Database changes:** A durable consent/revocation entity is likely required for independent grant/revoke history, guardian/subject relationships, policy snapshot, and deletion status. Requires a presented migration plan and separate approval before execution.
- **Security risks:** Checkbox is not proof of informed consent; absent guardian process where required; privileged staff may enroll on another person’s behalf; delete audit may remain after template removal; backups/logs may retain data.
- **Tests required:** Cadet self-revoke, officer scope, unauthorized actor, revoked consent blocks all use, deletion and re-enrollment lifecycle, guardian/age policy, audit immutability, backup/retention behavior.

### 9. Manual attendance fallback

- **Existing implementation:** Manual UI in `FaceAttendanceModal.tsx` and role attendance views in `RoleShellView.tsx`. `PATCH /api/attendance/sessions/:sessionId/mark` uses authentication, role and cadet-scope checks, session state, approved status, upsert, audit/notification paths. Biometric endpoints are disabled by default and direct operators to manual attendance.
- **Missing / limitation:** Ensure every future biometric UI error/timeout offers the existing manual path without hiding it. Verify policy distinguishes manual override and approved-leave records in all summaries. Keep manual route independent of biometric configuration.
- **Files likely to change:** Minimal/no changes expected; future integration touches `FaceAttendanceModal.tsx` and should preserve manual UI. Relevant backend route/controller and summary views should be regression-tested.
- **API changes:** No new API is necessary for fallback; preserve the existing manual PATCH route and status semantics.
- **Database changes:** None required for ordinary manual marking; current unique session/cadet attendance record is present.
- **Security risks:** Manual overrides require strong role checks, reason/audit records, and visible verification method; biometric failure must not trigger automatic marking.
- **Tests required:** Authorized and unauthorized manual marking, closed session, out-of-scope cadet, override audit, fallback after disabled/model/service failure, historical data remains intact.

### 10. Audit and monitoring

- **Existing implementation:** Audit log writes cover consent given, template replaced, consent revoked; attendance records store `verificationMethod`, `verificationStatus`, `confidenceScore`, and `verifiedBy`. Authentication, scope checks, and notification ledger exist.
- **Missing / limitation:** No demonstrated biometric inference service health metrics, PAD/recognition error monitoring, key-rotation audit, model artifact hash registry, rate-limited attempt telemetry, or privacy-safe operational dashboard. Avoid logging descriptors/images/OTP-like secrets.
- **Files likely to change:** Audit service/model if needed, `attendance.controller.ts`, new inference service, security monitoring/configuration, tests.
- **API changes:** No public audit API should reveal biometric material; authorized administrators may need aggregate health/audit summaries only.
- **Database changes:** Additional immutable model-artifact and biometric-attempt audit records may need schema additions after data-minimization review.
- **Security risks:** Logs can leak biometrics; excessive attempt detail can enable threshold attacks; audit access itself may expose cadet information.
- **Tests required:** No PII/descriptor/image in logs, authorized audit access, immutable event chain or equivalent controls, alerting on repeated failures, key rotation and model change audit.

## Readiness by phase

| Phase | Readiness gate | Current state |
|---|---|---|
| 3 — Consent and lifecycle requirements | Define subject/guardian, purpose, notice, retention, revocation, deletion, and audit policy | **Not ready** — UI consent and audit events exist, but lifecycle is not a complete consent system. |
| 4 — Server-side processing contract | Select a cleared model later; define authenticated private inference boundary and payload limits | **Not ready** — no server inference service; do not choose a model in this report. |
| 5 — Enrollment and template storage | Multi-frame server validation, model/version metadata, secure enrollment and re-enrollment | **Partially implemented** — encrypted metadata envelope exists, but current browser-derived enrollment is untrusted and single-frame. |
| 6 — Session verification and PAD | One-to-one flow, session-bound challenge, approved PAD, error thresholds and failure path | **Not ready** — current flow is disabled; no PAD candidate cleared. |
| 7 — Controlled validation and rollout decision | Security, subgroup, usability, manual fallback, audit, and operational evaluation | **Not started for biometric production** — manual attendance remains available. |

## Required constraints for any future implementation

- Do not enable `ENABLE_BIOMETRIC_ATTENDANCE` until model, PAD, privacy, security, and reliability gates are approved.
- Keep the React + Express + PostgreSQL + Prisma architecture; if later approved, isolate inference behind a private local service called only by Express.
- Never treat a browser-supplied descriptor, quality score, consent flag, or liveness flag as trusted evidence.
- Keep manual attendance and its permissions available at all times.
- Obtain approval for any schema migration before running it.
- Use only consented synthetic test fixtures in automated tests; never use synthetic descriptors as real identities.

