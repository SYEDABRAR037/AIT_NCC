# Biometric Consent Lifecycle — Schema and API Proposal

**Status:** Proposal only; no Prisma schema or migration changes have been made.  
**Scope:** BSR-03 consent lifecycle and the boundary needed for optional biometric enrollment.  
**Activation:** `ENABLE_BIOMETRIC_ATTENDANCE` must remain disabled. This proposal does not clear any model or authorize biometric attendance.

## Design goals

- Treat consent as a subject-bound, purpose-specific, versioned act rather than a request-body boolean.
- Preserve every grant and revocation as auditable history.
- Require a new grant after revocation before any new enrollment or re-enrollment.
- Permit staff to assist with enrollment only when an active, matching cadet consent exists and a separately recorded enrollment authorization is valid.
- Keep login, normal portal access, application review, and manual attendance independent of biometric consent state.
- Avoid collecting guardian information unless the institution's approved age/consent policy requires it.

## Proposed Prisma model shape

Names and exact types are draft suggestions for review. The existing `User` model remains the cadet identity and account authority.

```prisma
enum BiometricConsentProviderType {
  SUBJECT
  GUARDIAN
}

enum BiometricConsentStatus {
  GRANTED
  REVOKED
}

enum BiometricConsentPurpose {
  OPTIONAL_ENROLLMENT
  ATTENDANCE_VERIFICATION
}

model BiometricConsent {
  id                    String   @id @default(uuid())
  subjectCadetId        String
  purpose               BiometricConsentPurpose
  policyVersion         String
  status                BiometricConsentStatus @default(GRANTED)
  providerType          BiometricConsentProviderType
  providedByUserId      String?  // subject account for SUBJECT; staff witness/recorder where policy allows
  guardianName          String?  // only when required by approved policy
  guardianRelationship  String?
  guardianEvidenceRef    String?  // opaque reference; do not store identity documents here
  grantedAt             DateTime @default(now())
  revokedAt             DateTime?
  revokedByUserId        String?
  revocationReasonCode   String?
  createdAt             DateTime @default(now())

  subject                User @relation("BiometricConsentSubject", fields: [subjectCadetId], references: [id], onDelete: Restrict)
  providedBy             User? @relation("BiometricConsentProvider", fields: [providedByUserId], references: [id], onDelete: SetNull)
  revokedBy              User? @relation("BiometricConsentRevoker", fields: [revokedByUserId], references: [id], onDelete: SetNull)
  enrollmentAuthorizations BiometricEnrollmentAuthorization[]

  @@index([subjectCadetId, purpose, grantedAt])
  @@index([status, purpose])
}

model BiometricEnrollmentAuthorization {
  id              String   @id @default(uuid())
  consentId       String
  subjectCadetId  String
  authorizedById  String
  authorizedAt    DateTime @default(now())
  expiresAt       DateTime
  consumedAt      DateTime?
  replacesTemplateId String?
  purpose         String   // e.g. INITIAL_ENROLLMENT or RE_ENROLLMENT
  consent         BiometricConsent @relation(fields: [consentId], references: [id], onDelete: Restrict)
  subject         User @relation("BiometricEnrollmentSubject", fields: [subjectCadetId], references: [id], onDelete: Restrict)
  authorizedBy    User @relation("BiometricEnrollmentAuthorizer", fields: [authorizedById], references: [id], onDelete: Restrict)

  @@index([subjectCadetId, expiresAt, consumedAt])
}
```

### Integrity and history notes

1. A consent row represents one grant and its lifecycle. It is never deleted or reset to `GRANTED` after revocation. Re-consent creates a new row with a new policy version and grant timestamp; previous rows remain `REVOKED`.
2. A database check constraint (or equivalent transaction-level validation if Prisma cannot express it) must require `revokedAt` and `revokedByUserId` when status is `REVOKED`, and forbid those values while status is `GRANTED`.
3. A grant must bind to the exact `subjectCadetId`; callers cannot select another subject by supplying an arbitrary consent ID. The active grant is selected server-side for the requested purpose.
4. Before migration implementation, decide whether `BiometricConsentPurpose` should be an enum or an extensible string. Do not imply that attendance processing has approval just because it appears in the enum.
5. The existing `BiometricTemplate` should gain a nullable `consentId` foreign key for staged rollout, then become required only after existing template handling is resolved. No existing template should be silently assigned a fabricated consent record.

## Grant, revoke, and enrollment states

