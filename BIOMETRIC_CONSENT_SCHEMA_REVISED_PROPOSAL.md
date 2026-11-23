# BSR-03 — Revised Biometric Consent Schema/API Proposal

**Status:** Design only. Not validated with Prisma CLI; not applied to `schema.prisma`; no migration or database access was performed.  
**Required gates:** Institutional privacy/legal policy approval and separate explicit approval of the schema/migration before implementation. Keep `ENABLE_BIOMETRIC_ATTENDANCE` disabled.

## Design principles

1. Consent is a cadet-subject-bound act for one approved purpose and policy version. Enrollment by staff is not a grant of consent.
2. Grant rows and lifecycle events are append-only. Revocation does not turn an old grant back into a grant; renewed consent creates a new grant ID.
3. A current-consent pointer enforces at most one current grant for each cadet and purpose. The pointer and event history are updated atomically.
4. Enrollment and verification check current consent and template linkage server-side. Missing, stale, revoked, mismatched, or legacy-unlinked templates fail closed before descriptor decryption/comparison.
5. Enrollment authorization is separate, time-limited, scoped, and single-use. Re-enrollment requires a distinct authorization and a fresh consent grant after the preceding grant ended.
6. Consent does not gate registration, authentication, ordinary portal use, approval workflow, or manual attendance.
7. Do not implement a guardian path until institutional policy defines applicability, verification, cadet assent, retention, and appeal/withdrawal rules.

## Proposed Prisma model shape

This is a design sketch, not a drop-in validated schema. Existing `User` needs the named back-relations listed below. PostgreSQL check constraints and a few composite/partial constraints may require explicit SQL in a reviewed migration.

```prisma
enum BiometricConsentPurpose {
  OPTIONAL_ENROLLMENT
  ATTENDANCE_VERIFICATION
}

enum BiometricConsentProviderType {
  SUBJECT
  GUARDIAN
}

enum BiometricConsentEventType {
  REVOKED
  SUPERSEDED
}

enum BiometricConsentActorType {
  SUBJECT
  GUARDIAN
  STAFF
  SYSTEM
}

enum BiometricEnrollmentAuthorizationType {
  INITIAL_ENROLLMENT
  RE_ENROLLMENT
}

model BiometricConsentGrant {
  id                    String   @id @default(uuid())
  subjectCadetId        String
  purpose               BiometricConsentPurpose
  policyVersion         String
  policyDocumentSha256  String
  providerType          BiometricConsentProviderType
  providerUserId        String?  // must equal subjectCadetId for SUBJECT; null for external GUARDIAN
  guardianRelationship  String?  // populated only when approved policy requires it
  guardianEvidenceRef   String?  // opaque pointer; never store identity documents here
  guardianVerifiedAt    DateTime?
  guardianVerifiedById  String?
  subjectAssentedAt     DateTime?
  consentedAt           DateTime
  recordedByUserId      String?  // staff recorder/witness; distinct from the consent provider
  idempotencyKey        String
  createdAt             DateTime @default(now())

  subject       User @relation("ConsentGrantSubject", fields: [subjectCadetId], references: [id], onDelete: Restrict)
  providerUser  User? @relation("ConsentGrantProvider", fields: [providerUserId], references: [id], onDelete: Restrict)
  recordedBy    User? @relation("ConsentGrantRecorder", fields: [recordedByUserId], references: [id], onDelete: SetNull)
  guardianVerifier User? @relation("ConsentGuardianVerifier", fields: [guardianVerifiedById], references: [id], onDelete: SetNull)
  events        BiometricConsentEvent[]
  currentFor   BiometricConsentCurrent?
  authorizations BiometricEnrollmentAuthorization[]
  templates     BiometricTemplate[]

  @@unique([id, subjectCadetId, purpose])
  @@unique([subjectCadetId, idempotencyKey])
  @@index([subjectCadetId, purpose, consentedAt])
}

model BiometricConsentEvent {
  id               String   @id @default(uuid())
  consentGrantId   String
  subjectCadetId   String
  purpose          BiometricConsentPurpose
  eventType        BiometricConsentEventType
  actorType        BiometricConsentActorType
  actorUserId      String?
  occurredAt       DateTime @default(now())
  reasonCode       String?
  requestId        String   @unique

  grant BiometricConsentGrant @relation(fields: [consentGrantId, subjectCadetId, purpose], references: [id, subjectCadetId, purpose], onDelete: Restrict)
  actor User? @relation("ConsentEventActor", fields: [actorUserId], references: [id], onDelete: SetNull)

  // A grant may have at most one terminal lifecycle event (revoked or superseded).
  @@unique([consentGrantId])
  @@index([subjectCadetId, purpose, occurredAt])
}

model BiometricConsentCurrent {
  subjectCadetId String
  purpose        BiometricConsentPurpose
  consentGrantId String @unique
  createdAt      DateTime @default(now())

  grant BiometricConsentGrant @relation(fields: [consentGrantId, subjectCadetId, purpose], references: [id, subjectCadetId, purpose], onDelete: Restrict)

  @@id([subjectCadetId, purpose])
}

model BiometricEnrollmentAuthorization {
  id              String   @id @default(uuid())
  consentGrantId  String
  subjectCadetId  String
  purpose         BiometricConsentPurpose
  authorizationType BiometricEnrollmentAuthorizationType
  authorizedById  String
  authorizedAt    DateTime @default(now())
  expiresAt       DateTime
  consumedAt      DateTime?
  consumedById    String?
  idempotencyKey  String

  grant       BiometricConsentGrant @relation(fields: [consentGrantId, subjectCadetId, purpose], references: [id, subjectCadetId, purpose], onDelete: Restrict)
  subject     User @relation("EnrollmentAuthorizationSubject", fields: [subjectCadetId], references: [id], onDelete: Restrict)
  authorizedBy User @relation("EnrollmentAuthorizationIssuer", fields: [authorizedById], references: [id], onDelete: Restrict)
  consumedBy  User? @relation("EnrollmentAuthorizationConsumer", fields: [consumedById], references: [id], onDelete: SetNull)

  @@unique([authorizedById, idempotencyKey])
  @@index([subjectCadetId, purpose, expiresAt, consumedAt])
}
```

