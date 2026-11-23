# AIT NCC — BSR-03 Final Migration and Test Plan

**Status:** Planning only; no schema changes, migrations, database access, or application changes.  
**Design reference:** `BIOMETRIC_CONSENT_SCHEMA_FINAL_PROPOSAL.md`.  
**Current result:** Requires institutional decisions before schema approval. Keep `ENABLE_BIOMETRIC_ATTENDANCE` disabled.

## Scope and current evidence

The existing schema has `User` with a one-to-one optional `BiometricTemplate`; template `cadetId` is unique and cascades on User deletion. It has no consent grant, challenge, current pointer, authorization, or quarantine state. `AuthSession` has `(id,userId)` fields but no composite unique key. Existing migrations are `20261107000000_init_baseline`, `20261116000000_cadet_performance_analytics`, and `20261116010000_auth_session_hardening`.

Existing code evidence reviewed earlier: registration is biometric-optional after BSR-01; staff enrollment still accepts `biometricConsent: true` and `replaceExisting`; revocation deletes the current template and writes a general audit row; verification has no consent join. The biometric attendance endpoint is guarded by `ENABLE_BIOMETRIC_ATTENDANCE`. No database contents were inspected for this plan.

## Final schema changes proposed

Create these new enums/models and add relations/fields as specified in the final proposal:

1. `BiometricConsentPolicy`: immutable published purpose/version/locale/text/hash record; publication/retirement lifecycle is server controlled.
2. `BiometricConsentChallenge`: SHA-256 token hash, authenticated subject, durable session, purpose, policy ID, issue/expiry/consumption timestamps. The token itself is returned once and never stored.
3. `BiometricConsentGrant`: immutable cadet-subject grant linked by composite FK to the exact challenge and policy. Store server-side provider identity, server consent time, idempotency key and request fingerprint. Staff witness is a separate nullable actor.
4. `BiometricConsentEvent`: immutable terminal events `REVOKED`, `SUPERSEDED`, `SUBJECT_OBJECTED`, `ASSENT_WITHDRAWN`; at most one terminal event per grant.
5. `BiometricConsentCurrent`: unique current pointer keyed by `(subjectCadetId,purpose)` and referencing exact grant/cadet/purpose. Include Prisma-required `@@unique([consentGrantId,subjectCadetId,purpose])` for the one-to-one composite relation.
6. `BiometricEnrollmentAuthorization`: subject/grant/purpose-bound initial or re-enrollment authority, issuer, expiry, idempotency, conditional consumption timestamp and consumer.
7. `BiometricGuardianConsentEvidence`: dormant extension only. Initial API and DB constraints allow `SUBJECT` provider only; no guardian grant is accepted before a separate approved policy migration.
8. `BiometricTemplate`: add nullable enrollment-consent grant/purpose tuple and `enrollmentState` defaulting to `QUARANTINED`; keep current one-template-per-cadet unique key. Only new, authorized enrollment may progress through `PENDING_VALIDATION` to `ACTIVE` after separate model/capture gates.
9. `AuthSession`: add `@@unique([id,userId])` to support a composite FK that binds a consent challenge to the same authenticated subject.
10. `User` and `AuthSession`: add distinct named back-relations for every new relation. Keep relation names unique and do not reuse existing auth/attendance relations.

### Required keys, indexes and SQL invariants

- Primary/unique keys: policy `[purpose,version,locale]` and `[id,purpose]`; grant `[id,subjectCadetId,purpose]` and `[subjectCadetId,idempotencyKey]`; challenge token hash and challenge composite `[id,subjectCadetId,purpose,policyId]`; current primary key `[subjectCadetId,purpose]`, unique `consentGrantId`, and Prisma-required composite unique `[consentGrantId,subjectCadetId,purpose]`; one terminal event per grant; authorization `[authorizedById,idempotencyKey]`; template `cadetId` remains unique.
- Composite foreign keys bind grant to challenge/policy, challenge to AuthSession user, event/current pointer/authorization to the exact grant subject and purpose, and template to the same cadet's enrollment-purpose grant.
- Row-local SQL checks: challenge expiry later than issue time; consumed timestamp/consumer paired; initial deployment provider is exactly `SUBJECT` and provider user equals the subject; template consent ID and purpose are both null or both present; active template requires a non-null enrollment grant and enrollment purpose.
- Cross-row SQL triggers: deferred constraint triggers ensure a current pointer never refers to a terminal grant and an `ACTIVE` template has a current enrollment grant plus every current purpose grant required by enabled processing policy, with no terminal event. Trigger changes to current pointer, event, policy, and template state are checked at transaction commit.
- Immutability: database runtime role cannot update/delete grant, terminal event, or published policy content/hash. Use append-only triggers/privileges; retention purge is a separately privileged, approved operation.
- No partial unique index is needed while `BiometricConsentCurrent` is the sole current-state pointer. If that table is removed, replace this with a reviewed partial unique index before implementation.
- Ordinary FKs cannot enforce the cross-table terminal-event/current-pointer or active-template/current-grant predicates. Row-local `CHECK` constraints cannot enforce staff scope, policy publication, session freshness, or actor authorization. These require deferred triggers and server checks.

