# AIT NCC — BSR-03 Final Design Validation

**Final result: REQUIRES INSTITUTIONAL DECISIONS**

The five previously identified technical design gaps now have explicit mechanisms in the final schema proposal and migration plan. The architecture is suitable for institutional review, but schema implementation approval should wait until authorized institutional decisions are recorded in `BIOMETRIC_INSTITUTIONAL_DECISIONS.md`.

## Deliverables

- `BIOMETRIC_CONSENT_SCHEMA_FINAL_PROPOSAL.md` — challenge, subject grant, current pointer, event history, enrollment authorization, quarantine, disabled guardian extension, APIs, and database/service invariants.
- `BIOMETRIC_CONSENT_MIGRATION_PLAN.md` — migration ordering, SQL protections, transaction pseudocode, legacy disposition, rollback/recovery, disposable database plan, and 40-case test matrix.
- `BIOMETRIC_INSTITUTIONAL_DECISIONS.md` — approval register for purposes, policy, guardian/assent, retention/deletion/backups, manual alternative, and authorized access.
- This report — validation evidence, remaining blockers, and safety outcome.

## Five blocker disposition

| Previous blocker | Final design treatment | Status |
|---|---|---|
| Replay-resistant subject consent | Backend CSPRNG challenge; challenge bound by composite relationship to cadet, durable AuthSession, purpose and immutable policy; store token hash only; short TTL; atomic conditional consume; idempotency key plus request fingerprint; subject-only grant endpoint with explicit confirmation separate from challenge issuance. | **Addressed in design** |
| Current-pointer and template integrity | Composite FKs/unique keys; SERIALIZABLE transactions and subject-purpose advisory lock; deferred constraint triggers reject committed current pointers to terminal grants and ACTIVE templates lacking current required-purpose grants; revocation and template quarantine/delete in one transaction. | **Addressed in design; trigger SQL still requires implementation/testing** |
| Legacy-template quarantine | Existing rows default to `QUARANTINED`, null-linked; database checks and deferred triggers prevent activation without matching current consent; every matching path filters state and consent before decryption; metadata-only evidence; no consent inferred from envelopes or audit text. | **Addressed in design** |
| Guardian/minor consent | Separate guardian evidence structure; provider, cadet subject, and staff verifier/witness are distinct; assent/objection have separate event concepts. Initial database check and API policy accept `SUBJECT` only. Guardian route remains disabled until approved policy and future migration. | **Addressed as disabled extension; institutional policy pending** |
| Institutional decisions | Created approval register for nine requested decisions plus operational choices (reauthentication, challenge TTL, witnesses, policy retirement, re-enrollment authority, quarantine duration, DB roles). | **Pending authorized institutional decisions** |

## Prisma validation evidence

The proposed consent models, policy/challenge/grant/event/current/authorization/guardian relations, User/AuthSession back-relations, and optional template linkage were assembled into a temporary schema copy and checked with the repository's Prisma CLI 6.19.3.

- Initial validation identified a one-to-one composite relation requirement for `BiometricConsentGrant.challenge`; the final proposal adds the required composite unique tuple.
- Initial validation also identified a unique tuple requirement for the optional guardian-evidence relation; the final proposal adds that tuple.
- After those corrections, the temporary merged Prisma schema validated successfully.
- This validates Prisma schema syntax and relation structure only. It does not validate PostgreSQL CHECK/trigger SQL, migration locks, current database contents, transaction races, or application behavior.
- Prisma CLI loaded the local `.env` for datasource variable resolution, but `prisma validate` did not connect to a database. No database query or operation was performed. No environment values were printed or changed.
- The temporary validation schema was outside the repository and has been removed. `backend/prisma/schema.prisma` remains unchanged.

## Remaining blockers

### Institutional decisions before schema approval

1. **Permitted biometric purposes:** enrollment/storage and attendance verification must be approved independently. A model enum entry is not authorization.
2. **Consent language/version:** exact text, locale/version scheme, canonical bytes/hash, publication/effective/retirement process.
3. **Guardian eligibility/minor policy:** whether guardian consent is allowed/required, age/competency source, verification, evidence and actor rules.
4. **Cadet assent and objection:** whether assent is required, how objection and later withdrawal affect collection/use.
5. **Consent/audit retention:** periods and legal basis for grants, terminal events, evidence references, access records, and purge authority.
6. **Account deletion/anonymization:** hard-delete, soft-delete, or pseudonymous tombstone; treatment of staff actor references and restrictive FKs.
7. **Backup expiry/restoration:** retention period, restore-time tombstone replay, legal holds, and proof restored templates stay quarantined.
8. **Manual attendance alternative:** confirm an equivalent accessible route and appeal/correction process for cadets who decline or cannot use biometrics.
9. **Authorized personnel/data access:** roles for enrollment authorization, consent review/revocation, evidence access, exports, key access, and separation of duties.

### Separate technical activation gates

- The final PostgreSQL trigger/check implementation has not been written, generated, or executed. The next approved implementation phase must author and test it on a disposable database.
- No migration has been generated or applied; legacy data distribution is unknown because no database was accessed.
- Recognition and PAD weights remain uncleared; server-side capture/inference and real-world reliability remain open. Consent approval does not enable face attendance.
- `ENABLE_BIOMETRIC_ATTENDANCE` must remain disabled.

## Test readiness

The migration plan contains **40 concrete cases**. They cover unauthenticated/staff consent requests, exact challenge binding, expiry, replay/idempotency, concurrent grants, cross-cadet misuse, revoked/stale consent, concurrent revocation/enrollment, one-time authorization/expiry, legacy quarantine, template activation/mismatch, rollback, guardian default denial, manual attendance after revocation, registration/login independence, account deletion, backup restore, and trigger invariants.

No tests were run in this design task. The tests require synthetic fixtures and, for database concurrency/trigger cases, an explicitly approved disposable local PostgreSQL database. No real biometric data is needed.

## Safety and change summary

- Read-only source/schema review plus creation/update of design documents only.
- No database access, migrations, schema edits, application source changes, package installation, model downloads, or attendance-flag changes.
- Existing unrelated working-tree changes were preserved.

## Decision

**REQUIRES INSTITUTIONAL DECISIONS.** The five technical design blockers have design treatments, and the proposed Prisma relationships validate in a temporary merged schema. Authorized institutional decisions remain necessary before schema approval. PostgreSQL trigger implementation and disposable-database migration testing remain later technical execution gates; neither was performed or authorized here.
