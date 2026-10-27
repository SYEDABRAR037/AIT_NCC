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

Use a small Prisma connection limit initially and budget the sum across API replicas, background workers, migration runners, and administrative sessions against the selected Supabase compute/pool limits. Increase it only after observing queueing and pool metrics. Keep `DATABASE_URL` for runtime and a distinct `DIRECT_URL` for migrations. **Current `schema.prisma` only declares `DATABASE_URL`; it does not declare Prisma's `directUrl`.** Therefore separate runtime/migration URLs are not wired in this checkout. Adding that Prisma configuration is a later code change requiring review; do not assume setting `DIRECT_URL` alone will affect Prisma.

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

The Duty prerequisite does not change the historical `Duty` migration checksum. It is conditional if `public."Duty"` exists, but does not repair a partially formed table. Specifically, the following schedule migration expects `reportingTime` to exist and will fail if it does not; it will also fail if either newly added column already exists while the migration is pending. An existing failed migration can block `migrate deploy` until its state is reconciled. Never mark it applied or rolled back based on assumption.

There is a broader fresh-schema gap: nine current Prisma models have no `CREATE TABLE` in the checked-in migrations: `LeaveReviewRecord`, `Request`, `RequestHistoryRecord`, `InquiryReply`, `TimelineEvent`, `BiometricTemplate`, `Certificate`, `AttendanceNotification`, and `PasswordReset`. Some may have been created by manual `db push` or other out-of-band work, but repository evidence cannot prove that. The deployment guide contains historical `db push` instructions, which are not a substitute for a reproducible checked-in migration chain. Reconcile these models and their columns before treating an empty-database migration run as application-ready.

No migration was added for those nine models: without trustworthy catalog evidence, generating historical schemas could conflict with tables that may already exist. Reconcile these models using the Prisma schema plus sanitized, read-only catalog evidence, then create a reviewed forward migration. The unresolved Duty failure remains a separate blocker.

The new security migration follows OTP and only references the earlier `User` and `Platoon` tables. Its three FKs and indexes correspond to the current Prisma schema; its DI assignment uniqueness is `(drillInstructorId, platoonId)`. This is a static source comparison, not proof that an existing database has those objects or that the migration applies cleanly.

No migration history or deployment record in this repository establishes whether `20260929090000_duty_schedule_fields` was applied, failed, or absent in Render. **Production compatibility remains UNVERIFIED.**

The application currently accesses PostgreSQL through Express + Prisma; the React client and Flutter app call the Express API. Neither `@supabase/supabase-js` nor `@supabase/ssr` is present in the manifests/lockfiles, and neither is required for this architecture. `@supabase/ssr` targets server-rendered Supabase Auth integrations, while this frontend is Vite/React and authentication/RBAC remain in Express. Do not add either package unless a concrete feature is designed to use Supabase APIs/Auth directly; never expose a service-role key to either client.

Login, OTP, recovery, and AI rate limiters use a bounded **process-local** store. That limits one instance but is not deployment-wide and is not atomic across multiple hosts. No shared atomic provider is configured; do not scale out assuming the limits are global.

## Required sanitized database-owner evidence

An authorized database owner should run the existing read-only query from the repository root with their protected `ait-ncc-prod-readonly` libpq profile, as documented in [TESTING_AND_BACKUP.md](backend/TESTING_AND_BACKUP.md):

```sh
psql 'service=ait-ncc-prod-readonly' -X -v ON_ERROR_STOP=1 \
  --file backend/prisma/inspect_duty_migration_readonly.sql
```

Return only these sanitized results:

1. Confirmation that `transaction_read_only` is `on`.
2. Whether `_prisma_migrations` exists, and zero, one, or multiple rows for `20260929090000_duty_schedule_fields`: migration name, checksum, `started_at`, `finished_at`, `rolled_back_at`, `applied_steps_count`, and whether an error log exists. The owner should compare the checksum to the local SQL file and report match/mismatch; never send connection details.
3. Whether `public."Duty"` exists, then its column names/types/nullability/defaults, constraint definitions, and index definitions. No `Duty`, user, cadet, or other business rows.
4. If failed, only a sanitized error summary sufficient to identify the failure (for example, missing relation or duplicate column), with credentials and personal data removed.

