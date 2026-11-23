# AIT NCC — BSR-03 Consent Architecture Review

**Review type:** Read-only design and source review  
**Recommendation:** **APPROVE WITH CHANGES**  
**Scope:** `BIOMETRIC_CONSENT_SCHEMA_PROPOSAL.md`, current Prisma relationships, enrollment/revocation/verification handlers, authentication, and manual attendance.  
**Runtime/database status:** No database was accessed; no tests, migrations, or application changes were performed. Automatic biometric attendance was not enabled.

## Executive assessment

The proposal has the right core direction: make enrollment optional, bind consent to a cadet and purpose, preserve revocation history, require fresh consent, and keep manual attendance available. It is not ready to approve as a schema/API contract. Its current `BiometricConsent` row is mutable, the authorization row does not enforce that its cadet matches its consent or replacement template, guardian evidence is underspecified, and it does not define a database-enforced single current grant or atomic one-time authorization consumption. Several migration and deletion statements also need qualification against the existing schema and crypto design.

The most urgent application gap is already present in source: `enrollBiometricTemplate` accepts `biometricConsent: true` from an authorized staff caller and can replace a template with `replaceExisting: true`; revocation deletes the template and writes an `AuditLog` entry, but enrollment does not consult that history. Verification loads templates by eligible cadet IDs and checks encryption/model compatibility, but there is no consent relation to check. Thus the proposal's desired behavior is not provided by the current implementation. The feature is disabled by default, which limits current biometric attendance exposure, but does not make the consent lifecycle correct.

## Review against the ten questions

| Question | Assessment | Evidence / required change |
|---|---|---|
| 1. Permanently associated with the correct cadet | **Partial** | `subjectCadetId` references `User`, but `BiometricEnrollmentAuthorization` separately stores `consentId` and `subjectCadetId` without a composite relation proving they belong together. Its `replacesTemplateId` is a bare string with no FK or same-cadet constraint. Require composite FKs/constraints and server-side equality checks. |
| 2. Grant and revocation history preserved | **Insufficiently enforced** | Proposal says never reset a revoked row, but models `status`, `revokedAt`, and revoker as mutable columns and has no immutable event table or database enforcement. The current implementation stores revocation in a general `AuditLog`; it deletes the template, and ordinary enrollment logs `BIOMETRIC_CONSENT_GIVEN` with the staff actor, not proof of a subject grant. Add append-only lifecycle events and restrict update/delete at the database/service boundary. |
| 3. Revoked consent blocks enrollment and verification | **Not guaranteed** | Proposal states this as application behavior but does not make the active-grant lookup/query design or transaction boundary normative. Current enroll does not read revocation records. Current verification only queries templates for eligible cadets and decrypts compatible payloads. Require active-grant checks in enrollment and verification, failing closed for null/missing/mismatched consent links. |
| 4. Fresh subject consent before re-enrollment | **Insufficiently enforced** | A new grant row is described, but staff authorization is only linked to `consentId` by a non-composite relation, and `replaceExisting` remains an unsafe bypass unless removed. Require a new grant ID created by the subject/approved guardian after the prior revocation, a separate one-time `RE_ENROLLMENT` authorization, and atomic checks at template write. |
| 5. Staff cannot grant/restore consent | **Intent is correct; enforcement is missing** | The proposed grant API says subject self-consent, but the grant row's `providedByUserId` comment also allows a staff recorder, and the model has no field separating the consent provider from the staff witness/capture actor. Guardian data is not tied to an authenticated/verified provider. Use distinct `providerType`, subject/guardian identity evidence, `recordedByUserId`, and explicit authorization; enforce that staff cannot create a subject grant. |
| 6. Guardian consent where policy requires | **Partial** | `guardianName`, `guardianRelationship`, and `guardianEvidenceRef` can hold a minimal reference, but no verification method/time, verified-by actor, policy eligibility determination, guardian identity reference, or cadet assent is represented. Add a separate, minimized guardian-evidence structure or fields with policy-defined semantics. Do not make guardian consent automatically available until institutional policy defines when it is valid. |
| 7. Policy version and purpose | **Present, needs tightening** | Grant rows contain `purpose` and `policyVersion`; current encrypted template payload also stores purpose, policy version, and a consent timestamp. The current constant is `ATTENDANCE_IDENTIFICATION`, while the proposal suggests `OPTIONAL_ENROLLMENT` / `ATTENDANCE_VERIFICATION`, and revocation logs `ATTENDANCE_IDENTIFICATION`. Define one approved purpose taxonomy and exact semantic relationship between enrollment and attendance processing. Capture immutable policy-text/version hash, not an arbitrary client-supplied version. |
| 8. Duplicate, concurrent, replayed consent submissions | **Missing** | No idempotency key or unique current grant constraint is specified. Two grant requests can create concurrent active rows. Authorization `consumedAt` is not protected by a specified compare-and-set/conditional update and transaction ordering. Add idempotency keys, a single-current-grant invariant, and atomic consume semantics; test races across instances. |
| 9. Withdrawal leaves login, registration, manual attendance unaffected | **Good design goal; no direct proof** | The registration and login controller paths do not consult biometric consent. Manual `markAttendance` checks role, session, cadet eligibility/scope, and leave; it does not check consent. Keep that separation explicit. Add regression tests that revoke consent then prove those paths still work. Existing biometric tests cover manual attendance separately, but do not establish behavior after revocation. |
| 10. Deletion and backup retention accurately represented | **Partially accurate; needs operational detail** | Current revocation deletes `BiometricTemplate` in a transaction and logs the action; the schema relates template to user with `onDelete: Cascade`. The crypto service uses an application keyring, not per-cadet keys, so destroying a key cannot selectively erase one cadet's template. Backups may retain deleted ciphertext until expiry. `onDelete: Restrict` for consent would block hard deletion of the referenced `User`; the proposal needs an account-erasure/tombstone plan and restore-time deletion propagation. |

