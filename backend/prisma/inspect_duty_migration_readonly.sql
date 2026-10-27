-- Read-only PostgreSQL metadata inspection for the AIT NCC Duty migration.
-- Run with psql only, using a DBA-provisioned read-only connection profile.
\set ON_ERROR_STOP on

BEGIN READ ONLY;

SELECT current_setting('transaction_read_only') AS transaction_read_only;

SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS migration_table_exists \gset
\if :migration_table_exists
  SELECT migration_name,
         checksum,
         started_at,
         finished_at,
         rolled_back_at,
         applied_steps_count,
         (logs IS NOT NULL) AS has_error_log
  FROM public."_prisma_migrations"
  WHERE migration_name = '20260929090000_duty_schedule_fields';
\else
  SELECT 'public._prisma_migrations is absent' AS inspection_result;
\endif

SELECT to_regclass('public."Duty"') IS NOT NULL AS duty_table_exists;

SELECT column_name,
       data_type,
       udt_name,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Duty'
ORDER BY ordinal_position;

SELECT constraint_name,
       constraint_type,
       pg_get_constraintdef(c.oid, true) AS definition
FROM information_schema.table_constraints AS tc
JOIN pg_namespace AS n
  ON n.nspname = tc.constraint_schema
JOIN pg_class AS t
  ON t.relnamespace = n.oid
 AND t.relname = tc.table_name
JOIN pg_constraint AS c
  ON c.conrelid = t.oid
 AND c.conname = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'Duty'
ORDER BY constraint_name;

SELECT indexname,
       indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'Duty'
ORDER BY indexname;

ROLLBACK;