## Migration ordering (future, after approvals)

1. **Decision gate:** Complete `BIOMETRIC_INSTITUTIONAL_DECISIONS.md`; approve the final schema and this migration plan separately. Resolve retention and deletion before setting `onDelete` behavior.
2. **Preflight:** In a later authorized migration task, verify the exact target DB identity first. This plan did not connect to or inspect a database. Generate migration SQL from the reviewed schema and inspect for destructive DDL, table locks, enum changes, and trigger privileges/search paths.
3. **Additive expansion:** Add purpose/provider/event/auth/template enums; policy/challenge/grant/event/current/authorization/guardian tables; exact User/AuthSession back-relations; composite uniques/FKs; nullable template consent fields; and template state default `QUARANTINED`. Keep existing cadet, attendance, and template rows.
4. **Database integrity:** Add approved row-local checks and deferred triggers for pointer/event/template state. Add immutable history/published-policy protections. Test constraint deferral and transaction commit behavior using the same PostgreSQL version and role permissions planned for deployment.
5. **Quarantine existing templates:** Set every pre-existing template to `QUARANTINED` and null consent linkage. This migration classification does not assert consent. Do not use descriptor-envelope consent metadata, `registeredBy`, an old audit row, or staff-submitted booleans as evidence.
6. **Fail-closed application compatibility:** Update code only in a separately approved implementation task. New code rejects legacy enrollment booleans and `replaceExisting`, requires challenge/grant/authorization, and excludes quarantined/null-linked templates before decryption. Keep flag disabled. Do not run old biometric-enabled code against the expanded schema.
7. **Legacy disposition:** Preserve rows quarantined for the approved retention interval, or delete them with metadata-only audited disposition under the approved policy. If a cadet wants enrollment, require fresh subject consent plus approved enrollment and fresh server-side validation. Existing templates are never retroactively consented or activated.
8. **Optional tightening:** Only after all legacy rows are deleted or replaced under fresh consent, decide whether to make template consent linkage non-null. If quarantined legacy rows remain, retain nullable linkage with the DB state check; do not force consent to satisfy a migration constraint.
9. **Validation:** Run `prisma validate`, migration diff, DDL review, trigger tests, constraints, race/integration test matrix, backup/restore and rollback rehearsal on an approved disposable PostgreSQL database. No such tests or migration run in this planning task.

## Consent and enrollment transaction requirements

### Subject grant

1. Require authenticated CADET with a valid durable `AuthSession`; reject sid-less legacy tokens. Derive subject ID from auth middleware.
2. Load exact active policy text/version/hash server-side. `POST /consent-challenges` generates 32 random bytes, stores only SHA-256(token), binds challenge to subject/session/purpose/policy, and sets a short TTL (proposal: five minutes). Issuing a challenge does not grant consent.
3. After the cadet explicitly confirms the displayed text, `POST /consents/grant` starts a SERIALIZABLE transaction and obtains a subject-purpose advisory lock.
4. Same idempotency key plus identical request fingerprint returns its existing grant; same key with different challenge/purpose/policy returns conflict.
5. Atomically consume challenge with a conditional update requiring matching token hash, identity, session, purpose, policy, unconsumed state and unexpired time. Require one returned row.
6. Recheck policy remains effective; require no current pointer; insert immutable grant with server-derived subject/provider/time; insert current pointer and metadata audit/outbox. Commit all or none.
7. Challenge, idempotency, unique-current key and transaction locking prevent old replay, duplicate active grants and concurrent double-submission. The affirmative confirmation occurs through the subject-only endpoint; a challenge itself is not consent.

### Revoke