The script filters migration metadata to the Duty migration and reads PostgreSQL catalog metadata; it does not return the full migration ledger or application rows. If additional migration history is needed, the owner should provide only sanitized migration names/status/checksum comparisons, not logs or records unrelated to this repair.

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
DATABASE_URL=<TLS-verified-isolated-Supabase-preview-connection-string>
JWT_SECRET=<new-random-secret-at-least-32-characters>
CORS_ORIGIN=<preview-website-origin>
PUBLIC_APP_URL=<preview-website-origin>
ENABLE_BIOMETRIC_ATTENDANCE=false
```

Do not configure production SMTP/SMS/push, relay, AI, or biometric secrets on the free preview. `DIRECT_URL` is omitted because it is not wired in Prisma; use the separately protected migration runner only after the migration chain is complete and reviewed. Never use a real cadet-data database as the preview target.

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
3. Reproducible disposable procedure (not executed here): after Docker is available, create a uniquely named, newly created database container with no host data volume. The example uses fake credentials and binds only to loopback:

   ```sh
   docker run --rm --name ncc-migration-test -p 127.0.0.1:55432:5432 \
     -e POSTGRES_USER=ncc_test -e POSTGRES_PASSWORD=ncc_test_only \
     -e POSTGRES_DB=ncc_test postgres:16
   ```

   In a second terminal, verify that exact container and port were created by this command, then set the dedicated disposable URL and disable dotenv before running Prisma:

   ```sh
   cd backend
   export PRISMA_DONT_LOAD_DOTENV=1
   export DATABASE_URL='postgresql://ncc_test:ncc_test_only@127.0.0.1:55432/ncc_test?schema=public'
   ./node_modules/.bin/prisma migrate deploy
   ./node_modules/.bin/prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
   ```

   The diff is read-only and reports schema differences; it does not repair them. Do not run against any listener except the verified disposable container. Since the checked-in chain is incomplete, successful `migrate deploy` alone is not a pass. Resolve the diff, then run isolated synthetic workflow tests. Ctrl-C stops PostgreSQL and `--rm` removes its container. Docker daemon was unavailable in this review, so none of these commands were run and no database was contacted.
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

- Backend mock/startup checks passed: `cd backend && npm run test:runtime-config`; `cd backend && ./node_modules/.bin/tsc --noEmit`.
- Backend safe suite passed: `cd backend && npm test` (database-isolation, mocked public-route, biometric and workflow-policy tests; not database integration).
- Frontend passed: `cd frontend && node src/utils/apiBaseUrl.test.mjs && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`.
- Repository hygiene passed: `git diff --check`; backend package JSON parsed successfully.
- `docker info --format '{{.ServerVersion}}'` was attempted and could not reach the local Docker daemon. No database listener was probed or contacted. Disposable migration and database-backed workflow checks remain **BLOCKED**.
- Full frontend build was not run because its build script regenerates the tracked Netlify redirects file; no build mutation was needed for the URL resolver test/typecheck.
- Current official provider documentation reviewed on 2026-10-28: links in this document.
- Database owner evidence: **BLOCKED**.
- Fresh disposable database migration run: **BLOCKED** (Docker daemon unavailable; do not use the unknown local listener).
- Supabase connection, TLS, pool, restore and application integration tests: **NOT RUN**.
- Production data export, provider account setup, cost approval, deploy, and client cutover: **NOT AUTHORIZED / NOT DONE**.

**Go/no-go: NO-GO.** Next, start Docker locally and run the disposable test procedure above. Before any existing-database migration plan, have its authorized owner provide the sanitized Duty history/schema evidence described above. No production migration or cutover is approved; free hosting tiers remain preview-only for this records workload.
