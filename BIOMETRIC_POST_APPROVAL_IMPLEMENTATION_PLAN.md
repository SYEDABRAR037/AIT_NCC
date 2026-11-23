# AIT NCC — Post-Institutional-Approval Implementation Plan

**Prepared:** 2026-11-22  
**Scope:** Evidence review and implementation/test preparation only.  
**Actions performed:** Read repository documents and local configuration names/source; no database connection, migration, source/schema edit, model installation, or feature-flag change was performed.

## Executive status

The supplied statement that institutional approval has been received is not supported by the approval artifacts currently in this repository. `BIOMETRIC_INSTITUTIONAL_DECISIONS.md` says all decisions are pending. The approval pack has blank decision and signature fields and says it is a proposal, not authorization. The BSR-03 validation and migration plan also still say institutional decisions are required. Therefore no decision is classified as approved in this plan.

The consent schema and transaction design are proposals only. No migration is generated or applied, PostgreSQL trigger SQL is not implemented/tested, and attendance remains disabled. Do not proceed to policy-dependent implementation or migration until signed decision evidence is recorded and scope is clear.

## 1. Institutional approval evidence

### Evidence inspected

- `BIOMETRIC_INSTITUTIONAL_DECISIONS.md`: all nine listed institutional decisions and all seven additional operational decisions are marked **PENDING**. It requires approver name/role, decision date, exact decision, scope, and evidence reference.
- `AIT_NCC_BIOMETRIC_INSTITUTIONAL_APPROVAL_PACK.md`: proposal document; each decision field is blank; the overall disposition and signature fields are blank. It expressly states it does not record approval.
- `BIOMETRIC_BSR03_FINAL_VALIDATION.md`: result is **REQUIRES INSTITUTIONAL DECISIONS**; identifies institutional blockers as pending.
- `BIOMETRIC_CONSENT_MIGRATION_PLAN.md`: planning only; says institutional decisions and separate schema/migration approval are still required.

### Classification

| Category | Evidence-based result |
|---|---|
| Explicitly approved decisions | None found in the inspected records. |
| Rejected decisions | None recorded. |
| Conditional approvals | None recorded as an approval. The documents contain proposed safeguards and approval gates, but these are not signed conditional decisions. |
| Unresolved decisions | All nine institutional decisions and seven additional implementation decisions remain pending (listed below). |
| Decisions without supporting evidence | Every claimed approval lacks a completed decision entry or cited signed minutes/letter/resolution in the inspected package. The user's statement is noted but is not repository evidence of which decisions, conditions, authority, or scope were approved. |

### Unresolved institutional decisions

1. Permitted biometric purposes, each approved or rejected independently.
2. Exact consent text, translations/locales, version/hash, effective date, publication and retirement authority.
3. Guardian eligibility/minor consent, verification evidence and exception handling.
4. Cadet assent, objection and withdrawal policy.
5. Consent, evidence, audit and access-log retention and purge authority.
6. Account deletion/anonymization and treatment of consent/actor history.
7. Backup expiry, legal holds, deletion propagation and restore-time tombstone/quarantine controls.
8. Equivalent accessible manual attendance and appeal/correction route.
9. Authorized roles for enrollment, consent/evidence access, revocation, export, deletion and key administration.
10. Recent re-authentication requirements; challenge lifetime and session/logout invalidation.
11. Whether staff may witness consent and under what role/evidence controls.
12. Effect of policy-version retirement on existing grants.
13. Re-enrollment authority and documented reason.
14. Legacy-template quarantine duration and deletion authority.
15. Database trigger ownership, runtime privileges and privileged retention process.

**Evidence needed to change status:** attach or cite an authorized signed record for each decision, with reviewer designation, date, exact decision, conditions, scope, policy reference, and approval identifier. Update the decision register only after that evidence is available. A broad project approval must not be treated as approval of every purpose, migration, model, or activation gate.

## 2. Consent implementation preparation checklist

The checklist below translates the final schema/API proposal and migration plan into implementation work. It is not authorization to implement the schema or run migrations.

### Subject consent challenge issuance

