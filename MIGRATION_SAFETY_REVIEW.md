# Prisma migration safety review

**Review date:** 16 November 2026  
**Repository branch:** `deployment-preparation` (local)  
**Scope:** the two repository migrations newer than the local database's recorded history.  
**Safety:** This review did not apply migrations, modify the database or migration files, connect to Supabase, deploy, commit, or push.

## Summary

The local database `ncc_local_dev` records only `20261107000000_init_baseline` as applied. The two pending migrations, in timestamp order, are:

1. `backend/prisma/migrations/20261116000000_cadet_performance_analytics/migration.sql`
2. `backend/prisma/migrations/20261116010000_auth_session_hardening/migration.sql`

The first creates two performance analytics tables, their primary/foreign keys, and four indexes. The second adds `OtpChallenge.rememberMe` as a non-null boolean defaulting to `false`. Neither migration contains data-changing DML or destructive DDL. The second migration will assign `false` to pre-existing rows as the column default; the local table currently has zero rows. Both migrations are additive and compatible with the corresponding current Prisma models. The analytics migration depends on the baseline `User` table; the second depends on the baseline `OtpChallenge` table. The two pending migrations do not otherwise depend on one another.

## Migration 1: `20261116000000_cadet_performance_analytics`

**Purpose:** add cadet performance assessment records and calculated score snapshots.

### `PerformanceAssessment`

Creates this table with:

| Column | SQL type | Nullability / default |
|---|---|---|
| `id` | `TEXT` | NOT NULL; primary key |
| `cadetId` | `TEXT` | NOT NULL |
| `evaluatorId` | `TEXT` | NOT NULL |
| `category` | `TEXT` | NOT NULL |
| `score` | `DOUBLE PRECISION` | NOT NULL |
| `title` | `TEXT` | NOT NULL |
| `feedback` | `TEXT` | nullable |
| `assessmentDate` | `TIMESTAMP(3)` | NOT NULL; `CURRENT_TIMESTAMP` default |
| `createdAt` | `TIMESTAMP(3)` | NOT NULL; `CURRENT_TIMESTAMP` default |

Constraints and indexes:

- Primary key: `PerformanceAssessment_pkey` on `id`.
- Foreign key `cadetId` → `User.id`, `ON DELETE CASCADE ON UPDATE CASCADE`. Deleting a referenced cadet deletes their assessment rows; updating the user ID cascades the update.
- Foreign key `evaluatorId` → `User.id`, `ON DELETE RESTRICT ON UPDATE CASCADE`. A user referenced as evaluator cannot be deleted while these assessment rows remain; user ID updates cascade.
- Non-unique index `PerformanceAssessment_cadetId_category_assessmentDate_idx` on `(cadetId, category, assessmentDate)`.
- Non-unique index `PerformanceAssessment_evaluatorId_idx` on `(evaluatorId)`.

### `PerformanceScoreSnapshot`

Creates this table with:

| Column | SQL type | Nullability / default |
|---|---|---|
| `id` | `TEXT` | NOT NULL; primary key |
| `cadetId` | `TEXT` | NOT NULL |
| `period` | `TEXT` | NOT NULL |
| `periodStart` | `TIMESTAMP(3)` | NOT NULL |
| `periodEnd` | `TIMESTAMP(3)` | NOT NULL |
| `overallScore` | `DOUBLE PRECISION` | nullable |
| `grade` | `TEXT` | nullable |
| `completeness` | `DOUBLE PRECISION` | NOT NULL |
| `categories` | `JSONB` | NOT NULL |
| `sourceDigest` | `TEXT` | NOT NULL |
| `calculatedAt` | `TIMESTAMP(3)` | NOT NULL; `CURRENT_TIMESTAMP` default |

Constraints and indexes:

- Primary key: `PerformanceScoreSnapshot_pkey` on `id`.
- Foreign key `cadetId` → `User.id`, `ON DELETE CASCADE ON UPDATE CASCADE`. Deleting a cadet deletes their snapshots; user ID updates cascade.
- Unique index `PerformanceScoreSnapshot_cadetId_period_periodStart_sourceDigest_key` on `(cadetId, period, periodStart, sourceDigest)`. Duplicate snapshots with the same four values are rejected; different `sourceDigest` values can coexist for a period.
- Non-unique index `PerformanceScoreSnapshot_cadetId_periodStart_idx` on `(cadetId, periodStart)`.

### Data and compatibility effects

The SQL only creates new tables, constraints and indexes. It does not update, copy, delete, or overwrite existing rows. Both tables start empty. The referenced `User` table is created in the earlier baseline migration. The definitions match the current Prisma models `PerformanceAssessment` and `PerformanceScoreSnapshot` in `backend/prisma/schema.prisma`.

Current backend code already calls both models in `backend/src/controllers/performance.controller.ts`. The matching database migration must be applied before deploying/running code paths that query or write these models; otherwise PostgreSQL will report missing relation errors. The foreign key delete behavior is significant: assessments restrict deletion of evaluator users, while cadet-owned assessments and snapshots cascade when their cadet is deleted.

## Migration 2: `20261116010000_auth_session_hardening`

**Purpose:** persist the login “remember me” choice on OTP challenges so the OTP-authenticated session can use the requested duration.

Exact SQL:

```sql
ALTER TABLE "OtpChallenge" ADD COLUMN "rememberMe" BOOLEAN NOT NULL DEFAULT false;
```

### Schema and data effects

- Adds column `rememberMe BOOLEAN NOT NULL DEFAULT false` to `OtpChallenge`.
- No index, foreign key, or other constraint is added.
- Existing rows, if any, receive the value `false`; future inserts that omit the column also receive `false`. This is a defaulted value assignment, not an overwrite of another column. There are currently zero rows in the local `OtpChallenge` table.
- No `DROP`, `DELETE`, `UPDATE`, or other destructive SQL appears in this migration.
- This matches the current Prisma `OtpChallenge.rememberMe Boolean @default(false)` field.
- `backend/src/controllers/otpAuth.controller.ts` writes the value when creating an OTP challenge and later reads it when choosing session duration and cookie max age. Applying this migration before deploying/running that code is required; otherwise Prisma's insert/select of the missing column will fail.

## Read-only comparison with local database

The database target was guarded to loopback host and database name `ncc_local_dev`. Inspection used `PGOPTIONS=-c default_transaction_read_only=on`; no DDL/DML was issued.

- PostgreSQL version: `18.4 (Homebrew)`.
- `public._prisma_migrations` contains one finished, non-rolled-back record: `20261107000000_init_baseline`.
- `PerformanceAssessment` and `PerformanceScoreSnapshot` are absent from `public`.
- `OtpChallenge` exists, has zero rows, and does not currently have `rememberMe`.
- The baseline is an applied prerequisite for both pending files because it creates `User` and `OtpChallenge`.

This database history is the source for “pending” status; no Supabase connection was made.

## Data-loss and integrity risks

- **Direct migration data loss:** none identified. There are no table drops, column drops, truncations, row deletes, or data updates.
- **Default behavior:** migration 2 assigns `false` to old `OtpChallenge` rows. That is intentional and conservative: existing challenges do not unexpectedly gain remembered-session behavior.
- **Cascade behavior introduced by migration 1:** deleting a cadet user cascades to their performance assessments and snapshots. This permanently removes those related records as part of the user deletion. Deleting an evaluator is restricted while assessment rows reference them. These are FK behaviors for future deletes; the migration itself does not delete users or records.
- **Unique constraint:** duplicate snapshot keys are rejected. Because the table is newly created, this cannot conflict with existing snapshot rows during this migration.
- **Operational risk:** the new feature may fail at runtime if application code using the new models/column is deployed before its schema migration.

## Dependency and order findings

The migrations are ordered by their timestamp names. Their schema operations are otherwise independent:

- `20261116000000_cadet_performance_analytics` requires `User` from `20261107000000_init_baseline`.
- `20261116010000_auth_session_hardening` requires `OtpChallenge` from that same baseline.
- The second migration does not refer to either performance table, and the analytics migration does not refer to `OtpChallenge`.
- The feature code is already present: performance controller paths use the two performance Prisma models; OTP authentication writes/reads `rememberMe`.

Recommended sequence is to apply the baseline first on a fresh database, then the performance analytics migration, then the auth/session migration, and only then deploy code requiring those schema objects. Prisma `migrate deploy` normally orders migrations by their migration directory names, but this review did not run it.

## Empty staging database compatibility

For a genuinely empty PostgreSQL staging database with Prisma migration history not yet initialized, the repository migration chain should create the baseline schema first, then add these two changes. Confirm the Prisma datasource points to the intended isolated staging database and use the provider-supported direct connection for migrations. Do not provision or initialize a database by manually applying only one pending file.

Before applying to staging, check:

1. It is a separate, disposable staging project/database, not the existing local or production data source.
2. The selected database role can create tables, indexes, foreign keys, and the `public` schema objects required by the baseline.
3. The full migration directory is present and unmodified, including the baseline migration and `migration_lock.toml`.
4. The staging database is truly empty and has no manually created application tables or misleading/partial `_prisma_migrations` history. If it was initialized using `db push` or manual SQL, stop and reconcile rather than marking or replaying migrations blindly.
5. Prisma schema/client version and application build correspond to this repository revision.
6. A backup/restore path is understood before using any staging data worth retaining.

The baseline migration is a full initial schema, not a no-op. Applying the entire chain to a database that already has those tables but lacks matching migration history may fail with “already exists” errors. This is the main empty-staging setup pitfall.

## Recommendation

1. Keep this local database unchanged and retain its verified external backup.
2. For staging, create/use a separate empty PostgreSQL database only after owner approval and verify it has no pre-existing tables or migration history.
3. Review the complete migration chain starting from `20261107000000_init_baseline`; apply in timestamp order only after approval. Let the migration tool record the migrations rather than manually running SQL or editing migration history.
4. Build/deploy the application version containing the matching Prisma schema and feature code only after the schema migration succeeds.
5. Smoke-test performance assessment/snapshot create/read behavior and both remembered and ordinary OTP login behavior on staging. Do not use real cadet data for this check.
6. Before any production migration, take a fresh database backup, verify migration state again against the exact target, and obtain explicit approval.

## Confirmation

**No database changes were made. No migration was applied. No migration file was modified. Supabase was not contacted. Nothing was committed, pushed, or deployed.**
