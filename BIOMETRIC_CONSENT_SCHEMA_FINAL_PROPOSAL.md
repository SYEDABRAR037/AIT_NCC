# AIT NCC — BSR-03 Final Consent Schema/API Proposal

**Status:** Final design draft for institutional decision and schema approval; not applied or migration-tested.  
**Approval result:** Requires institutional decisions recorded in `BIOMETRIC_INSTITUTIONAL_DECISIONS.md`.  
**Safety:** Keep automatic biometric attendance disabled. This consent design does not clear recognition/PAD models or permit attendance activation.

## Design guarantees

1. The subject is derived only from the authenticated cadet account. A client cannot select another subject, provider identity, consent time, or policy hash.
2. A backend-generated random consent challenge is bound to subject, durable authenticated session, purpose, and an immutable published policy record. It expires quickly and can be consumed once.
3. Challenge issuance is not consent. A grant is recorded only by a separate authenticated cadet request with explicit confirmation of the exact published policy text.
4. Grant, terminal lifecycle events, and published policy records are immutable. Revocation creates a new event and removes the current pointer; it never edits an old grant back to active.
5. A unique current pointer and composite foreign keys bind the active grant to the exact cadet and purpose. Deferred PostgreSQL constraint triggers prevent committed revoked/current or active-template/revoked-consent states, including any additional purpose required by the enabled processing policy.
6. Legacy templates default to `QUARANTINED`, have no inferred grant, and cannot be matched. Only a new approved enrollment may create a non-quarantined record.
7. Guardian provider support is represented as a disabled extension. The first migration's database constraint and API policy accept `SUBJECT` only.
8. Consent does not gate ordinary registration, login, portal access, approval, or manual attendance.

## Purposes and immutable policy registry

Candidate purposes for institutional review are `BIOMETRIC_ENROLLMENT` and `ATTENDANCE_VERIFICATION`. These are design names only, not approved purposes. The application policy registry must enable a purpose only after an authorized policy version is published. Merely adding an enum value never enables an API operation.

Proposed policy record:

```prisma
enum BiometricConsentPurpose {
  BIOMETRIC_ENROLLMENT
  ATTENDANCE_VERIFICATION
}

model BiometricConsentPolicy {
  id                    String   @id @default(uuid())
  purpose               BiometricConsentPurpose
  version               String
  locale                String
  policyText            String   @db.Text
  documentSha256        String
  effectiveAt           DateTime
  publishedAt           DateTime?
  retiredAt             DateTime?
  createdAt             DateTime @default(now())
  challenges            BiometricConsentChallenge[]
  grants                BiometricConsentGrant[]

  @@unique([purpose, version, locale])
  @@unique([id, purpose])
  @@index([purpose, publishedAt, effectiveAt])
}
```

The server returns the exact text, locale, version, hash, and purpose from this immutable registry. It computes/verifies SHA-256 over a documented canonical UTF-8 representation before serving. Published text/version/hash/purpose/locale are immutable; corrections publish a new row. A challenge cannot be granted against a retired or no-longer-accepted policy. Institutional policy decides whether locale-specific text is a separate policy version or a translation tied to one version.

## Proposed Prisma models

This is a reviewed design sketch, not a drop-in `schema.prisma`. It requires distinct back-relations on `User` and `AuthSession` as listed below. Validate the complete merged schema with the repository's exact Prisma version before requesting migration approval.