- [ ] Publish an immutable, approved policy record with exact purpose, version, locale and canonical text hash.
- [ ] Enable a purpose in the server policy registry only after its specific approval is documented.
- [ ] Require authenticated cadet identity and a durable, valid session; reject staff-submitted subject IDs and legacy sid-less sessions for consent actions.
- [ ] Generate a cryptographically random one-time challenge; persist only a cryptographic hash.
- [ ] Bind challenge to authenticated subject, durable session, purpose, exact policy record/hash, issue time and expiry.
- [ ] Select and document challenge TTL/session-invalidation behavior only after the responsible security owner decides it.
- [ ] Do not treat challenge issuance as consent; rate-limit issuance and return no biometric data.

### Subject consent grant and history

- [ ] Present the exact approved policy text, purpose, version and hash before confirmation.
- [ ] Require explicit affirmative confirmation through a subject-only endpoint; derive provider and timestamp server-side.
- [ ] Consume the matching challenge with a conditional atomic update in the same transaction as grant/event/current-pointer creation.
- [ ] Use idempotency key plus request fingerprint; same request may resolve consistently, but a changed/replayed request must conflict.
- [ ] Enforce subject/purpose current uniqueness and immutable grant/published-policy history using database constraints/privileges and service validation.
- [ ] Store consent evidence only as approved; do not collect extra identity evidence by default.

### Consent revocation and fresh consent

- [ ] Permit the subject to revoke only their own current grant unless a separately approved staff-assisted route is designed.
- [ ] In one transaction, append terminal revocation event, remove current pointer and quarantine/delete dependent template according to the approved retention decision.
- [ ] Add deferred database enforcement so no committed current pointer references a terminal grant and no active template remains without its required current consent.
- [ ] Require a new challenge and explicit subject confirmation after revocation; never restore a grant or consent state through a staff boolean.
- [ ] Ensure login, registration, portal access, account review and manual attendance do not query biometric consent.

### Enrollment authorization and consumption

- [ ] Scope staff authorization to the cadet assignment, current purpose grant, eligibility and approved role matrix.
- [ ] Initial enrollment requires no existing template; re-enrollment requires a fresh subject grant after the prior terminal event and a separate authorization.
- [ ] Bind authorization to subject, grant, purpose, issuer, expiry, type and idempotency key.
- [ ] Atomically consume authorization with a conditional update (`unconsumed AND unexpired`) in the same transaction as template create/replace; exactly one concurrent consumer wins.
- [ ] Reject client-supplied consent provider/time, `biometricConsent` authority, `replaceExisting` authority, trusted status, descriptor and quality claims as authorization evidence.

### Template linkage and legacy quarantine

- [ ] Add nullable template-to-grant linkage and explicit lifecycle state only through approved schema work; maintain exact composite subject/purpose relations.
- [ ] Default existing templates to `QUARANTINED`, with null consent linkage; never infer consent from encrypted payloads, past staff actions or audit text.
- [ ] Make quarantine fail-closed in both database constraints/triggers and every matching query before decryption.
- [ ] Do not activate a template solely because fresh consent exists; require separately authorized enrollment plus future cleared capture/model validation.
- [ ] Preserve metadata-only disposition evidence; follow the approved quarantine retention/deletion and backup rules.

### Guardian path

- [ ] Keep guardian provider/API/database acceptance disabled by default. Initial implementation permits `SUBJECT` provider only.
- [ ] Do not implement guardian consent until signed institutional policy defines eligibility, evidence, verifier, assent/objection and retention.
- [ ] Keep guardian provider, cadet subject and staff witness/verifier as separate identities if later approved; do not store identity documents in biometric tables by default.

## 3. PostgreSQL disposable test preparation

### What local configuration shows (without connecting)

- `backend/src/start.ts` loads the backend `.env` via `dotenv.config()` unless `PRISMA_DONT_LOAD_DOTENV=1`; it defaults `DIRECT_URL` to `DATABASE_URL` in the normal single-URL case.
- `backend/.env` and `backend/.env.test` exist. Their values were not printed. The test file contains the fail-closed mock sentinel and `PRISMA_DONT_LOAD_DOTENV=1`; it is intended for mocked tests, not PostgreSQL integration.
- The required database connection names are `DATABASE_URL` and `DIRECT_URL`; Prisma schema reads both.
- `backend/src/databaseSafety.ts` permits a test DB only when `ALLOW_DISPOSABLE_TEST_DB=true`, `DISPOSABLE_TEST_DATABASE_URL` is explicitly provided, the URL is local loopback, and the database name contains `test` or `mock`. It requires `NCC_DISPOSABLE_DB_CONFIRMATION=I_CONFIRMED_THIS_IS_AN_EMPTY_DISPOSABLE_TEST_DATABASE`, rejects conflicting inherited URLs, then sets both Prisma URLs to that disposable URL.
- Existing `docker-compose.yml` starts a persistent `ncc_postgres_db`, exposes port 5432, mounts `ncc_pgdata`, and defaults `POSTGRES_DB` to `ncc_command_db`. Do not use that compose service or volume for disposable biometric tests.
- No PostgreSQL instance status, active database identity, or `.env` value was queried. No database was accessed.

