# Safe integration testing and backup plan

## Disposable local database

Do not connect to a local PostgreSQL listener until its owner confirms that the target is a dedicated empty disposable database. A loopback port and a database name containing `test` or `mock` do not prove isolation. In Phase 8, `pg_isready` found a PostgreSQL listener at `127.0.0.1:5432`, but its owner/database were not verified; no connection was made. Docker's daemon was unavailable.

After an operator has created and independently verified a disposable target, configure only its URL. Never copy the production URL into a test shell. The guard rejects remote hosts and `DATABASE_URL` fallback, and now also requires an explicit isolation attestation:

```sh
export NODE_ENV=test
export PRISMA_DONT_LOAD_DOTENV=1
export ALLOW_DISPOSABLE_TEST_DB=true
export NCC_DISPOSABLE_DB_CONFIRMATION=I_CONFIRMED_THIS_IS_AN_EMPTY_DISPOSABLE_TEST_DATABASE
export DISPOSABLE_TEST_DATABASE_URL='postgresql://<test-role>@127.0.0.1:<test-port>/<unique-test-db>?schema=public'
unset DATABASE_URL
```

The attestation is a guardrail, not proof by itself. The operator must verify the container/database identity and that it contains no real data before setting it. Provision schema only after the migration history is repaired. A clean `prisma migrate deploy` currently stops at `20260929090000_duty_schedule_fields`: it alters `Duty`, but no migration creates that table. Do not work around this with a production URL. For mock-only tests, keep `PURE_MOCK_TEST=true` and leave the disposable-database flag unset.

## Synthetic role accounts and mail

- Create fixtures only after the disposable database schema can be provisioned safely. Use synthetic names, unique `TEST-*` regimental/college identifiers, reserved `.invalid` email addresses and generated one-time passwords. Keep secrets outside Git; never reuse real accounts or credentials. Set all accounts to the status required by the real login flow through a test-only fixture, not a public endpoint or production seed.
- Cover all six UI panels with six fixtures: Cadet=`CADET`, Senior=`SENIOR`, Platoon Senior=`PLATOON_SENIOR`, Drill Instructor=`DRILL_INSTRUCTOR`, ANO=`ADMIN_ANO`, Admin=`ADMIN_ANO`. The backend defines five roles, so ANO and Admin remain separate synthetic users with the same server-side role and permissions; do not imply they have distinct backend RBAC.
- For registration hierarchy tests, use an additional synthetic cadet initially in the normal pending state and advance it through Senior → Platoon Senior → ANO via the real APIs. Verify each reviewer and final status in API read-back; do not skip a stage by directly changing status.
- OTP plan: use a local SMTP capture service bound to loopback or an explicitly approved isolated staging mailbox, with a dedicated synthetic `.invalid` or controlled test recipient. The current service mocks all mail in `NODE_ENV=test` and has no capture adapter, so receipt is currently **BLOCKED**. Add an explicit test-only adapter before attempting delivery; it must be impossible to select in production. Read the OTP only from the controlled mailbox, never logs or database rows. Verify dispatch acceptance before UI advances, valid OTP reset, wrong OTP rejection, expiry, single use, reuse rejection and rate-limit behavior. Confirm the old password fails and the new password works. No real cadet or institutional mailbox is permitted.
- Start the API with the same explicit disposable URL and `NODE_ENV=test`. The recovery/workflow scripts require `TEST_API_URL` on loopback and send no workflow requests unless `/api/health` confirms `isolatedTestEnvironment: true`.

## Cross-client disposable workflow checklist

Run only after the migration blocker below is repaired and a fresh disposable database migrates cleanly. Bind the local API to loopback and point both local website and Flutter Web builds at it. Keep fixtures and database unique to this run.

1. Log in separately with each of the six synthetic panel accounts; verify role resolution, protected-route denial for unauthorized operations, refresh/session behavior and logout.
2. Register a synthetic cadet. Senior forwards, Platoon Senior forwards, and ANO makes the final decision using the real UI/API sequence. Read back the reviewer history and final state through the API.
3. Submit and review a synthetic leave request through the configured hierarchy. Open a synthetic attendance session, mark attendance once, reject a duplicate, reject attendance conflicting with approved leave, and verify closed-session restrictions.
4. Create a notice, camp/event and inquiry using their authorized UI workflows. Read each from the other client; submit an inquiry reply and read it back in both. Verify failed requests and interrupted connectivity show an error and do not claim an unsaved write succeeded.
5. Confirm every write through API read-back before comparing website and Flutter displays. Clean up only this run's synthetic records in this disposable database after evidence capture; never use production cleanup paths.

Until those checks run, cross-client authenticated persistence remains **NOT VERIFIED**. Current unit/mocked tests do not substitute for this workflow.

## Utility scripts

`verify_auth_recovery.ts` registers a cadet, changes the account to `ACTIVE` directly, requests recovery, overwrites the OTP hash with `482731`, resets the password and leaves its created records behind. It uses an institutional-looking email address. It bypasses approval and OTP issuance, so it cannot establish those behaviors.