```prisma
enum BiometricConsentProviderType {
  SUBJECT
  GUARDIAN
}

enum BiometricConsentEventType {
  REVOKED
  SUPERSEDED
  SUBJECT_OBJECTED
  ASSENT_WITHDRAWN
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

enum BiometricTemplateState {
  QUARANTINED
  PENDING_VALIDATION
  ACTIVE
}

model BiometricConsentChallenge {
  id                    String   @id @default(uuid())
  subjectCadetId        String
  purpose               BiometricConsentPurpose
  policyId              String
  authSessionId         String
  tokenHash             String   @unique
  issuedAt              DateTime @default(now())
  expiresAt             DateTime
  consumedAt            DateTime?

  policy BiometricConsentPolicy @relation(fields: [policyId, purpose], references: [id, purpose], onDelete: Restrict)
  session AuthSession @relation("ConsentChallengeSession", fields: [authSessionId, subjectCadetId], references: [id, userId], onDelete: Restrict)
  subject User @relation("ConsentChallengeSubject", fields: [subjectCadetId], references: [id], onDelete: Restrict)
  grant BiometricConsentGrant?

  @@unique([id, subjectCadetId, purpose, policyId])
  @@index([subjectCadetId, purpose, expiresAt, consumedAt])
}

model BiometricConsentGrant {
  id                    String   @id @default(uuid())
  subjectCadetId        String
  purpose               BiometricConsentPurpose
  policyId              String
  challengeId           String   @unique
  providerType          BiometricConsentProviderType @default(SUBJECT)
  providerUserId        String?
  recordedByUserId      String?
  consentedAt           DateTime @default(now())
  idempotencyKey        String
  requestFingerprint    String
  createdAt             DateTime @default(now())

  subject User @relation("ConsentGrantSubject", fields: [subjectCadetId], references: [id], onDelete: Restrict)
  provider User? @relation("ConsentGrantProvider", fields: [providerUserId], references: [id], onDelete: Restrict)
  recordedBy User? @relation("ConsentGrantRecorder", fields: [recordedByUserId], references: [id], onDelete: SetNull)
  policy BiometricConsentPolicy @relation(fields: [policyId, purpose], references: [id, purpose], onDelete: Restrict)
  challenge BiometricConsentChallenge @relation(fields: [challengeId, subjectCadetId, purpose, policyId], references: [id, subjectCadetId, purpose, policyId], onDelete: Restrict)
  events BiometricConsentEvent[]
  currentFor BiometricConsentCurrent?
  authorizations BiometricEnrollmentAuthorization[]
  enrollmentTemplates BiometricTemplate[]
  guardianEvidence BiometricGuardianConsentEvidence?

  @@unique([id, subjectCadetId, purpose])
  @@unique([id, subjectCadetId])
  @@unique([subjectCadetId, idempotencyKey])
  @@unique([challengeId, subjectCadetId, purpose, policyId])
  @@index([subjectCadetId, purpose, consentedAt])
}

model BiometricConsentEvent {
  id                 String   @id @default(uuid())
  consentGrantId     String
  subjectCadetId     String
  purpose            BiometricConsentPurpose
  eventType          BiometricConsentEventType
  actorType          BiometricConsentActorType
  actorUserId        String?
  guardianEvidenceId String?
  occurredAt         DateTime @default(now())
  reasonCode         String?
  idempotencyKey     String

  grant BiometricConsentGrant @relation(fields: [consentGrantId, subjectCadetId, purpose], references: [id, subjectCadetId, purpose], onDelete: Restrict)
  actor User? @relation("ConsentEventActor", fields: [actorUserId], references: [id], onDelete: SetNull)
  guardianEvidence BiometricGuardianConsentEvidence? @relation(fields: [guardianEvidenceId, subjectCadetId], references: [id, subjectCadetId], onDelete: Restrict)

  @@unique([consentGrantId]) // one terminal event per grant
  @@unique([consentGrantId, idempotencyKey])
  @@index([subjectCadetId, purpose, occurredAt])
}

model BiometricConsentCurrent {
  subjectCadetId String
  purpose        BiometricConsentPurpose
  consentGrantId String @unique
  createdAt      DateTime @default(now())

  grant BiometricConsentGrant @relation(fields: [consentGrantId, subjectCadetId, purpose], references: [id, subjectCadetId, purpose], onDelete: Restrict)

  @@id([subjectCadetId, purpose])
  // Prisma 6 requires this exact referenced tuple unique for the one-to-one composite relation.
  @@unique([consentGrantId, subjectCadetId, purpose])
}

model BiometricEnrollmentAuthorization {
  id                String   @id @default(uuid())
  consentGrantId    String
  subjectCadetId    String
  purpose           BiometricConsentPurpose
  authorizationType BiometricEnrollmentAuthorizationType
  authorizedById    String
  authorizedAt      DateTime @default(now())
  expiresAt         DateTime
  consumedAt        DateTime?
  consumedById      String?
  idempotencyKey    String
  requestFingerprint String

  grant BiometricConsentGrant @relation(fields: [consentGrantId, subjectCadetId, purpose], references: [id, subjectCadetId, purpose], onDelete: Restrict)
  subject User @relation("EnrollmentAuthorizationSubject", fields: [subjectCadetId], references: [id], onDelete: Restrict)
  authorizedBy User @relation("EnrollmentAuthorizationIssuer", fields: [authorizedById], references: [id], onDelete: Restrict)
  consumedBy User? @relation("EnrollmentAuthorizationConsumer", fields: [consumedById], references: [id], onDelete: SetNull)

  @@unique([authorizedById, idempotencyKey])
  @@index([subjectCadetId, purpose, expiresAt, consumedAt])
}

// Disabled extension. No row/API is accepted until institution enables guardian policy.
model BiometricGuardianConsentEvidence {
  id                    String   @id @default(uuid())
  subjectCadetId        String
  consentGrantId        String?  @unique
  guardianReference     String   // opaque reference to approved restricted evidence system
  relationshipCode      String
  verificationMethod    String
  verificationOutcome   String
  verifiedAt            DateTime
  verifiedByUserId      String
  policyDecisionRef     String
  subjectAssentedAt     DateTime?
  createdAt             DateTime @default(now())

  subject User @relation("GuardianConsentSubject", fields: [subjectCadetId], references: [id], onDelete: Restrict)
  verifiedBy User @relation("GuardianEvidenceVerifier", fields: [verifiedByUserId], references: [id], onDelete: Restrict)
  grant BiometricConsentGrant? @relation(fields: [consentGrantId, subjectCadetId], references: [id, subjectCadetId], onDelete: Restrict)
  events BiometricConsentEvent[]

  @@unique([id, subjectCadetId])
  @@unique([consentGrantId, subjectCadetId])
  @@index([subjectCadetId, verifiedAt])
}
```

