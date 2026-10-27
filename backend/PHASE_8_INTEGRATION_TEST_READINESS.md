# Phase 8 — Integration test readiness

## Environment evidence

- Docker CLI is installed, but `docker info` cannot reach the Docker daemon (`~/.docker/run/docker.sock` is absent).
- `pg_isready -h 127.0.0.1 -p 5432` reports a listener. Its owner, database identity and contents are unknown. No `psql`, Prisma or application connection was made to it.
- No disposable database, synthetic accounts or controlled mailbox has been confirmed. No integration workflow was run.
- The known migration blocker remains: `20260929090000_duty_schedule_fields` alters `Duty`, but the local migration history has no preceding `CREATE TABLE "Duty"`. Schema provisioning remains blocked; no migration files were changed.

## Database prerequisites

1. Start Docker locally or have the database owner identify a dedicated disposable PostgreSQL instance. Verify the container/instance identity, database name, ownership and empty state independently. A loopback port or a name containing `test` is not proof. Do not connect to the existing `5432` listener until verified.
2. Use a unique database and test-only role/credential, bind any local container port to `127.0.0.1`, and ensure the database contains no production copy or real cadet data. Keep the credential in a local secret manager or an untracked shell environment, never in source or chat.
3. After migration history is repaired and approved, pass only `DISPOSABLE_TEST_DATABASE_URL`, set `ALLOW_DISPOSABLE_TEST_DB=true` and `NCC_DISPOSABLE_DB_CONFIRMATION=I_CONFIRMED_THIS_IS_AN_EMPTY_DISPOSABLE_TEST_DATABASE`, set `PRISMA_DONT_LOAD_DOTENV=1`, and unset `DATABASE_URL`. The guard rejects non-loopback PostgreSQL and conflicting/fallback URLs. The confirmation is an operator attestation, not an automated ownership check.
4. Start the test API from that same explicit environment. Scripts require a loopback `TEST_API_URL` and `/api/health` reporting `isolatedTestEnvironment: true` before sending workflow requests. `server.ts` now respects `PRISMA_DONT_LOAD_DOTENV=1` instead of loading `.env` during those runs.

## Synthetic identity fixture plan

Use unique generated identifiers, fake names, fake phone values and reserved `.invalid` emails only. Keep generated passwords in the test process/secret manager and never print request bodies, response JSON, tokens, OTPs or profile data. Create synthetic staff fixture identities for `SENIOR`, `PLATOON_SENIOR`, `DRILL_INSTRUCTOR`, and `ADMIN_ANO`; create a Cadet through the normal registration workflow. Do not use the production `seed.ts` for this: it is an upsert utility that can change roles/status/passwords for matching emails and creates only the privileged roles it defines.

ANO and Admin are two possible UI personas but both map to backend `ADMIN_ANO`. They share server authorization and cannot be tested as different backend permissions without a supported backend role distinction. For UI coverage, use two synthetic `ADMIN_ANO` identities only if separate operator personas are useful; expect identical backend privileges.

For registration tests, create a pending synthetic Cadet and advance it through real Senior → Platoon Senior → ANO APIs. Do not activate the account directly in SQL or through a fixture shortcut. Verify status and reviewer history by sanitized API read-back.

## OTP/mail prerequisites

`sendOtpEmail` currently returns a mock success for `NODE_ENV=test` or `PURE_MOCK_TEST=true`. `sendOtpSms` also returns mock success in those modes, so authentication OTP acceptance does not prove dispatch either. A real email OTP integration test is blocked until an explicitly test-only mail adapter targets a local approved sink (for example, Mailpit bound to loopback) or an authorized controlled mailbox. Testing SMS dispatch needs an approved SMS sink/test number or provider sandbox; never use a real cadet phone. The safe default must remain no external mail/SMS; test email delivery must reject non-loopback SMTP hosts and non-synthetic `.invalid` recipients. Do not query OTP hashes or replace them with a known code. Read a code only inside the test process from the isolated sink, and redact it from logs/errors.

## Integration test matrix to run after prerequisites

| Workflow | Planned assertions |
|---|---|
| Login/session | Valid synthetic account and OTP succeeds; invalid credentials/OTP fail; role comes from server; protected `/me`, expiry, logout and session revocation behave correctly. |
| Recovery | Server accepts request only after sink dispatch; controlled inbox receives code; valid reset succeeds; wrong, expired, reused and rate-limited codes fail; old password fails and new password works. |
| Authorization | For each of the five backend roles, allowed requests succeed and forbidden actions return 401/403; include Cadet, Senior, Platoon Senior, DI and `ADMIN_ANO`; ANO/Admin share expected results. |
| Registration | Cadet registration, Senior review, Platoon Senior review, ANO final decision; verify each status transition, reviewer history and final activation. |
| Attendance/leave | Authorized session operator, one mark, duplicate rejection, closed-session rejection, approved-leave conflict, permitted correction and existing review hierarchy. |
| Persistence | Create/read-back synthetic notice, camp, inquiry/reply and workflow records; verify server response and subsequent API reads. Clean up only run-tagged synthetic records in the disposable database. |

## Existing script limitations

- `src/scripts/verify_auth_recovery.ts` is loopback/API-health and disposable-DB guarded, but is not valid OTP evidence: it directly changes a new Cadet to active, reads the reset record, overwrites the OTP hash with a fixed code, and prints identifiers/profile or raw error JSON. It also leaves test records behind. Do not run it as written.
- `src/scripts/verify_workflow.ts` uses the guarded loopback API and configured reviewer credentials, but prints user/profile details, uses a real-looking institutional email domain and phone, has no cleanup, and does not cover all roles or attendance/leave. Do not run it as written.
- Current `npm test` suites are isolation, public-route and security/unit tests; they are not database/mailbox integration tests.

No test in this phase is claimed passed beyond the existing mock-only automated suites. Integration remains **BLOCKED** pending the isolated database and migration repair, synthetic identities, and approved mail-sink adapter.