### Required future environment values

Use a separate local PostgreSQL instance/container and a newly created, uniquely named empty database such as `ncc_biometric_test_<run-id>` (name must include `test`). Set only for the authorized test process:

| Variable | Required value/handling |
|---|---|
| `NODE_ENV` | `test` for test harness. |
| `PRISMA_DONT_LOAD_DOTENV` | `1` for application/test processes that honor the repository guard; do not rely on this alone for Prisma CLI. |
| `ALLOW_DISPOSABLE_TEST_DB` | `true` only for the dedicated disposable database test task. |
| `DISPOSABLE_TEST_DATABASE_URL` | PostgreSQL URL using `127.0.0.1`/`localhost` and database name containing `test`/`mock`; credentials must belong to the isolated test instance. |
| `NCC_DISPOSABLE_DB_CONFIRMATION` | Exact guard confirmation string above, set only after the database is verified empty and isolated. |
| `DATABASE_URL`, `DIRECT_URL` | Unset inherited values or set both to exactly the same disposable URL; never allow backend `.env` values to be used. |
| `NCC_TEST_DATABASE_ISOLATED` | Set by the guard when the explicit disposable database is accepted; integration fixtures should also assert this. |

Do not put credentials in source, shell history, command output, screenshots, or reports. Inject them through a protected local environment mechanism. Do not use `NCC_UTILITY_DATABASE_URL` or production-prefight/seed opt-ins for this test plan.

### Isolation and identity procedure (future authorized test task only)

1. Stop before any database operation until a separate task authorizes disposable PostgreSQL testing and the institution’s required design approvals are evidenced.
2. Use a dedicated temporary PostgreSQL container/cluster on a loopback-only alternate port with a unique container and temporary storage. Do not attach `ncc_pgdata`, use the existing compose DB service, or point at `ncc_local_dev`.
3. Create a uniquely named empty database and dedicated test role inside that isolated instance. Never create/drop databases on an existing NCC instance as part of this plan.
4. Set the explicit test URL and guard variables. Remove/unset inherited `DATABASE_URL` and `DIRECT_URL` first; fail if either differs from the disposable URL.
5. Before migration/test writes, use a read-only connection to assert `current_database()` exactly equals the unique test database, server address is loopback, and the expected dedicated role is active. Abort on any mismatch. Save sanitized evidence without credentials.
6. Apply migrations only to that verified disposable database using the specific reviewed migration command; never use `npm run prisma:migrate` blindly because it invokes `prisma migrate dev` and may load backend `.env` values.
7. After tests, capture sanitized logs/results, disconnect clients, and destroy only the uniquely named disposable container/storage. Preserve any approved test artifact backup separately; do not touch other containers, volumes, or databases.

### Backup and recovery rehearsal

- Before migration tests, take a custom-format `pg_dump` of the empty disposable baseline and record its checksum outside the database. Before rollback/recovery tests, take another dump containing only synthetic fixtures.
- Restore a dump only into a *second, newly created disposable recovery database* after identity verification. Do not restore over any existing NCC database and do not use `--clean` against a shared target.
- Test restore-time revocation/deletion tombstone replay and ensure all old templates remain quarantined before service/test traffic is allowed.
- Keep dump files access-restricted and short-lived; remove only the exact test artifacts according to the approved retention decision. Do not represent local database deletion as backup erasure.
- No backup, restore, container, database, or migration command was run for this plan.

### Future command sequence (examples; not executed)

The following is a controlled sequence template, not permission to run it now. Replace placeholders through a protected environment, and verify the target identity before every write. A dedicated isolated PostgreSQL container must already be running on loopback and the database must be empty.