Add to `AuthSession`:

```prisma
  consentChallenges BiometricConsentChallenge[] @relation("ConsentChallengeSession")
  @@unique([id, userId])
```

Add separately named `User` back-relations for: challenge subject; grant subject/provider/recorder; event actor; authorization subject/issuer/consumer; guardian evidence subject/verifier. Do not reuse relation names from existing attendance/auth relations.

### Existing `BiometricTemplate` additions

Keep its current `id`, unique `cadetId`, encrypted `descriptor`, and existing cadet relation. Add:

```prisma
  enrollmentConsentGrantId String?
  consentPurpose           BiometricConsentPurpose?
  enrollmentState          BiometricTemplateState @default(QUARANTINED)
  enrollmentConsent BiometricConsentGrant? @relation(
    fields: [enrollmentConsentGrantId, cadetId, consentPurpose],
    references: [id, subjectCadetId, purpose],
    onDelete: Restrict
  )
```

The existing `cadetId @unique` remains. New template rows require a `BIOMETRIC_ENROLLMENT` grant. Attendance matching additionally requires a separate active `ATTENDANCE_VERIFICATION` current grant for that cadet; collection consent alone cannot authorize attendance processing. `ACTIVE` means eligible for a currently approved biometric processing purpose and therefore requires all grants for that approved use to remain current. If either enrollment or attendance-use consent is revoked, the same revocation transaction must move the template to `QUARANTINED` (or delete it per approved retention). A later new grant does not auto-reactivate the template; a separate authorized validation/reactivation step is required. Null linkage is only valid for a quarantined legacy row.

