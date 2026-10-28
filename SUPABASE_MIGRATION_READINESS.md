# NCC AIT hosting and Supabase migration readiness

**Status: NO-GO for cutover.** This document records a local, static review only. No provider dashboard, external service, production database, or local database was accessed. No migrations were run. The existing worktree and migration files were preserved.

## Budget and hosting decision (₹0)

**No-go for production at ₹0.** Railway Hobby is not free (minimum $5/month, with usage overage possible). Koyeb Free can host a preview Node service, but its free instance is 512 MB RAM/0.1 vCPU and scales to zero; Koyeb documents it for preview/hobby rather than production. Supabase Free projects can pause after inactivity and have no downloadable managed backups. For reliability of institutional records, use these free tiers only for isolated synthetic-data testing; do not move production records or the live clients there. [Railway plans](https://docs.railway.com/pricing/plans), [Koyeb instance limits](https://www.koyeb.com/docs/reference/instances), [Supabase free-tier pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [backup availability](https://supabase.com/docs/guides/platform/backups).

For a disposable preview only, configure Koyeb's Node service root as `backend`, build with `npm ci && npm run build`, run with `npm start`, and set the HTTP readiness path to `/api/health/ready`. The new readiness endpoint checks the Prisma/PostgreSQL path and returns only generic 503 status on failure; `/api/health` remains a liveness endpoint. These settings are a template, not a configured provider or proof of migration success. The root package's existing `start` script now resolves through the backend's added start command.

The backend also starts notification delivery in the API process. Preview must use synthetic records and must not have real mail/SMS/push credentials. Keep one instance; do not add replicas without proving notification leasing/idempotency and shared rate-limit behavior.

## Supabase connection and TLS plan

Supabase is PostgreSQL-compatible with Prisma. Select the connection mode based on the deployed host's network:

- For a persistent API with IPv6 reachability, Supabase recommends the direct database endpoint for runtime.
- If the API host is IPv4-only, use Supavisor **session mode** (port 5432) for runtime. Confirm the mode and username in the project's Connect dialog; do not construct the host from a project ID.
- Do not use transaction mode (port 6543) as the default for this persistent API. It has session-state limitations and requires Prisma's `pgbouncer=true` handling for prepared statements.
- Use a direct PostgreSQL connection for migration operations where available. If the migration runner cannot reach the IPv6 direct endpoint, have an authorized migration runner use a supported session-mode connection. Do not run migrations from a serverless function.

Supabase specifically documents direct/session/transaction choices, connection limits, and Prisma's transaction-pooler setting. [Connection options](https://supabase.com/docs/guides/database/connecting-to-postgres), [pooling and limits](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits), [Prisma troubleshooting](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting).

The current Free plan allows two projects, includes a 500 MB database-size quota, 5 GB egress, and 1 GB file storage; inactive projects may pause after one week. Free projects do not include downloadable automatic database backups. Supabase recommends regular exports and off-site backups for Free projects. The published Pro plan starts at $25/month and includes daily backups with seven-day retention; compute/usage and region-specific charges must still be checked in the dashboard before approval. For this cadet-record system, treat Free as staging/development only unless an owner accepts and verifies a separately maintained backup/restore process. [Supabase billing limits](https://supabase.com/docs/guides/platform/billing-on-supabase), [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [backup availability](https://supabase.com/docs/guides/platform/backups), [current pricing](https://supabase.com/pricing).

Require TLS. Prefer `sslmode=verify-full` with Supabase's downloaded CA certificate configured for the Prisma/Node runtime; `sslmode=require` encrypts but does not verify server identity. Enforce SSL for incoming database connections in Supabase only after confirming every authorized client has TLS configured. Test CA rotation, connection timeout, pool exhaustion, transaction behavior, and recovery after a stale connection in staging. [Supabase SSL guidance](https://supabase.com/docs/guides/database/connecting-to-postgres#ssl), [SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement).

Use a small Prisma connection limit initially and budget the sum across API replicas, background workers, migration runners, and administrative sessions against the selected Supabase compute/pool limits. Increase it only after observing queueing and pool metrics. Keep `DATABASE_URL` for runtime and a distinct `DIRECT_URL` for migrations. **`schema.prisma` now explicitly declares `directUrl = env("DIRECT_URL")` alongside `url = env("DATABASE_URL")`.** To preserve backward compatibility with single-URL deployments (such as the existing Render production fallback and local single-URL test setups), runtime bootstrap (`backend/src/start.ts`) safely defaults `DIRECT_URL` to `DATABASE_URL` when `DIRECT_URL` is omitted, and test isolation (`backend/src/databaseSafety.ts`) fail-closed guards both URLs against inheriting live credentials.

Use server-only database roles. Do not place database credentials in Vite variables, Flutter defines, Netlify build variables, or client bundles. Separate runtime and migration privileges; do not copy Supabase's high-privilege example role into the API without reviewing the privileges and existing server-side authorization model. The API uses Prisma and its own RBAC; exposing Supabase Data APIs would be a separate security design and is not part of this migration.

## Migration history and blockers

Local ordered migration sequence:

1. `20260910014825_init_phase_1`
2. `20260910024255_phase_3_assignments`
3. `20260910025748_phase_4_review_records`
4. `20260910045300_phase_5_admin_models`
5. `20260910050209_phase_6_drill_instructor`
6. `20260929085000_duty_table_prerequisite` — locally added prerequisite; creates base `Duty` only if absent
7. `20260929090000_duty_schedule_fields` — adds `startTime` and `endTime`, then copies `reportingTime` into missing `startTime` values
8. `20260929091000_rank_history`
9. `20260929092000_camp_management_fields`
10. `20260929100000_ano_final_review_stage`
11. `20260929100500_public_media_and_institutional_info`
12. `20260929175638_central_notification_delivery`
13. `20260930110000_registration_and_login_otp`
14. `20261028120000_security_recovery_sessions_di` — locally present and unapplied

### Complete Prisma model migration audit (39 models)

| # | Model Name | Initial `CREATE TABLE` Migration | Subsequent `ALTER TABLE` Migrations | Migration Status & Uncertainty |
|---|---|---|---|---|
| 1 | `User` | `20260910014825_init_phase_1` | `20260929091000_rank_history`, `20260929175638_central_notification_delivery`, `20260930110000_registration_and_login_otp` | Covered by migrations. Checksum match required. |
| 2 | `ReviewRecord` | `20260910025748_phase_4_review_records` | `20260910025748_phase_4_review_records` (indexes/FKs) | Covered by migrations. |
| 3 | `GalleryPhoto` | `20260929100500_public_media_and_institutional_info` | None | Covered by migration (`CREATE TABLE IF NOT EXISTS`). |
| 4 | `RankHolder` | `20260929100500_public_media_and_institutional_info` | None | Covered by migration (`CREATE TABLE IF NOT EXISTS`). |
| 5 | `InstitutionalInfo` | `20260929100500_public_media_and_institutional_info` | None | Covered by migration (`CREATE TABLE IF NOT EXISTS`). |
| 6 | `SeniorAssignment` | `20260910024255_phase_3_assignments` | `20260910024255_phase_3_assignments` (indexes/FKs) | Covered by migrations. |
| 7 | `PlatoonSeniorAssignment` | `20260910024255_phase_3_assignments` | `20260910024255_phase_3_assignments` (indexes/FKs) | Covered by migrations. |
| 8 | `DrillInstructorAssignment` | `20261028120000_security_recovery_sessions_di` | `20261028120000_security_recovery_sessions_di` (indexes/FKs) | Locally checked in; pending deployment. |
| 9 | `Platoon` | `20260910014825_init_phase_1` | `20260910024255_phase_3_assignments` (FKs) | Covered by migrations. |
| 10 | `AuthSession` | `20261028120000_security_recovery_sessions_di` | `20261028120000_security_recovery_sessions_di` (indexes/FKs) | Locally checked in; pending deployment. |
| 11 | `RecoveryChallenge` | `20261028120000_security_recovery_sessions_di` | `20261028120000_security_recovery_sessions_di` (indexes/FKs) | Locally checked in; pending deployment. |
| 12 | `Notice` | `20260910014825_init_phase_1` | `20260910045300_phase_5_admin_models` (FKs) | Covered by migrations. |
| 13 | `Event` | `20260910014825_init_phase_1` | `20260910045300_phase_5_admin_models` (FKs) | Covered by migrations. |
| 14 | `EventParticipant` | `20260910045300_phase_5_admin_models` | `20260910045300_phase_5_admin_models` (indexes/FKs) | Covered by migrations. |
| 15 | `Achievement` | `20260910014825_init_phase_1` | `20260910045300_phase_5_admin_models` (FKs) | Covered by migrations. |
| 16 | `Camp` | `20260910014825_init_phase_1` | `20260910045300_phase_5_admin_models`, `20260929092000_camp_management_fields` | Covered by migrations. |
| 17 | `CampDocument` | `20260929092000_camp_management_fields` | `20260929092000_camp_management_fields` (indexes/FKs) | Covered by migrations. |
| 18 | `CampParticipant` | `20260910045300_phase_5_admin_models` | `20260910045300_phase_5_admin_models` (indexes/FKs) | Covered by migrations. |
| 19 | `Leave` | `20260910045300_phase_5_admin_models` | `20260910045300_phase_5_admin_models` (indexes/FKs) | Covered by migrations. |
| 20 | `LeaveReviewRecord` | **NONE** | **NONE** | **BLOCKER:** Missing from all migrations. Used in `leave.controller.ts`. |
| 21 | `Request` | **NONE** | **NONE** | **BLOCKER:** Missing from all migrations. Used in `pendingActions.controller.ts`, `request.controller.ts`. |
| 22 | `RequestHistoryRecord` | **NONE** | **NONE** | **BLOCKER:** Missing from all migrations. Defines inquiry workflow audit trail. |
| 23 | `InquiryReply` | **NONE** | **NONE** | **BLOCKER:** Missing from all migrations. Defines inquiry replies and relations. |
| 24 | `TimelineEvent` | **NONE** | **NONE** | **BLOCKER:** Missing from all migrations. Used in service record and timeline controllers. |
| 25 | `Duty` | `20260929085000_duty_table_prerequisite` (conditional) | `20260929090000_duty_schedule_fields` | **BLOCKER:** Prerequisite added locally. Live status in Render is UNVERIFIED. |
| 26 | `AuditLog` | `20260910045300_phase_5_admin_models` | None | Covered by migrations. |
| 27 | `RankHistory` | `20260929091000_rank_history` | `20260929091000_rank_history` (indexes/FKs) | Covered by migrations. |
| 28 | `Notification` | `20260910045300_phase_5_admin_models` | `20260929175638_central_notification_delivery` | Covered by migrations. |
| 29 | `NotificationPreferences` | `20260929175638_central_notification_delivery` | None | Covered by migration (`CREATE TABLE IF NOT EXISTS`). |
| 30 | `WebPushSubscription` | `20260929175638_central_notification_delivery` | None | Covered by migration (`CREATE TABLE IF NOT EXISTS`). |
| 31 | `NotificationRead` | `20260929175638_central_notification_delivery` | None | Covered by migration (`CREATE TABLE IF NOT EXISTS`). |
| 32 | `TrainingSession` | `20260910050209_phase_6_drill_instructor` | None | Covered by migrations. |
| 33 | `TrainingAttendance` | `20260910050209_phase_6_drill_instructor` | `20260910050209_phase_6_drill_instructor` (indexes/FKs) | Covered by migrations. |
| 34 | `BiometricTemplate` | **NONE** | **NONE** | **BLOCKER:** Missing from all migrations. Used in `attendance.controller.ts`. |
| 35 | `TurnoutInspection` | `20260910050209_phase_6_drill_instructor` | `20260910050209_phase_6_drill_instructor` (indexes/FKs) | Covered by migrations. |
| 36 | `Certificate` | **NONE** | **NONE** | **BLOCKER:** Missing from all migrations. Used in `certificate.controller.ts`. |
| 37 | `AttendanceNotification` | **NONE** | **NONE** | **BLOCKER:** Missing from all migrations. Used in `attendanceNotification.service.ts`. |
| 38 | `PasswordReset` | **NONE** | **NONE** | **BLOCKER:** Missing from all migrations. Referenced in `verify_auth_recovery.ts`. |
| 39 | `OtpChallenge` | `20260930110000_registration_and_login_otp` | `20260930110000_registration_and_login_otp` (indexes/FKs) | Covered by migrations (`CREATE TABLE IF NOT EXISTS`). |

The Duty prerequisite does not change the historical `Duty` migration checksum. It is conditional if `public."Duty"` exists, but does not repair a partially formed table. Specifically, the following schedule migration expects `reportingTime` to exist and will fail if it does not; it will also fail if either newly added column already exists while the migration is pending. An existing failed migration can block `migrate deploy` until its state is reconciled. Never mark it applied or rolled back based on assumption.

There is a broader fresh-schema gap: nine current Prisma models have no `CREATE TABLE` in the checked-in migrations: `LeaveReviewRecord`, `Request`, `RequestHistoryRecord`, `InquiryReply`, `TimelineEvent`, `BiometricTemplate`, `Certificate`, `AttendanceNotification`, and `PasswordReset`. Some may have been created by manual `db push` or other out-of-band work, but repository evidence cannot prove that. The deployment guide contains historical `db push` instructions, which are not a substitute for a reproducible checked-in migration chain. Reconcile these models and their columns before treating an empty-database migration run as application-ready.

**Strict policy on missing models:** Do not invent migration SQL or mark migrations as applied to bypass failures. Do not guess whether production tables exist or assume the nine models are absent from production. Reconcile these models using the Prisma schema plus sanitized, read-only catalog evidence, then create a reviewed forward migration. The unresolved Duty failure remains a separate blocker.

The new security migration follows OTP and only references the earlier `User` and `Platoon` tables. Its three FKs and indexes correspond to the current Prisma schema; its DI assignment uniqueness is `(drillInstructorId, platoonId)`. This is a static source comparison, not proof that an existing database has those objects or that the migration applies cleanly.

No migration history or deployment record in this repository establishes whether `20260929090000_duty_schedule_fields` was applied, failed, or absent in Render. **Production compatibility remains UNVERIFIED.**

The application currently accesses PostgreSQL through Express + Prisma; the React client and Flutter app call the Express API. Neither `@supabase/supabase-js` nor `@supabase/ssr` is present in the manifests/lockfiles, and neither is required for this architecture. `@supabase/ssr` targets server-rendered Supabase Auth integrations, while this frontend is Vite/React and authentication/RBAC remain in Express. Do not add either package unless a concrete feature is designed to use Supabase APIs/Auth directly; never expose a service-role key to either client.

Login, OTP, recovery, and AI rate limiters use a bounded **process-local** store. That limits one instance but is not deployment-wide and is not atomic across multiple hosts. No shared atomic provider is configured; do not scale out assuming the limits are global.

## Required sanitized database-owner evidence

An authorized database owner should run the sanitized read-only inspection queries from the repository root with their protected `ait-ncc-prod-readonly` libpq profile, as documented in [TESTING_AND_BACKUP.md](backend/TESTING_AND_BACKUP.md). **Do not execute these against production from automated agent loops; this is strictly an owner handoff.**

### A. Comprehensive schema and 9-model migration audit
```sh
psql 'service=ait-ncc-prod-readonly' -X -v ON_ERROR_STOP=1 \
  --file backend/prisma/inspect_schema_and_migrations_readonly.sql
```

### B. Focused Duty migration inspection
```sh
psql 'service=ait-ncc-prod-readonly' -X -v ON_ERROR_STOP=1 \
  --file backend/prisma/inspect_duty_migration_readonly.sql
```

Return only these sanitized, metadata-only results:

1. Confirmation that `transaction_read_only` is `on`.
2. Whether `_prisma_migrations` exists, and the full list of applied migration names, checksums, `started_at`, `finished_at`, `rolled_back_at`, `applied_steps_count`, and `has_error_log`. Compare checksums against the local repository files.
3. For each of the 9 candidate models (`LeaveReviewRecord`, `Request`, `RequestHistoryRecord`, `InquiryReply`, `TimelineEvent`, `BiometricTemplate`, `Certificate`, `AttendanceNotification`, `PasswordReset`) and `Duty`:
   - Boolean existence in `public` schema (`table_exists`).
   - If present: column names, data types, nullability, defaults.
   - Primary key, foreign key, and unique constraint definitions.
   - Index names and definitions.
4. If any migration failed: only a sanitized error summary identifying the failure reason (e.g., relation not found, column already exists), with identifiers, hostnames, and credentials removed.
5. **Strict privacy constraint:** Zero user records, cadet PII, session tokens, or business table rows are to be queried, exported, or returned. Only catalog and metadata queries inside a read-only transaction are permitted.

### Decision gate

| Owner evidence | Safe next decision |
| --- | --- |
| Duty absent; Duty migration absent | Test the new prerequisite plus complete history on a fresh isolated PostgreSQL database first. Do not run against production until the missing model migrations are reconciled and the operator approves a migration window. |
| Duty absent; Duty migration failed | Preserve the failure record. Identify whether any statements partially applied. Do not use `migrate resolve` until an approved recovery plan and backup exist; verify the candidate resolution on an isolated clone. |
| Duty exists with `reportingTime`, no `startTime`/`endTime`; Duty migration pending/failed | The local schedule ALTER may fit, but verify all base columns, constraints, and the failure state on an isolated clone before approval. |
| Duty already has schedule columns and migration is applied with matching checksum | Do not edit the old migration. Verify other schema gaps and investigate why the new prerequisite is pending/out of order before deployment. |
| Duty exists but is partial, has duplicate/missing schedule fields, or migration checksum differs | Stop. Prepare a forward-only repair from exact metadata and test it on a clone. Never change a migration recorded as applied. |
| Duty migration is marked applied but Duty is absent | Treat as inconsistent history/schema. Stop and investigate with the database owner; the local conditional prerequisite is not sufficient to infer a repair. |

## Placeholder-only deployment variables

These are names and placeholder descriptions, not values. Use the provider's protected variable manager. Do not paste real values into repository files or chat.

**Koyeb Free preview service** (synthetic data only; not a production recommendation):

```dotenv
NODE_ENV=production
PORT=<platform-injected-port>
DATABASE_URL=<isolated-Supabase-preview-pooled-PostgreSQL-URL-with-TLS-port-5432>
DIRECT_URL=<isolated-Supabase-preview-direct-PostgreSQL-URL-with-TLS-port-5432>
JWT_SECRET=<new-random-secret-at-least-32-characters>
CORS_ORIGIN=<preview-website-origin>
PUBLIC_APP_URL=<preview-website-origin>
ENABLE_BIOMETRIC_ATTENDANCE=false
```

Do not configure production SMTP/SMS/push, relay, AI, or biometric secrets on the free preview. `schema.prisma` explicitly wires `directUrl = env("DIRECT_URL")`; for Supabase pooler connections, `DIRECT_URL` is required and validated to prevent running migrations against poolers. For single-URL deployments (like Render), `DIRECT_URL` defaults to `DATABASE_URL` if omitted. Never use a real cadet-data database as the preview target.

**Netlify build/function settings:**

```dotenv
VITE_API_BASE_URL=<new-HTTPS-API-origin-without-/api>
RECOVERY_API_BASE_URL=<same-new-HTTPS-API-origin>
RECOVERY_RELAY_SECRET=<same-secret-manager-value-as-backend>
SMTP_USER=<approved-sender-identity>
SMTP_PASSWORD=<secret-manager-reference>
SMTP_FROM_EMAIL=<verified-sender-address>
SMTP_FROM_NAME=<sender-display-name>
```

`VITE_API_BASE_URL` is public and gets baked into the browser bundle; never use it for credentials. `RECOVERY_API_BASE_URL` and relay credentials are function-only. Netlify may need the `EMAIL_RELAY_URL` server-side endpoint kept at its current function URL; it is separate from the API host.

**Flutter release builds:** supply `--dart-define=NCC_API_BASE_URL=<new-HTTPS-API-origin>/api`. This URL is public configuration, not a secret. Existing installed apps keep their compiled API address; changing the source does not update already distributed binaries.

## API URL cutover inventory

After a new backend is approved and healthy, update all of these together:

- [frontend/src/utils/api.ts](frontend/src/utils/api.ts): `VITE_API_BASE_URL` override and hard-coded Render fallback.
- [netlify.toml](netlify.toml): API redirect target and CSP `connect-src` host.
- [frontend/public/_redirects](frontend/public/_redirects) and [frontend/scripts/generate-redirects.cjs](frontend/scripts/generate-redirects.cjs): generated/fallback redirect target.
- Netlify `VITE_API_BASE_URL` build variable and function-only `RECOVERY_API_BASE_URL`.
- [mobile/lib/core/constants/api_constants.dart](mobile/lib/core/constants/api_constants.dart): release fallback; build with `NCC_API_BASE_URL` for each release.
- Backend `CORS_ORIGIN`: exact production Netlify origin (and only explicitly needed origins); do not use `*` with credentials.

Search results also include Render URL literals in tests; update those only when changing expected deployment configuration. The `EMAIL_RELAY_URL` and `PUBLIC_APP_URL` are separate service endpoints and should not be replaced with the API URL.

The local API resolver now gives configured `VITE_API_BASE_URL` precedence over a stale browser `ncc_api_base_url`; if build-time configuration is absent, the existing saved/window/Render fallback remains. No live URL, Netlify redirect/CSP, Flutter default, or provider setting was switched. A preview website needs a separate CORS/proxy/CSP review before it points to a preview API.

## Data-preserving migration and verification procedure

This is an operator plan, not authorization to export or migrate production data.

1. Resolve the Duty history evidence above and reconcile all schema models missing from migrations. Preserve migration checksums. Do not use `db push`, `migrate reset`, seed, or cleanup against either source or target.
2. Obtain approval for the destination plan, data classification, maintenance window, and cost. Create an isolated Supabase staging project first; do not put real cadet data in a free test project.
3. Reproducible disposable testing procedure (options and status):
   * **Status:** Docker daemon socket was unavailable in this audit (`/Users/syedabrarahmed/.docker/run/docker.sock: connect: no such file or directory`). An unknown process is active on port 5432 (PID 762); **connecting to or assuming anything about this unknown listener is strictly forbidden.**
   * **Option A (Recommended when Docker is started):**
     Launch a fresh container on a non-standard loopback port (55432) with no persistent volumes:
     ```sh
     docker run --rm --name ncc-migration-test -p 127.0.0.1:55432:5432 \
       -e POSTGRES_USER=ncc_test -e POSTGRES_PASSWORD=ncc_test_only \
       -e POSTGRES_DB=ncc_test postgres:16-alpine
     ```
   * **Option B (Native local ephemeral cluster if Docker cannot run):**
     Initialize an ephemeral PostgreSQL cluster on a temporary scratch directory bound strictly to loopback:
     ```sh
     mkdir -p /tmp/ncc_ephemeral_pgdata
     initdb -D /tmp/ncc_ephemeral_pgdata -U ncc_test --auth=trust
     pg_ctl -D /tmp/ncc_ephemeral_pgdata -o "-p 55432 -h 127.0.0.1" start
     createdb -h 127.0.0.1 -p 55432 -U ncc_test ncc_test
     ```
     (Cleanup after test: `pg_ctl -D /tmp/ncc_ephemeral_pgdata stop && rm -rf /tmp/ncc_ephemeral_pgdata`)
   * **Option C (Dedicated disposable cloud project):**
     Provision an empty, isolated staging project in Supabase explicitly tagged as disposable. Never point at existing databases.

   In a separate terminal, verify that exact port was created, set the dedicated disposable URL and fail-closed isolation flags, then run Prisma:

   ```sh
   cd backend
   export NODE_ENV=test
   export PRISMA_DONT_LOAD_DOTENV=1
   export ALLOW_DISPOSABLE_TEST_DB=true
   export NCC_DISPOSABLE_DB_CONFIRMATION=I_CONFIRMED_THIS_IS_AN_EMPTY_DISPOSABLE_TEST_DATABASE
   export DISPOSABLE_TEST_DATABASE_URL='postgresql://ncc_test:ncc_test_only@127.0.0.1:55432/ncc_test?schema=public'
   unset DATABASE_URL
   ./node_modules/.bin/prisma migrate deploy
   ./node_modules/.bin/prisma migrate diff --from-url "$DISPOSABLE_TEST_DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
   ```

   The diff is read-only and reports schema differences; it does not repair them. Do not run against any listener except the verified disposable instance. Since the checked-in chain is incomplete, successful `migrate deploy` alone is not a pass. Resolve the diff, then run isolated synthetic workflow tests. None of these commands were run and no database was contacted.
4. Use an authorized database owner to create a source backup using PostgreSQL-native tools over TLS. Include all application schema/data, `_prisma_migrations`, indexes, constraints, enum types, and BYTEA gallery images. Supabase Storage objects, if any are later introduced, require a separate object export; database backups do not contain Storage API objects. Keep the artifact encrypted, access-controlled, and outside Git.
5. Restore that backup into the isolated Supabase staging project, not directly into the new production project. Compare sanitized per-table row counts, key/foreign-key relationships, indexes, enum values, migration checksums/status, representative synthetic records, and application read/write workflows. Do not share personal rows with this repository or chat.
6. Verify app behavior on staging for login/OTP, session revocation, all role authorization, registration approvals, attendance, leave, duties, camps, inquiries, notification delivery (mocked first), and image retrieval. Validate pool/TLS/timeouts and a successful restore into a second isolated database.
7. For production cutover, take and verify a fresh source backup; agree a write freeze or a proven replication/delta process; migrate the final delta; compare row counts and checksums; deploy the API with no automatic migration; run the reviewed `prisma migrate deploy` once from the approved migration runner; then verify health plus database-backed API checks.
8. Only after API and database checks pass, update Netlify API/recovery targets, redirects, and CSP and redeploy Netlify. Then build and distribute Flutter with the new `NCC_API_BASE_URL`. Keep old URLs only as a controlled rollback path until the cutover is accepted.

### Rollback boundary

Before the new database accepts writes, route clients back to the old API only if that service and source database are still available and verified. After writes land in Supabase, simply pointing clients back would lose those writes. Rollback then requires a planned reverse delta/reconciliation or restoring the target and keeping the new API; do not perform an unplanned URL flip. Keep a final encrypted source backup and a tested target restore. No production backup, restore, export, or provider setting was touched here.

## Free preview dashboard checklist (no provider changes made)

1. Create a separate Koyeb preview service with root `backend`, build `npm ci && npm run build`, start `npm start`, and readiness path `/api/health/ready`.
2. Create a separate Supabase Free project for synthetic test records only; select a connection mode reachable from Koyeb, require TLS, and store the URL in Koyeb's protected variables. Do not grant the API a migration/admin role.
3. Replace placeholders in `deployment/koyeb-supabase-preview.env.example` only inside the provider dashboard. Omit messaging credentials; use mocks or an approved mail sink for recovery tests.
4. Do not launch preview against a database until the migration chain is reconciled and successfully applied to an isolated disposable database. Do not connect the live Netlify site or production Flutter builds.
5. Koyeb Free scales to zero and has tight CPU/RAM limits. Supabase Free can pause, has quotas, and lacks downloadable managed backups. Neither tier provides the reliability/restore evidence needed for production cadet records at ₹0.

## Checks and go/no-go

- Backend mock/startup checks passed: `cd backend && npm run test:runtime-config` (including directUrl validation assertions); `cd backend && ./node_modules/.bin/tsc --noEmit`.
- Backend safe suite passed: `cd backend && npm test` (including DIRECT_URL fail-closed isolation regression, database safety, public routes, and biometric security tests with synthetic data; zero live database interaction; 46/46 passed).
- Backend graceful process termination: `backend/src/server.ts` now registers `SIGTERM` and `SIGINT` handlers that safely close the HTTP listener, wait for pending in-flight requests, and execute `await prisma.$disconnect()` before exit.
- Frontend passed: `cd frontend && node src/utils/apiBaseUrl.test.mjs && node securityHeaders.test.mjs && node src/utils/safeExternalUrl.test.mjs && node netlify/functions/recoverySecurity.test.mjs && ./node_modules/.bin/tsc -b`.
- Repository hygiene passed: `git diff --check`; backend package JSON parsed successfully.
- Operational runbooks produced on review branch:
  - [SUPABASE_STAGING_SETUP.md](SUPABASE_STAGING_SETUP.md) — Isolated staging environment provisioning, session-mode pooler configuration, explicit migration deployment, and synthetic seeding.
  - [SUPABASE_CUTOVER_RUNBOOK.md](SUPABASE_CUTOVER_RUNBOOK.md) — Phase-by-phase production cutover execution plan with 5 hard gates, backup verification, and client endpoint updates.
  - [SUPABASE_ROLLBACK_RUNBOOK.md](SUPABASE_ROLLBACK_RUNBOOK.md) — Fast-path pre-write rollback and post-write delta recovery procedures ensuring zero data loss.
- Docker engine verified: Docker v29.8.0 verified active and reachable in test run.
- Disposable PostgreSQL 16 test passed: Ephemeral container `ncc-disposable-test-pg` (`postgres:16-alpine`) was launched bound strictly to `127.0.0.1:55432` with synthetic credentials (`ncc_test`). Database `ncc_disposable_test` was verified empty (0 tables).
- Clean-install migration test passed: `prisma migrate deploy` successfully applied all 14 checked-in migrations (including `20261028120000_security_recovery_sessions_di`), creating 30 application tables + `_prisma_migrations`.
- Schema drift verification via diff: `prisma migrate diff` against `schema.prisma` confirmed with mathematical precision that the checked-in migration chain is missing exactly the 9 models (`LeaveReviewRecord`, `Request`, `RequestHistoryRecord`, `InquiryReply`, `TimelineEvent`, `BiometricTemplate`, `Certificate`, `AttendanceNotification`, `PasswordReset`) and their indexes/foreign keys. Zero other table drift exists.
- Ephemeral container teardown: `ncc-disposable-test-pg` was stopped and automatically removed cleanly; port 55432 is completely released.
- Unknown process on port 5432: An unverified process remains active on localhost:5432 (PID 762). Per safety instructions, this process was NOT probed, connected to, or used.
- Full frontend build was not run because its build script regenerates the tracked Netlify redirects file; no build mutation was needed for the URL resolver test/typecheck.
- Current official provider documentation reviewed on 2026-10-28: links in this document.
- Database owner evidence: **PENDING** (owner handoff instructions delivered in Stage 6; owner must run `inspect_schema_and_migrations_readonly.sql` and return sanitized metadata).
- Supabase connection, TLS, pool, restore and application integration tests: **NOT RUN**.
- Production data export, provider account setup, cost approval, deploy, and client cutover: **NOT AUTHORIZED / NOT DONE**.
- Policy enforcement: Do not invent missing historical migrations, do not assume the 9 models are absent from production, do not mark migrations as applied, do not enable biometric attendance, and preserve Render backend/database as active production fallback.

**Go/no-go: BLOCKED — production metadata or staging access unavailable.** The clean-install test proved that all 14 migrations execute cleanly on fresh PostgreSQL 16, but also proved that the repository's migration chain cannot instantiate the 9 missing models needed by backend controllers. The authorized database owner must run `inspect_schema_and_migrations_readonly.sql` and report sanitized catalog metadata to verify whether those tables exist in Render before a forward-only repair migration can be reviewed. No production migration or cutover is approved; Render remains the active production backend and database.