## Detailed schema and integrity findings

### Missing Prisma relationships and invariants

1. The proposed named `User` relations require corresponding back-relation fields on `User`; none are shown. `BiometricConsent` needs relation arrays for subject, provider, and revoker. `BiometricEnrollmentAuthorization` needs relation arrays for subject and authorizer. Without these, the shown Prisma model is incomplete and will not validate as written.
2. `BiometricEnrollmentAuthorization.consentId` and `subjectCadetId` are independent FKs. A row can point to Cadet A and Cadet B's consent. Add a composite unique key on the grant `(id, subjectCadetId, purpose)` and a composite FK from authorization `(consentId, subjectCadetId, purpose)` to it, or enforce equivalent constraints in SQL plus controller checks.
3. `replacesTemplateId` is not a relation. It can name a nonexistent template or another cadet's template. Add a composite FK tying template ID and cadet ID, or remove the field and store a verified replacement relationship in an audited record.
4. `purpose` on enrollment authorization is a free-form `String`; typo variants and unsupported purposes are possible. Use a narrow enum with a separately approved purpose list, or a constrained lookup table.
5. The proposal calls for unique active grants but provides only ordinary indexes. PostgreSQL uniqueness over nullable `revokedAt` is not achieved by a regular Prisma compound unique that includes a nullable field. Specify a partial unique index or a dedicated current-consent pointer table and transactional locking.
6. `BiometricConsentStatus` duplicates status derivable from revocation events and can drift from `revokedAt`. If status remains, define check constraints and transactionally update it with immutable events. Prefer deriving current state from an append-only lifecycle plus a current pointer.
7. The `@@index([status, purpose])` index is low-selectivity and does not serve the subject/purpose active lookup as directly as a composite subject-purpose-current index. Index design should follow the actual queries and FK columns.

### Authorization and application behavior

- Current route `/api/attendance/biometrics/enroll` is authenticated and role-limited to `ADMIN_ANO`, `PLATOON_SENIOR`, and `SENIOR`. The controller checks cadet is approved/active and in staff scope. It accepts descriptor, quality score, `biometricConsent === true`, and `replaceExisting`; it creates or updates the template. The boolean is not a subject-bound grant.
- Current `DELETE /api/attendance/biometrics/:cadetId` permits a cadet to revoke only their own row and permits scoped officers to revoke in their authorized set. It deletes the template and writes `BIOMETRIC_CONSENT_REVOKED`; it does not create durable consent state that enrollment checks.
- Current verification requires an authenticated authorized operator, a session-bound single-use challenge, eligible cadets, and compatible encrypted templates; the attendance flag is checked before the matching flow. No consent row can currently be queried because none exists.
- The proposal's compatibility wrapper for `DELETE .../:cadetId` is ambiguous once there are multiple purposes and grants. Prefer revoking a specific grant ID. A temporary cadet-self wrapper may revoke all active biometric purposes only if explicitly specified and audited; staff should use a purpose-specific grant ID and a narrowly authorized reason.
- Authorization consumption must happen in the same transaction as template creation/replacement, with an atomic conditional update (`consumedAt IS NULL`, `expiresAt > now`) and recheck of active consent and staff scope. A pre-read followed by a later write is raceable.
- Staff-generated consent event evidence must not be represented as the cadet's act. Distinguish the person who granted consent from the staff member who witnessed/recorded it.

### Privacy and retention