### Invariants: Prisma/FKs versus PostgreSQL SQL

**Enforced by Prisma declarations and PostgreSQL FKs/unique keys:**

- Consent, authorization, event, current pointer, challenge, policy, and template composite relationships match their exact cadet/purpose/policy tuple.
- One current grant per `(subjectCadetId,purpose)` from the `BiometricConsentCurrent` primary key.
- A grant references one challenge; challenge references the same subject, purpose, and policy.
- One terminal event per grant; one idempotency record per scoped key.
- Template `cadetId` remains unique and refers to an existing User.

**Required PostgreSQL CHECK constraints:**

```sql
CHECK ("expiresAt" > "issuedAt") -- consent challenge
CHECK ("providerType" = 'SUBJECT' AND "providerUserId" = "subjectCadetId")
CHECK (("consumedAt" IS NULL AND "consumedById" IS NULL)
    OR ("consumedAt" IS NOT NULL AND "consumedById" IS NOT NULL))
CHECK (("enrollmentConsentGrantId" IS NULL) = ("consentPurpose" IS NULL))
CHECK ("enrollmentState" <> 'ACTIVE' OR
       ("enrollmentConsentGrantId" IS NOT NULL AND "consentPurpose" IS NOT NULL))
CHECK ("enrollmentConsentGrantId" IS NULL OR
       "consentPurpose" = 'BIOMETRIC_ENROLLMENT')
```

The provider constraint is intentionally subject-only for the initial system; the Guardian enum/model are dormant and no guardian row/API is allowed. A future, separately approved migration may replace that constraint with a guardian-specific rule.

**Not enforceable with ordinary foreign keys or row-local CHECKs:**

- Current pointer must not coexist with a terminal consent event for its grant.
- An `ACTIVE` template's enrollment grant and all current grants required by enabled processing policy must be current, have no terminal event, and match the same subject/purpose.
- Subject actor ID must equal the grant subject; staff/guardian actor legitimacy and staff scope are cross-row/policy checks.
- Published policy text hash must equal SHA-256 of canonical policy text.
- Consent challenge must be unused/unexpired at the precise grant transaction instant.
- No template may become active until server-side capture/model trust criteria are satisfied.

Use **deferred PostgreSQL constraint triggers** on current-pointer, terminal-event, template-state/linkage, and grant/policy publication writes to validate the final transaction state at commit. Restrict runtime UPDATE/DELETE of grants/events/published policy text with DB privileges and immutability triggers. Every trigger function uses a safe fixed `search_path` and minimal privileges.

The service layer still must enforce authentication, role, policy acceptance, current policy status, scoped staff authorization, session binding, idempotency request fingerprint, atomic challenge/authorization consumption, model compatibility, and explicit audit behavior. DB constraints are defense in depth, not a replacement.

## API contracts

### Published consent text

`GET /api/attendance/biometrics/consent-policy?purpose=...`

- Returns only an institutionally published/enabled policy: purpose, version, locale, exact policy text, SHA-256, and effective date.
- No biometric data is returned. If no purpose/policy is approved, return a controlled unavailable response and do not issue challenges.

### Issue consent challenge

`POST /api/attendance/biometrics/consent-challenges`

Request: `{ "purpose": "...", "policyId": "..." }` (policy/version/hash are independently loaded and checked by the server).

Authorization: authenticated CADET with a valid, non-revoked durable `AuthSession`; the controller derives `subjectCadetId` from the authenticated user and `authSessionId` from middleware. Staff roles are rejected.

Response: one-time random token, challenge ID, exact policy text/version/hash, purpose, issued/expiry times. Token is 32 random bytes from Node `crypto.randomBytes`, encoded URL-safe; database stores only SHA-256(token). Proposed challenge TTL: **5 minutes**, configurable within a reviewed small bound. Issuing a challenge records no consent and creates no grant.

### Record subject grant

`POST /api/attendance/biometrics/consents/grant`