```sh
cd backend

# Provide these values from a protected local environment, not from this file:
# DISPOSABLE_TEST_DATABASE_URL=postgresql://<test-role>:<secret>@127.0.0.1:<test-port>/ncc_biometric_test_<run-id>?schema=public
# export NODE_ENV=test PRISMA_DONT_LOAD_DOTENV=1
# export ALLOW_DISPOSABLE_TEST_DB=true
# export NCC_DISPOSABLE_DB_CONFIRMATION=I_CONFIRMED_THIS_IS_AN_EMPTY_DISPOSABLE_TEST_DATABASE
# export DATABASE_URL="$DISPOSABLE_TEST_DATABASE_URL" DIRECT_URL="$DISPOSABLE_TEST_DATABASE_URL"

# Verify database name/host/role using a read-only psql query before any writes.
# Then, after separate migration authorization and reviewed migration files:
npx prisma validate
npx prisma migrate deploy

# Apply only the PostgreSQL integration suite configured to use the explicit
# disposable URL and the repository database-safety guard; never fallback to .env.
npm run test:biometric
```

`npm run test:biometric` currently runs mock/controller tests, not a proven PostgreSQL trigger/concurrency suite. A separate integration test target must be implemented/approved and must call the existing isolation guard. Do not run the example commands until that is done and authorized.

### Trigger and concurrency test plan

- Invalid current pointer to a revoked/superseded grant fails at commit.
- Active template with missing, stale, wrong-subject, wrong-purpose, or terminal consent fails at commit.
- Null-linked template remains quarantined and excluded before any decrypt/match call.
- Revoke and enroll concurrently under the same subject-purpose lock: either enrollment commits first and revocation atomically quarantines it, or revocation commits first and enrollment fails; no invalid active state commits.
- Two grants for same subject/purpose, two uses of one challenge, and two uses of one enrollment authorization: exactly one durable result; duplicate/replay receives idempotent result or conflict according to the approved API contract.
- Inject failures after challenge consume, event insert, pointer update, authorization consume, template write, and audit/outbox write; verify full rollback or durable retry record.
- Exercise PostgreSQL deferred constraint trigger behavior at transaction commit and with concurrent transactions; test under the intended PostgreSQL major version and runtime DB role.
- Verify purpose-specific attendance consent separately from enrollment consent; manual attendance continues after biometric revocation.

## 4. Prioritized remaining security work

Ordering is based on the findings in `BIOMETRIC_FINAL_SECURITY_REVIEW.md`; no fix is claimed by this checklist.

| Priority | Finding / work | Evidence and next verification |
|---|---|---|
| P0 — before any biometric use | **BSR-02 / BSR-06:** stop trusting browser descriptors, quality claims and capture-status values; design trusted server-side capture/inference and separately cleared PAD. | Current security review confirms caller-controlled descriptor/quality inputs and no PAD/server inference; current templates are marked `CLIENT_UNATTESTED` and fail closed. Keep feature disabled. Add tampering, image-origin and PAD tests after approved model selection. |
| P0 — before consent schema approval | **BSR-03:** implement durable subject-bound grant, history, revocation, current pointer, authorization, atomic consumption, template linkage and legacy quarantine. | Existing enrollment accepts `biometricConsent` and replacement authority; revocation deletes template without durable re-enrollment gate. Requires signed institutional choices, separate schema approval, migration plan approval, then implementation. |
| P0 — policy and privacy | Evidence all institutional decisions; approve policy text/version/purposes, retention, deletion, manual alternative and access matrix. | Current decision register has all pending; approval pack blank. No policy or legal compliance status may be inferred. |
| P1 — before verification rollout | **BSR-04:** phase out/reject sessionless legacy tokens for protected attendance/biometric operations. | Test session revocation across old token forms and route access. |
| P1 — before multi-worker/runtime use | **BSR-05:** replace global in-memory challenge state with a bounded per-actor/session store and atomic one-use consumption, or formally constrain and enforce single-process operation. | Test rate limits, cross-worker consume, restart, expiry and store outage fail-closed. |
| P1 — before attendance activation | **BSR-07:** make duplicate attendance claim and success-side effects atomic/idempotent. | PostgreSQL race test: one row, one winning success, one duplicate result, one notification/audit action. |
| P1 — audit integrity | **BSR-08:** decide whether audit is mandatory; use same transaction or reliable outbox and minimize direct identifiers. | Failure injection must prove no untracked committed biometric attendance action. |
| P1 — operations | **BSR-09:** document and validate key custody, rotation, backup/recovery, access, incident response, and logs. | Source reads keyring from environment; actual operational controls are unverified. Test rotation and old-key retirement without exposing values. |
| P1 — data lifecycle | **BSR-10:** distinguish active-row deletion from complete lifecycle erasure; implement approved retention/backup restore behavior. | Source review cannot verify backups/replicas/exports. Validate active row in isolated DB and operational copies separately. |
| P1 — status discrepancy | **BSR-01:** current registration source appears to omit biometric fields/template creation and labels enrollment optional, but older security/progress docs conflict and tests were not run here. | Inspect optional-registration test and execute focused backend/frontend tests in a later authorized test task; update progress/security status only after evidence. |
| P2 — readiness evidence | Perform model/license/provenance clearance, controlled non-biometric fallback testing, accessibility and real-world reliability evaluation before any activation request. | Tracker says maintainers not contacted and no recognition/PAD weights cleared; no liveness or real-world metrics established. |