Add these relation arrays to `User` with the relation names above: consent grants as subject/provider/recorder/guardian verifier, consent events as actor, enrollment authorizations as subject/issuer/consumer. Keep the arrays distinct; do not reuse an unnamed relation between the same two models.

### Additive template linkage

Add nullable `consentGrantId` and `consentPurpose` to the existing `BiometricTemplate` during the additive migration, plus a relation to `BiometricConsentGrant`. Use a composite FK on `(consentGrantId, cadetId, consentPurpose)` to `(id, subjectCadetId, purpose)` so a template cannot point at another cadet's grant or a grant for another purpose. Prisma may need a manual SQL constraint for this mixed nullable/required tuple; validate the exact generated migration before approval.

Keep the existing `cadetId @unique` for the current one-template-per-cadet behavior. Do not add a replacement-template string field: the controller can determine initial vs replacement from the existing template inside a locked transaction and record the authorization type. Any future multi-template design needs a separate reviewed data model.

After every legacy template has been deliberately handled, consider making the linkage required. Until then, **all code paths must reject null linkage**; do not treat an existing encrypted payload's embedded consent metadata as a substitute for a consent grant row.

## State and integrity rules

### Grant

- Subject self-consent creates a new immutable `BiometricConsentGrant` with `providerType=SUBJECT`, `providerUserId=subjectCadetId`, current server-selected purpose/policy version/hash, and server timestamp.
- A guardian grant is accepted only after policy approval and verified evidence. The guardian is the provider; `recordedByUserId` identifies any staff witness. Guardian name or ID documents are not stored by default; `guardianEvidenceRef`, relationship, verification method/result, timestamp, and verifier are the minimum suggested evidence fields. If policy requires more, use a separately access-controlled record and retention period.
- Provider IDs, purpose, version, hash, and timestamps are set/validated by the server, not trusted from arbitrary client body fields.
- Grant transaction takes a subject-purpose lock (or uses serializable isolation plus retry) and inserts the new grant and `BiometricConsentCurrent` pointer atomically. Existing current grant returns idempotently for the same idempotency key; otherwise a duplicate active grant is rejected or explicitly superseded with an immutable event before pointer replacement.