Request: `{ "challengeId": "...", "challengeToken": "...", "confirmed": true, "idempotencyKey": "..." }`.

- Require CADET role and same active durable session bound to the challenge.
- No `cadetId`, `providerUserId`, `providerType`, `consentedAt`, policy version, or hash is accepted as authority from the client.
- `confirmed` is an explicit affirmative action only after the UI presents the exact server-returned text; the challenge alone is not consent.
- Server records subject/provider IDs and timestamps; provider is `SUBJECT`; no staff impersonation path exists.
- Same idempotency key + same request fingerprint returns the prior result. Same key + changed challenge/purpose/policy returns conflict.

### Read own state / revoke

- `GET /api/attendance/biometrics/consents/me`: cadet-self only; state, purpose, policy reference, grant/revocation times, no template data or guardian evidence.
- `POST /api/attendance/biometrics/consents/:grantId/revoke`: only the grant's authenticated subject by default. Uses an idempotency key and allowlisted reason; staff-assisted revocation is disabled unless a separate approved policy is implemented. Revocation atomically inserts a terminal event, removes the current pointer, and quarantines/deletes the linked template.

### Staff authorization and enrollment

- `POST /api/attendance/biometrics/enrollment-authorizations`: scoped staff only; accepts cadet ID, consent grant ID, authorization type, idempotency key/reason. The server checks active purpose-specific consent, cadet status, staff scope, and whether template state matches initial/re-enrollment. Staff cannot grant consent.
- Existing `/api/attendance/biometrics/enroll`: replace `biometricConsent` and `replaceExisting` authority with `cadetId`, consent grant ID, one-time authorization ID, and approved capture artifact/reference. Descriptor trust is a separate blocker; browser descriptor and quality claims cannot activate a template.
- Enrollment consumes authorization conditionally and atomically with template create/replace. Activation requires the future, separately cleared server-side capture/model workflow; otherwise state remains `PENDING_VALIDATION` and non-matchable.
- Attendance verification requires both current enrollment consent and current attendance-verification consent before decryption/comparison; it rechecks attendance-purpose consent before persisting `PRESENT`.

### Guardian extension (disabled)

- `providerType=GUARDIAN`, guardian evidence rows, guardian endpoints, and guardian-issued grants are rejected by the initial database CHECK and server policy registry.
- The proposed evidence row keeps the cadet subject, opaque evidence-system reference, relationship code, verification method/outcome/time, verifying staff user, policy decision reference, and optional assent timestamp. Do not store ID documents, raw guardian credentials, or unnecessary contact data in these tables.
- Guardian identity is an external provider, not a `User` acting as the cadet. `recordedByUserId`/`verifiedByUserId` are staff witnesses/verifiers, never consent providers.
- Cadet assent, objection, and assent withdrawal can be represented as separate lifecycle events. Their effect is intentionally disabled until authorized policy specifies whether assent is required and how objection changes the grant.

## Transaction outline

All lifecycle transactions use `SERIALIZABLE` isolation with bounded serialization retries, plus a transaction-scoped advisory lock derived from `(subjectCadetId,purpose)` to serialize the no-current-row case. Unique keys and conditional updates remain authoritative under concurrent processes.

### Grant

1. Authenticate CADET; require a live durable session ID. Derive cadet ID from auth context.
2. Load currently effective published policy from server storage and verify canonical text hash.
3. Compute request fingerprint from subject/session/challenge/purpose/policy/confirmation (never include plaintext OTP/password/token in logs).
4. Begin serializable transaction and acquire subject-purpose advisory lock.
5. If same idempotency key exists, return same grant only if fingerprint matches; otherwise conflict.
6. Atomically consume exact challenge with conditional update: matching challenge ID, `tokenHash=SHA256(token)`, subject, session, purpose, policy, `consumedAt IS NULL`, `expiresAt > now`; require one returned row.
7. Recheck policy is still effective and no current grant exists. If current grant exists, return conflict; renewal after revocation requires a new challenge and new grant.
8. Insert immutable grant with provider=subject, auth subject ID, server timestamp, exact policy link, challenge link, idempotency key/fingerprint; insert current pointer and append metadata-only audit/outbox row.
9. Commit. Any failed step rolls back challenge consumption, grant, pointer, and audit/outbox.