- Do not store guardian identity documents in the consent tables. Define a minimal evidence reference, verification method, verification outcome, verifier, and timestamp; keep any underlying document in an approved restricted system with its own retention.
- Specify how a cadet's account deletion is performed when a consent row uses `onDelete: Restrict`. Options include retaining a non-identifying subject tombstone with a random subject key, or a reviewed anonymization workflow. Do not silently cascade away consent history or block legally required deletion without a policy decision.
- Deleting the current database row does not erase copies in backups. Define backup expiry, restore controls (reapply deletion/revocation tombstones before exposing restored data), and incident/key-management procedures.
- Current AES-256-GCM keys are application-level keyring entries. There is no per-cadet DEK shown, so per-subject cryptographic erasure is not available. The proposal must not imply otherwise; deleting the encrypted row plus backup lifecycle is the presently evidenced mechanism.
- Retention duration and audit access must be approved. `AuditLog` is a general table, not an append-only integrity guarantee in the Prisma model. If consent history is legally/audit critical, use append-only permissions and/or tamper-evident controls.

## Migration and rollback review

The additive-first approach is sensible, but the ordering needs to be executable and must avoid a compatibility gap:

1. Do not deploy application code that references new Prisma fields before the additive migration is applied, and do not run the migration against any unapproved database. The database name and target must be independently verified when a later migration is approved.
2. Keep the attendance flag off throughout. Add schema tables/FKs/indexes first in a reviewed local migration. Then deploy fail-closed code that requires a current consent and authorization. Because old code does not check consent, do not run an old application build with the flag enabled after migration.
3. Existing templates must be explicitly treated as lacking verified consent. A nullable `consentId` is acceptable as a staging field only if enrollment and verification reject null before any descriptor decryption/comparison. Never backfill an inferred consent.
4. Inventory must use metadata only and avoid exposing raw descriptors; define whether existing templates are quarantined, deleted, or require fresh consent/re-enrollment. The current encrypted metadata may carry a subject ID/policy timestamp but is not equivalent to a subject action.
5. Rollback should be application-first only if the prior code cannot accidentally reactivate legacy templates. Database rollback must not drop consent history. A forward-compatible schema is safer than destructive rollback; document exact version compatibility and restore steps.
6. A unique active grant may require a partial SQL index not expressible in Prisma schema. Include that SQL in the migration review and ensure `prisma migrate diff/deploy` compatibility is tested in a disposable isolated database only after approval.

## Required tests not covered by the proposal's current test outline

The proposal lists broad categories but should make these concrete:

1. Subject A cannot read, grant, revoke, enroll against, or authorize using Subject B's consent ID.
2. A staff boolean or staff-created grant request cannot represent subject consent; forged provider type, actor ID, guardian status, policy version, or consent timestamp is rejected/ignored server-side.
3. A revoked, superseded, stale-policy, null-linked, or mismatched-consent template is rejected before decryption and matching.
4. Re-consent after revocation creates a different immutable grant ID; old revoked consent never becomes active again.
5. Concurrent duplicate grant submissions yield one current grant; duplicate idempotency key returns the original result and does not create another row.
6. Concurrent revoke and enroll: only a serializable outcome is possible; once revocation commits, no later enrollment or verification uses that grant.
7. Enrollment authorization is single use under concurrent requests, expires, is bound to cadet/purpose/staff scope, and cannot be replayed or cross-linked to another cadet/template.
8. Guardian cases: approved policy required, provider identity and relationship verification are recorded, unauthorized guardian and staff actors fail, and cadet assent/objection follows policy.
9. Consent withdrawal leaves login, registration, application approval, manual attendance marking, attendance history, and notifications available according to their ordinary role/status rules.
10. Account deletion, anonymization, backup restore, key rotation, and retention jobs preserve the intended consent audit while preventing restored templates from becoming usable.
11. API responses never expose descriptors, encryption envelopes, raw guardian evidence, or unnecessary identifiers; error paths avoid account enumeration.
12. Transaction failure at each write step rolls back grant/revoke event, current pointer, authorization consumption, template mutation, and audit/outbox together.

## Revised design deliverable

Recommended changes are in [BIOMETRIC_CONSENT_SCHEMA_REVISED_PROPOSAL.md](BIOMETRIC_CONSENT_SCHEMA_REVISED_PROPOSAL.md). It uses immutable grant/event history, a unique current-consent pointer, composite subject-purpose relationships, explicit guardian verification metadata, and atomic one-time enrollment authorization semantics.

## Final recommendation

**APPROVE WITH CHANGES.** Approve the privacy principles and direction, but do not approve the current schema/API proposal for implementation. Revise it to enforce immutable history, one current grant per cadet and purpose, composite subject binding, verified guardian evidence where policy requires it, replay-safe idempotency/authorization consumption, and an explicit deletion/backup model. Keep automatic biometric attendance disabled. No source/schema/database change was made in this review.