`verify_workflow.ts` logs in as configured Senior, Platoon Senior and ANO accounts, registers a cadet, advances reviews through ANO approval, and reads assigned rosters and a profile dossier. It has no cleanup and logs personal-looking profile fields. It previously defaulted to `localhost:5050`, which could point at an API server backed by a non-test database.

`verifyTestNotif.ts` upserts two cadets, creates an attendance session and attendance records, sends notifications, and leaves records in the database. `seed.ts` upserts platoons and three privileged accounts, including role/status/password changes for matching emails. `cleanForLaunch.ts` currently reads aggregate table counts; its `--execute` path deliberately aborts before deletion. These helpers now require explicit database targets. The seed and read-only preflight have separate non-local opt-ins; test-mode utility scripts require the dedicated disposable URL and cannot use either production opt-in.

## Render-owner handoff: migration evidence required

Production compatibility of the `Duty` repair is **UNVERIFIED**. The owner should use an explicitly read-only database role and return only sanitized metadata (no connection string, credentials, user rows or cadet data):

- Export the `_prisma_migrations` metadata columns `migration_name`, `checksum`, `started_at`, `finished_at`, `rolled_back_at`, and `logs`/error status for all migrations. In particular, identify whether `20260929090000_duty_schedule_fields` is applied, failed or absent. Compare checksums against local `migration.sql` files before considering any migration edit.
- Inspect schema metadata only: whether `Duty` exists; `reportingTime`, `startTime`, `endTime` types, nullability and defaults; and the definitions of its primary/foreign-key constraints and indexes. Do not query `User`, `Duty`, or any other business table rows.
- Preserve the result as a sanitized evidence table with migration name/status/checksum match and Duty columns/constraint/index definitions. If the migration failed, include only the error text needed to identify the failure, with identifiers/secrets removed.

The read-only query scripts are:
- [inspect_duty_migration_readonly.sql](prisma/inspect_duty_migration_readonly.sql): Focused on the Duty schedule migration and `public."Duty"` schema.
- [inspect_schema_and_migrations_readonly.sql](prisma/inspect_schema_and_migrations_readonly.sql): Audits the entire `_prisma_migrations` ledger and candidate table existence/definitions for the 9 models missing checked-in migrations (`LeaveReviewRecord`, `Request`, `RequestHistoryRecord`, `InquiryReply`, `TimelineEvent`, `BiometricTemplate`, `Certificate`, `AttendanceNotification`, `PasswordReset`) plus `Duty` and security tables.

Both scripts run inside `BEGIN READ ONLY`, select only ledger and PostgreSQL catalog metadata, and rollback the read-only transaction. They never select business rows, user data, or personal identifiers.

**Owner-run usage:** a DBA must first configure a libpq service profile named `ait-ncc-prod-readonly` outside the repository, using an explicitly authorized read-only account. Keep authentication in the DBA's protected credential manager or permission-restricted `.pgpass`; do not put credentials in shell history, this repository, or chat. Grant only `SELECT` on `public."_prisma_migrations"` and catalog views. Then run from the repository root:

```sh
# Full schema and 9-model audit
psql 'service=ait-ncc-prod-readonly' -X -v ON_ERROR_STOP=1 \
  --file backend/prisma/inspect_schema_and_migrations_readonly.sql

# Focused Duty migration audit
psql 'service=ait-ncc-prod-readonly' -X -v ON_ERROR_STOP=1 \
  --file backend/prisma/inspect_duty_migration_readonly.sql
```

The service profile must point to the intended production database and use TLS as required by its owner. Review the displayed `transaction_read_only` value before sharing sanitized output. Do not replace the service profile with generic `DATABASE_URL`; do not send its connection details to Codex. If the owner cannot provide this explicitly read-only profile or metadata permissions, mark the comparison blocked.

Repair decision after that evidence: absent `Duty` or a legacy table lacking both schedule columns may be compatible with a new earlier baseline migration followed by the current migration. If either schedule column already exists while the current migration is pending/failed, the unmodified `ADD COLUMN` statements will collide; an idempotent edit would change the checksum if already recorded as applied. Do not choose or apply a repair until the recorded state and schema are compared. The local candidate tests do not establish production history.

## Low-cost backup and restore plan (proposal only)

Render PostgreSQL settings and backup availability have not been verified because owner access is unavailable. No artifact or restore has been verified. First ask the service owner to confirm current backup/retention controls and export permissions read-only; do not infer them from deployment configuration.

Lowest-cost safe fallback, if managed backups are unavailable and the owner authorizes it: run daily `pg_dump -Fc` from a restricted owner-controlled runner using a dedicated least-privilege export role; encrypt each artifact before saving it to access-controlled storage; keep a short daily and weekly retention set sized to available storage; alert on missed/failed runs; and back up uploaded media separately. Keep secrets in that runner's secret store, never in scripts or chat. Measure the actual artifact size and storage cost before choosing offsite retention; do not enable a paid service without approval.

Quarterly, restore a copy into a separate isolated PostgreSQL database, verify schema/migration state and synthetic records, then record elapsed restore time. Set RPO/RTO only after the owner accepts measurable targets; 24-hour RPO and 4-hour RTO are initial proposals, not verified capability. No export, external storage setup, plan change or production restore is authorized by this guide.