### Revocation

1. Authenticate cadet and verify grant belongs to `req.user.id`; staff route disabled by default.
2. Begin serializable transaction; acquire subject-purpose advisory lock and lock current pointer/template row.
3. Insert exactly one immutable `REVOKED` terminal event (idempotent repeat returns prior result); delete pointer by exact `(subject,purpose,grantId)` and require count one.
4. Set template state to `QUARANTINED` or delete according to approved retention choice. These changes occur in same transaction; deferred DB triggers verify no current pointer/active template survives for the terminal grant at commit.
5. Write audit/outbox metadata; commit. Any failure rolls back all changes and the API must not report completed revocation.

### Enrollment authorization and consume

- Authorization request checks active cadet, staff role/scope, current enrollment-purpose grant, approved policy, and template existence under the same subject-purpose lock. Initial authorization requires no template; re-enrollment requires an existing template and a fresh current grant after prior terminal event. Insert one idempotent short-lived authorization.
- Consume + create/replace: under serializable transaction and same lock, recheck staff scope, cadet status, current grant, template state, and authorization; issue conditional `UPDATE ... WHERE consumedAt IS NULL AND expiresAt > now RETURNING id`. Exactly one concurrent consume wins. Create/replace template and write audit/outbox in that transaction. Failure rolls back authorization consumption and template write.

### Verification

- Before descriptor decryption, query only session-eligible authorized cadets and templates with `enrollmentState=ACTIVE`, exact current enrollment grant, no terminal event, and compatible payload/model.
- Attendance matching additionally requires an exact current `ATTENDANCE_VERIFICATION` grant.
- On a match, acquire the same subject-purpose lock and recheck current grants/template state/session/leave/duplicate conditions in the transaction that writes attendance. If consent withdrawal committed first, do not write PRESENT. If verification commits first, preserve that linearized order in the audit record.
- Keep automatic attendance disabled until independent model, PAD, privacy, reliability, and rollout approvals are complete. Manual attendance never queries biometric consent.

## Guardian support safety

Guardian support is a schema extension only, not enabled behavior. Institutional approval must define eligibility, evidence, verifier, relationship, assent, objection, revocation, and retention. Until then: no guardian grant API, no guardian challenge/grant acceptance, DB CHECK only permits `SUBJECT`, and the app rejects guardian provider values. The evidence model is not a permission to collect guardian data.

## Referential and deletion rules

- Grant/event/policy/current/auth history uses `Restrict` relationships to prevent accidental cascade loss; challenge-to-auth-session is `Restrict` until challenge expiry/retention cleanup; template-to-cadet retains current cascade only if the approved deletion workflow handles consent records first.
- Hard deletion of `User` conflicts with `Restrict` consent history. The institution must choose restricted pseudonymous subject tombstones or an approved anonymization workflow before migration. Do not cascade-delete grants/events silently.
- Revocation/template deletion from primary DB does not erase backup copies. Current application encryption uses a shared keyring, not per-cadet DEKs; per-cadet cryptographic erasure cannot be claimed. Restore must replay deletion/revocation tombstones and force legacy templates to quarantine before serving.

## Implementation and approval boundaries

1. The current implementation has no durable consent row; current staff enrollment accepts a boolean; current revocation writes a general audit event and deletes the template; current matching has no consent join. This proposal changes no code.
2. Registration, login, application approval, portal access, and manual attendance remain consent-independent.
3. Model/license clearance and server-side capture/PAD are separate gates. A consent-compliant encrypted template is not automatically trustworthy or eligible for matching.
4. No schema, API, migration, or biometric attendance change is authorized by this document.