## 5. Documentation status and progress tracking

No existing progress or approval document was changed. This is intentional:

- Institutional decision records remain pending and no supporting approval artifact was found.
- The current registration source shows ordinary fields only, no face descriptor/consent/quality fields, no `BiometricTemplate` creation in the registration transaction, and explicit optional-enrollment text. However, the security review still reports BSR-01 as mandatory and progress snapshot text still describes face capture in registration. With no tests run in this read-only planning task, BSR-01 should be treated as **source appears corrected; verification and document reconciliation pending**, not marked complete.
- Existing Phase statuses in `BIOMETRIC_IMPLEMENTATION_PROGRESS.md` are left unchanged; this task provides no executed test evidence or signed institutional decisions sufficient to advance them.

## 6. Exact next implementation tasks and approval gates

1. **Institution/project owner:** provide the signed institutional approval record and complete each applicable row in `BIOMETRIC_INSTITUTIONAL_DECISIONS.md`, including scope and conditions. Resolve all 15 listed decisions or explicitly document which are not applicable and why.
2. **Privacy/policy authority:** approve purpose-by-purpose consent language, guardian/minor/assent policy, retention/deletion/backups, manual attendance, and access matrix. No guardian path by default.
3. **Security/database owner:** approve the exact final Prisma/SQL design, trigger ownership/privileges, and disposable PostgreSQL test procedure. Production migration approval is a separate decision.
4. **Engineering:** reconcile BSR-01 documentation and run isolated tests for registration without biometric fields; preserve OTP and account approval behavior.
5. **Engineering/security:** implement BSR-03 only after schema approval: challenge/grant/event/current-pointer APIs; transaction/locking/idempotency; revocation; re-enrollment authorization and atomic consumption; template linkage; quarantine; guardian deny-by-default.
6. **QA/database owner:** create a dedicated disposable local PostgreSQL instance/database, verify identity, run migration and trigger/concurrency/rollback/backup-restore suites there only, and retain sanitized evidence.
7. **Security engineering:** resolve BSR-02/06 server-side capture/inference and PAD; do not select/download/install weights until exact licenses and provenance are cleared.
8. **QA/privacy authority:** run synthetic, then separately approved controlled participant evaluation for false acceptance/rejection, spoof/PAD, accessibility and operational error handling. No real cadet biometric data before appropriate separate authorization.
9. **Institutional authority:** review a separate activation request only after all required gates and manual alternative evidence are complete. Until then, keep `ENABLE_BIOMETRIC_ATTENDANCE` disabled.

### Current unresolved approvals

- All 9 institutional policy decisions and all 7 operational choices listed in Section 1.
- Separate approval of final schema and migration plan; this task does not provide it.
- Separate authorization to create/use a disposable PostgreSQL database and run migration/integration tests.
- Recognition and PAD model/weight licensing and provenance clearance.
- Privacy/legal review, including cadet/minor safeguards and retention decisions.
- Separate future biometric attendance activation decision.

**Current outcome:** Preparation only. Institutional approval is **not evidenced in the reviewed repository records**; consent implementation and migrations are **not authorized by this document**; biometric attendance remains disabled.