### Revoke / supersede

- Revocation inserts one immutable `BiometricConsentEvent` (`REVOKED`) and deletes the matching `BiometricConsentCurrent` pointer in one transaction. A unique event per grant prevents double termination; repeated request with the same idempotency key returns the prior outcome.
- If a policy version must be renewed before a prior grant was revoked, close the old grant with `SUPERSEDED`, then create and point to a new grant in one serialized transaction.
- Revocation also disables/deletes the linked template and audits that action in the same transaction or through a transactional outbox. If revocation audit cannot persist, revocation must fail closed rather than claim success while the template remains usable.
- No status field is stored on the immutable grant. Active status is whether the exact grant is the current pointer and has no terminal event. This avoids a mutable status flag drifting away from event history.

### Database constraints

1. Composite FKs bind grant, event, current pointer, authorization, and template to the same `(subjectCadetId, purpose)`.
2. `BiometricConsentCurrent` primary key `(subjectCadetId,purpose)` enforces one current grant per cadet/purpose.
3. `BiometricConsentEvent` unique `consentGrantId` allows only one terminal event per grant; the API only permits `REVOKED` or `SUPERSEDED` once.
4. Check constraints enforce provider semantics: `SUBJECT` has provider user equal to the subject and no guardian evidence; `GUARDIAN` has verified evidence and an approved relationship, with policy-specific assent rules. Check exact nullable SQL semantics before migration.
5. Enrollment authorizations cannot be replayed: controller consumes by conditional update where `consumedAt IS NULL AND expiresAt > now`, in the same transaction as current-consent/scope recheck and template save. Exactly one concurrent request can consume the authorization.
6. Index actual access patterns: current pointer primary key; grant subject/purpose/time; event subject/purpose/time; authorization subject/purpose/expiry/consumption. Avoid broad low-selectivity status indexes.
7. Add database permissions or triggers to prevent update/delete of grant and event history for the runtime role. Corrections use explicit compensating events, not row edits.

## Proposed API contract

| Operation | Contract | Enforcement |
|---|---|---|
| Grant subject consent | `POST /api/attendance/biometrics/consents` with `purpose`, `policyVersion` confirmation, `idempotencyKey`; no cadet ID supplied for self-consent | Authenticated cadet only; subject derives from auth identity; server validates current published policy and creates immutable grant/current pointer. Guardian path is unavailable until approved. |
| Read own state/history | `GET /api/attendance/biometrics/consents/me` | Cadet self-only; returns purpose, policy version, grant/revocation timestamps and state; no descriptor, envelope, guardian evidence, or other cadets. Narrow scoped staff read only if institution approves and audits it. |
| Revoke own grant | `POST /api/attendance/biometrics/consents/:grantId/revoke` with `idempotencyKey` and optional allowlisted reason code | Cadet can revoke only own grant. Staff-assisted revocation requires explicit approved delegated policy and is not implied by the current officer role. Atomically append event, remove current pointer, disable/delete template. |
| Create enrollment authorization | `POST /api/attendance/biometrics/enrollment-authorizations` with `cadetId`, `consentGrantId`, `authorizationType`, `idempotencyKey` | Approved/active cadet, active matching current grant, authenticated authorized staff in current assignment scope. Re-enrollment requires a new grant created after prior termination and explicit `RE_ENROLLMENT`. Server sets issuer, timestamp, and short expiry. |
| Enroll | Existing `POST /api/attendance/biometrics/enroll` with `cadetId`, `consentGrantId`, `authorizationId`, and later an approved server-side capture reference | Remove/ignore `biometricConsent` and `replaceExisting`. Validate current grant, subject/purpose, authorization, account status, staff scope and model compatibility; consume authorization atomically. Client descriptor trust remains a separate blocker; never label client data server-verified. |
| Verify | Existing session verification endpoint | Before decryption/comparison, require the template consent grant to equal the current grant for the permitted purpose; null, revoked, stale, mismatched, or incompatible records are excluded. Keep biometric attendance feature flag off pending all other gates. |

Do not preserve a cadet-ID `DELETE` compatibility route that silently selects between several grants/purposes. If temporarily needed, accept it only for authenticated self-revocation, revoke a documented exact set of active purposes, return an idempotent result, and write one event per grant. Staff use grant-ID operations.