```text
No grant ──subject/approved guardian grants current policy──> GRANTED
GRANTED ──subject or authorized policy actor revokes─────────> REVOKED
REVOKED ──new subject/approved guardian grant, new row───────> GRANTED (new grant ID)
GRANTED + valid unused staff authorization ──enroll─────────> template tied to that grant
```

- Revocation disables biometric use immediately in application logic and deletes or cryptographically erases the active template according to the approved retention policy. The consent event remains for audit.
- A staff `biometricConsent: true` field is never accepted as a grant, renewal, or revocation reversal.
- Enrollment authorization is separate, short-lived, subject-bound, staff-attributed, purpose-bound, and single-use. Re-enrollment after an existing template requires a distinct `RE_ENROLLMENT` authorization; `replaceExisting: true` by itself is insufficient.
- Verification and enrollment require the template's `consentId` to refer to a currently valid consent grant for the applicable purpose. Model compatibility and existing authorization scope checks remain independently required.

## Subject and guardian requirements

- The cadet is the consent subject even when a guardian provides consent.
- Subject consent should be captured through an authenticated cadet action, with policy version and timestamp shown before confirmation.
- Guardian consent is only available if an approved institutional policy and legal review require or permit it. That policy must define age/competency thresholds, acceptable guardian relationship evidence, who verifies it, and what happens when no guardian is available.
- Do not infer age from name, class/year, or an unverified client field. Use an institution-approved source and minimize any retained personal data.
- Prefer recording `providerType`, the relationship, a verification outcome, and an opaque evidence reference rather than storing identity documents or excess guardian contact data in this table.
- Privacy/legal review must decide whether guardian consent supplements or replaces assent by the cadet and how to handle a cadet's later objection.

## Proposed API changes

| Operation | Proposed route and method | Authorization and behavior |
|---|---|---|
| Record grant | `POST /api/attendance/biometrics/consents` | Authenticated subject only for self-consent; validates published policy version, purpose, subject and any guardian-policy requirements. Creates a new grant row; never updates a revoked row. |
| Read own consent state | `GET /api/attendance/biometrics/consents/me` | Cadet can read only their own status and policy history, without template data. Staff access requires a narrow authorized scope and audit event. |
| Revoke | `POST /api/attendance/biometrics/consents/:consentId/revoke` | Subject can revoke own grant. Any staff-assisted action requires an explicit approved delegation and actor reason; cannot revoke another cadet merely by role. Writes revocation metadata and audit atomically, and disables/deletes active template safely. |
| Authorize enrollment | `POST /api/attendance/biometrics/enrollment-authorizations` | Authorized staff in scope creates a short-lived, single-use authorization only after checking current consent and approved cadet status. Re-enrollment has its own purpose and review rule. |
| Enroll | Existing `POST /api/attendance/biometrics/enroll` | Accepts `cadetId`, `consentId`, `enrollmentAuthorizationId`, and approved capture payload. Rejects boolean consent claims, mismatched/revoked/old consent, expired/used authorization, or unauthorized scope. Client-generated descriptor concerns remain a separate activation blocker. |
| Revoke compatibility | Existing `DELETE /api/attendance/biometrics/:cadetId` | Deprecate after clients migrate; preserve route temporarily as a compatibility wrapper that records a real revocation by the authenticated subject, never a hard delete of consent history. |

All handlers need request schemas, generic non-enumerating errors where appropriate, rate limits, audit events, and transactionally consistent authorization consumption. Existing authentication/session middleware and scope checks remain mandatory.

## Authorization rules

- The cadet can grant or revoke only consent bound to their own user ID.
- A guardian may act only through the separately approved and verified guardian workflow; guardian identity must not be inferred from the staff account.
- Staff can create an enrollment authorization only for an approved/active cadet in their existing platoon/assignment scope. A staff role alone does not create cadet consent.
- Staff cannot create, renew, or restore consent on a cadet's behalf by sending a boolean or by enrolling a template.
- Only a narrowly defined role can authorize re-enrollment; require a reason, active subject consent, and a new authorization record.
- Cadets without consent retain account access, the same ordinary portal functionality, and manual attendance. Every attendance session continues to support the existing manual workflow.
- Read APIs return consent state and timestamps only; never expose descriptors, encryption envelopes, camera images, or guardian evidence.

## Retention and deletion implications