1. By default only authenticated subject can revoke its grant; staff-assisted revocation is disabled pending explicit approval.
2. SERIALIZABLE transaction obtains the subject-purpose lock, validates exact current grant, inserts one terminal `REVOKED` event, and removes the current pointer.
3. If the grant is for enrollment, or for any processing purpose currently required by an active template, quarantine/delete each affected template in the same transaction. This applies to attendance-use revocation even if the enrollment grant remains current.
4. Required audit/outbox and all row changes commit atomically. Any failure rolls back and API must not report successful revocation.
5. Deferred triggers reject a commit retaining a current pointer or an ACTIVE template whose required purpose grants are revoked/missing.

### Staff authorization and enrollment

- Staff must pass role, cadet status, and existing assignment-scope checks. A staff action never creates a grant.
- Initial authorization requires active enrollment-purpose consent and no existing template. Re-enrollment requires an existing template plus a fresh subject grant created after prior termination and a distinct authorization.
- Use SERIALIZABLE transaction/subject-purpose advisory lock. Consume authorization with conditional `UPDATE ... WHERE consumedAt IS NULL AND expiresAt > now RETURNING ...`; one concurrent request wins.
- In that same transaction, recheck current grant, authorization type, cadet scope/status, expected template version, create/replace template, and append metadata audit/outbox. Any error rolls back authorization consumption and template mutation.
- Client descriptors remain untrusted and cannot set `ACTIVE`; model/capture validation remains a separate blocker.

### Verification

- Before decryption/comparison, query only eligible in-scope templates with `enrollmentState=ACTIVE`, exact current enrollment grant, no terminal event, and compatible trusted payload. Also require current consent for every approved processing purpose; attendance verification requires its own current grant.
- At attendance-write commit, recheck consent/current pointer/template/session/eligibility/leave/duplicate state under the same lock. If revocation committed first, no PRESENT record is written. If attendance write committed first, record that order in audit.
- Manual attendance, registration, login, portal access, and application review never depend on biometric consent.

## Legacy and retention behavior

- Existing templates are quarantined metadata-only. Matching query requires ACTIVE and current grant; SQL trigger/check prevents activation with null/mismatched grant; application performs same checks before decrypting.
- Never infer consent from encrypted metadata, any previous staff checkbox, template registration actor, or generic audit events.
- Fresh consent alone cannot activate a legacy descriptor. Require separately authorized new enrollment and a future approved trusted capture/model process. Without that, keep PENDING_VALIDATION/QUARANTINED.
- Preserve cadet and attendance records. Template deletion is separate from cadet deletion. No guardian identity documents stored in biometric tables; guardian reference points to an approved restricted evidence system.
- `Restrict` consent FKs can block current User hard-delete paths. Institutional decision must choose a pseudonymous subject tombstone or approved anonymization path. Backups may retain encrypted rows until expiry; restore must replay revocation/deletion tombstones before application access. Current shared keyring does not support per-cadet crypto-erasure.

## Rollback and recovery

- Prefer forward fixes. Application rollback is allowed only to code that still fails closed for consentless/quarantined templates; never enable biometric attendance during rollback.
- Do not drop grant/event/policy history or current tombstones on rollback. Schema down migration must not erase consent evidence; a compatibility migration or forward repair is preferred.
- On partial failure, verify transaction atomicity across challenge consumption, grant/current pointer, event, authorization, template and audit/outbox.
- On backup restore, apply tombstones and quarantine status before opening service traffic. If evidence is missing or inconsistent, consent/template remains unusable.
- No migration or database operation is performed by this plan.

## Disposable database validation plan (future authorization required)

1. Use a clearly named isolated disposable local PostgreSQL database, not a protected DB, cloud service, or backup. Verify its database name before any later database operation.
2. Start from intended current migration head; capture migration checksums and schema state.
3. Apply reviewed migration only to that disposable DB; confirm all old templates become quarantined with no consent grant backfill.
4. Review generated SQL and triggers, including deferrability, search path, runtime-role grants, and any table rewrites/locks.
5. Run the 30-case synthetic test matrix below with separate DB sessions/processes for concurrency; notifications mocked; biometric attendance remains disabled.
6. Exercise failure injection, rollback, backup restore with tombstones, and deletion retention using disposable snapshots only.
7. Destroy the disposable DB after saving sanitized evidence. This sequence requires separate implementation/migration approval.

## Institutional blockers

All entries in `BIOMETRIC_INSTITUTIONAL_DECISIONS.md` remain pending: permitted purposes; consent text/version/hash; guardian/minor eligibility; assent/objection; consent/audit retention; account deletion/anonymization; backup expiry/restore; manual alternative; and authorized data access. Additional operational decisions include re-authentication, challenge TTL/session invalidation, staff witness role, policy retirement, re-enrollment approvals, quarantine duration, and DB trigger/retention roles.