## Guardian and minor policy boundary

The schema does not decide who may legally consent. Before enabling `GUARDIAN`, institution/legal policy must specify eligibility source, age/competency rules, required guardian relationship, identity verification, whether cadet assent is also required, guardian withdrawal, cadet later objection, and retention. Use an opaque evidence record reference. Do not infer minor status from year/branch or accept a client-provided `isMinor` flag.

## Deletion and backups

- Revocation removes the active template from the primary database and current-consent pointer while preserving grant/event history for an approved period.
- Existing biometric crypto uses application keyring keys; it is not a per-cadet key design. Per-cadet crypto-erasure cannot be claimed. Database deletion does not remove ciphertext in backups.
- Define backup expiry and controlled restore procedure: apply a retained deletion/revocation tombstone set before restored data is available to application services. Record completion of deletion propagation without copying descriptors into the tombstone.
- `onDelete: Restrict` prevents deleting a `User` with consent history and may block existing account-removal workflows. Approve one explicit lifecycle: retain a restricted pseudonymous subject tombstone, or perform approved anonymization while preserving only permitted audit facts. Do not cascade-delete consent history or hold directly identifying information indefinitely by default.
- Document template deletion, capture-image disposal, audit retention, backups, key rotation, and legal holds as separate controls.

## Migration and rollout sequence

1. Obtain institutional privacy/legal decision on purpose, consent language, guardian policy, retention, deletion, and non-biometric alternative.
2. Approve exact schema/API and migration separately. Inventory local database identity before any future database operation; this proposal itself requires none.
3. Add consent grants/events/current pointer/authorization tables and nullable template linkage additively. Add reviewed composite/check constraints and current-pointer key. Do not backfill legacy templates as consented.
4. Apply application code that rejects unlinked templates, checks current consent in both enrollment and verification, and consumes authorization atomically. Ensure no old application build can operate with the biometric flag enabled.
5. Keep automatic biometric attendance disabled. Quarantine existing templates until legitimate fresh consent and approved re-enrollment, or delete them with audit.
6. Validate migrations and race behavior only against an explicitly approved disposable/local test database after approval. Do not run production or protected database operations.
7. After legacy disposition, make template consent link mandatory if the chosen migration supports it. Reconcile app/DB constraints and verify migration drift.
8. Rollback application first only if rollback cannot make legacy templates matchable. Retain consent history/current tombstones; use forward fixes or a reviewed additive rollback. Never drop history tables as rollback cleanup.

## Required tests

- Cadet self-grant; wrong subject, unsupported/stale policy, wrong purpose, forged timestamp/provider/actor, and unauthorized guardian rejected.
- Guardian evidence verification and required subject assent follow approved policy; PII is minimized and access-scoped.
- Concurrent duplicate grants create exactly one current grant; idempotent retry returns same result; concurrent revoke/new grant produces one valid serial order.
- Revocation creates immutable event and removes current pointer/template atomically; repeat revoke is idempotent; former grant never becomes current again.
- Staff boolean cannot grant/restore consent; re-enrollment needs a fresh post-revocation grant and new scoped one-time authorization.
- Concurrent authorization consumption has one winner; expiration, replay, cross-subject, cross-purpose, wrong staff scope, or revoked grant fails closed.
- Verification rejects null/mismatched/revoked/stale-policy consent before decryption/comparison and does not leak out-of-scope identities.
- Consent revocation leaves registration, login, application status, portal access, manual attendance, and history behavior unchanged under normal authorization rules.
- Template deletion, key rotation, backup restore with tombstones, account deletion/anonymization, retention expiry, and transaction rollback are tested without real biometric records.
- Existing biometric hardening/security tests pass; biometric attendance remains disabled.

## Decisions still required

- Approved and separately scoped purposes (do not activate attendance-purpose consent merely because it exists in an enum).
- Guardian/minor/assent policy and permitted evidence.
- Consent and audit retention, account deletion/anonymization, backup restore, and any legal-hold process.
- Whether a current-pointer table and explicit SQL constraints are acceptable for the project migration workflow.
- Separate model-license, provenance, PAD, and technical readiness gates. Consent approval alone never enables biometric attendance.