- Retain grant/revocation audit metadata only for the approved institutional retention period and legal basis. Define access logging and export controls for consent history.
- On revocation, remove the active template and any raw capture material immediately unless a reviewed retention exception requires a restricted, time-bounded hold. No capture should be retained by default.
- Backups may retain encrypted template material until backup expiry; document key destruction, backup lifecycle, restoration behavior, and deletion propagation. Do not claim immediate physical erasure from immutable backups unless the controls provide it.
- Account deletion and cadet record retention need separate policy: preserve consent audit history only where permitted, and pseudonymize/minimize subject links if required. `onDelete: Restrict` is proposed to prevent an account deletion from silently cascading away an audit trail; final referential behavior needs legal and operational review.
- Key rotation and template deletion are distinct: destroying encryption keys can make envelopes unrecoverable but must not erase consent history or substitute for application-level deletion auditing.

## Migration and rollback strategy (proposal; not executed)

1. **Approval gate:** Obtain privacy/legal approval for policy, subject/guardian rules, retention, staff scope, and consent text. Approve the exact schema/API plan separately before editing Prisma or migration files.
2. **Inventory:** In the approved local database only, identify existing templates and their `registeredBy`, timestamps, model/descriptor metadata, and any auditable consent evidence. Do not read or export descriptors for this inventory.
3. **Additive migration:** Add consent and enrollment authorization tables and nullable `BiometricTemplate.consentId`; add indexes and foreign keys without changing or deleting cadets, templates, or attendance. Add append-only audit records for state changes.
4. **Compatibility release:** Make enrollment fail closed unless it has a valid consent grant and one-time authorization. Existing templates with no verified consent remain non-matchable and are not backfilled as consented. Keep the attendance feature flag off.
5. **Controlled data disposition:** Review each legacy template under approved policy. Obtain new consent and re-enroll through the approved flow, or delete the template with an audited action. Never synthesize historic consent.
6. **Enforce constraints:** After legitimate records are handled, make `consentId` required for active templates if appropriate and add database constraints that enforce revocation metadata and unique active grant semantics. Prisma's schema representation and PostgreSQL partial-index strategy need a migration review.
7. **Rollback:** Roll back application code first while preserving new consent rows and audit history. Do not roll back by deleting consent history. Any schema rollback must be a separately reviewed migration and must not drop the new audit tables/data; prefer forward-compatible additive schema if restoration would lose records.
8. **No migration in this sprint:** This document is a proposal. No schema edits, migration creation, database operation, or production rollout is authorized by this task.

## Backward compatibility

- Registration remains compatible with existing clients that submit biometric fields: backend ignores those fields and does not create a template. Frontend stops collecting and sending them.
- Existing account fields, email/mobile OTP proofs, duplicate checks, password policy, role assignment, `UNDER_REVIEW` status, and approval workflow remain unchanged.
- `biometricEnrolled: false` in the registration response explicitly indicates that registration did not enroll a template. Existing clients that ignore the field continue to work.
- Current staff enrollment clients that submit only `biometricConsent: true` must be migrated to the new consent and authorization contract before enforcement is switched on. Until then, the consent lifecycle remains incomplete and biometric attendance stays disabled.
- Manual attendance and ordinary login must not query consent state as an access prerequisite.

## Required tests before/after implementation

### Registration (safe to implement without schema changes)

- Registration succeeds without biometric fields and without consent.
- Registration succeeds with `biometricConsent: false`.
- Registration ignores supplied legacy descriptor/quality/consent fields and creates no template.
- Existing required fields, password rules, OTP proof validation/consumption, duplicate checks, role, and review status are unchanged.

### Consent lifecycle (requires approved schema and implementation)

- Consent grant is bound to its cadet subject, purpose, and policy version; cross-subject IDs are rejected.
- Subject or policy-approved guardian actor attribution and timestamps are persisted correctly.
- Staff boolean submission cannot grant, restore, or renew consent.
- Revocation records actor/time and preserves prior grant history; re-consent creates a new grant row.
- Every enroll/re-enroll requires a current grant plus correct, unused authorization; revoked, mismatched, expired, or consumed values fail closed.
- Re-enrollment cannot overwrite a template without a distinct authorization and audit event.
- Revocation removes/disables the active template while login, portal routes, manual attendance and attendance history continue to work.
- Consent APIs enforce authentication, self-scope, staff scope, rate limits, and privacy-safe response content.
- Existing biometric security tests remain passing; automatic attendance remains disabled.

## Approvals still required

- Institutional privacy/legal approval of purpose, consent wording, retention, guardian conditions, withdrawal consequences, and non-biometric alternative.
- Explicit approval of the Prisma schema proposal and migration plan before any schema or migration changes.
- Maintainer/license clearance and model/PAD selection remain separate blockers; this consent proposal does not resolve them.