## Test matrix (30 cases)

All cases use synthetic cadet IDs. Race/integration cases run only against an approved disposable PostgreSQL DB in a future approved task.

| ID | Case | Expected result |
|---|---|---|
| T01 | Unauthenticated challenge request | 401; no challenge row. |
| T02 | Staff requests a subject challenge | 403; no subject grant/challenge. |
| T03 | Cadet A submits cadet B ID | Ignore client subject ID or reject; challenge/grant binds only to authenticated A. |
| T04 | Challenge generated | Token uses backend CSPRNG; DB stores only hash; token not logged. |
| T05 | Challenge purpose tampered | Grant rejected; no grant/current row. |
| T06 | Challenge policy ID/version/hash tampered | Composite binding/current-policy check rejects. |
| T07 | Challenge expired | Conditional consume returns no row; no grant. |
| T08 | Challenge replay with same idempotency key | Original result returned only if fingerprint matches; no duplicate grant. |
| T09 | Challenge replay with new idempotency key | Reject consumed challenge; no second grant. |
| T10 | Same idempotency key, changed request fingerprint | 409 conflict; no changed grant. |
| T11 | Concurrent duplicate grant, same challenge | Exactly one grant/current pointer; one request returns idempotently or conflict. |
| T12 | Concurrent grants, different challenges | Current PK/lock allows one active pointer; loser gets conflict. |
| T13 | Current pointer references another cadet's grant | Composite FK rejects. |
| T14 | Current pointer remains after terminal event | Deferred constraint trigger aborts commit. |
| T15 | Subject A revokes B's grant | Denied without state change or existence leak. |
| T16 | Concurrent duplicate revoke | One terminal event/pointer deletion; second is idempotent; no inconsistent template. |
| T17 | Revoke races initial authorization | Serializable order; no authorization usable after committed revoke. |
| T18 | Revoke races template activation | One serial outcome; revocation commit leaves no ACTIVE template. |
| T19 | Authorization replay in two sessions | Conditional consume yields one winner and one template mutation. |
| T20 | Authorization expired | No consumption/template mutation. |
| T21 | Initial authorization requested with existing template | Reject; cannot use `replaceExisting` to bypass re-enrollment. |
| T22 | Re-enrollment uses old/revoked grant | Reject; requires new post-revocation grant and distinct authorization. |
| T23 | Authorization subject/purpose differs from grant | Composite FK/controller rejects. |
| T24 | Enrollment request includes `biometricConsent: true` only | Ignored/rejected; no grant or template. |
| T25 | Legacy template with null consent fields | Quarantined and excluded before descriptor decryption. |
| T26 | Template state set ACTIVE with null grant | SQL CHECK/trigger rejects commit. |
| T27 | Template points to different cadet's grant | Composite FK rejects. |
| T28 | Any required consent grant revoked while template ACTIVE | Deferred trigger rejects unless same transaction removes the pointer and quarantines/deletes the template. |
| T29 | Encrypted metadata claims old consent | Does not activate or backfill grant; remains quarantined. |
| T30 | Unsupported/retired policy | Challenge issuance/grant denied; no new current grant. |
| T31 | Guardian provider attempted before policy enablement | Initial DB CHECK and API reject; no evidence/grant accepted. |
| T32 | Staff attempts to set provider or consent timestamp | Server ignores client values; DB/provider constraints reject inconsistent row. |
| T33 | Grant transaction failure after challenge consumption | Full rollback; challenge remains unconsumed or retry resolves idempotently, no partial grant. |
| T34 | Revoke transaction failure after event insert | Full rollback; API does not report success and template remains usable only if grant remains current (no terminal event committed). |
| T35 | Enrollment failure after authorization consumption | Full rollback of consumption and template/audit changes. |
| T36 | Login after biometric revocation | Ordinary login follows normal account/session policy; consent is not queried. |
| T37 | New ordinary registration without biometric data | Registration and OTP/approval workflow do not query consent or create a template. |
| T38 | Manual attendance after revocation | Valid authorized manual mark works under ordinary role/session/leave/duplicate checks. |
| T39 | Account deletion with consent history | Approved Restrict/tombstone/anonymization policy applied; no silent cascade or unexpected permanent block. |
| T40 | Restore backup containing revoked/quarantined template | Tombstone reconciliation quarantines/deletes before service access; no restored biometric matching. |

