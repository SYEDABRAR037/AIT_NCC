-- NCC AIT — Production Schema & Migration Ledger Read-Only Audit (Final Review Edition)
-- Strictly metadata-only: does not query cadet records, credentials, or personal data.
-- Safe for execution via psql CLI or graphical query consoles (pgAdmin, DBeaver, Render Web Console).
-- Executes entirely inside an explicit READ ONLY transaction and ends with ROLLBACK.
--
-- SECURITY & COMPLIANCE NOTICE:
-- 1. 'BEGIN READ ONLY' enforces engine-level read-only constraints for this transaction block.
--    However, session-level read-only mode is NOT a substitute for an authorized read-only database
--    account with restricted SELECT-only grants. Use an approved read-only profile where available.
-- 2. Checksums in _prisma_migrations record historical migration execution integrity only.
--    A matching checksum does NOT prove that subsequent unversioned DDL (such as manual ALTER
--    or unversioned prisma db push) has not drifted the live schema. Catalog inspection is mandatory.

BEGIN READ ONLY;

-- ==============================================================================
-- 1. TRANSACTION STATE VERIFICATION
-- Confirms the transaction is operating under read-only constraints.
-- ==============================================================================
SELECT current_setting('transaction_read_only') AS transaction_read_only;

-- ==============================================================================
-- 2. PRISMA MIGRATION LEDGER PRESENCE
-- Returns 1 row reporting whether _prisma_migrations exists in the public schema.
-- ==============================================================================
SELECT
  to_regclass('public."_prisma_migrations"') IS NOT NULL AS migration_ledger_exists,
  CASE
    WHEN to_regclass('public."_prisma_migrations"') IS NOT NULL THEN 'public._prisma_migrations table is present'
    ELSE 'public._prisma_migrations table is ABSENT (no migrations recorded)'
  END AS ledger_status;

-- ==============================================================================
-- 3. PRISMA MIGRATION LEDGER RECORDS (RESULT SET)
-- Dynamically queries _prisma_migrations using built-in query_to_xml and xmltable.
-- Safe behavior:
--   - If _prisma_migrations is absent: returns 0 rows (empty result set) without error.
--   - If _prisma_migrations is present: returns all migration rows ordered by started_at.
-- Error logs are converted to a boolean string (has_error_log) to protect diagnostics.
--
-- (Interactive GUI Alternative: If your query tool does not support XML functions,
-- and Query 2 confirms migration_ledger_exists is TRUE, you may run directly:
--   SELECT migration_name, checksum, started_at, finished_at, rolled_back_at,
--          applied_steps_count, (logs IS NOT NULL) AS has_error_log
--   FROM public."_prisma_migrations" ORDER BY started_at ASC;
-- )
-- ==============================================================================
SELECT 
  m.migration_name,
  m.checksum,
  m.started_at,
  m.finished_at,
  m.rolled_back_at,
  m.applied_steps_count,
  m.has_error_log
FROM (
  SELECT CASE 
    WHEN to_regclass('public."_prisma_migrations"') IS NOT NULL 
    THEN query_to_xml(
      'SELECT migration_name, checksum, started_at::text, finished_at::text, rolled_back_at::text, applied_steps_count, (logs IS NOT NULL)::text AS has_error_log FROM public."_prisma_migrations" ORDER BY started_at ASC',
      true, false, ''
    )
    ELSE NULL
  END AS x
) q
CROSS JOIN LATERAL xmltable(
  '/table/row'
  PASSING q.x
  COLUMNS
    migration_name text PATH 'migration_name',
    checksum text PATH 'checksum',
    started_at text PATH 'started_at',
    finished_at text PATH 'finished_at',
    rolled_back_at text PATH 'rolled_back_at',
    applied_steps_count integer PATH 'applied_steps_count',
    has_error_log text PATH 'has_error_log'
) m;

-- ==============================================================================
-- 4. CANDIDATE TABLES EXISTENCE (RESULT SET)
-- Checks boolean existence in public schema for the 9 missing models + Duty + security models
-- ==============================================================================
SELECT table_name,
       to_regclass(format('public."%s"', table_name)) IS NOT NULL AS table_exists
FROM (
  VALUES
    ('Duty'),
    ('LeaveReviewRecord'),
    ('Request'),
    ('RequestHistoryRecord'),
    ('InquiryReply'),
    ('TimelineEvent'),
    ('BiometricTemplate'),
    ('Certificate'),
    ('AttendanceNotification'),
    ('PasswordReset'),
    ('AuthSession'),
    ('RecoveryChallenge'),
    ('DrillInstructorAssignment')
) AS candidate_models(table_name)
ORDER BY table_name;

-- ==============================================================================
-- 5. DUTY SCHEDULE & REPORTING COLUMNS (RESULT SET)
-- Focused inspection to detect whether Duty already has startTime, endTime, and reportingTime
-- ==============================================================================
SELECT column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Duty'
  AND column_name IN ('startTime', 'endTime', 'reportingTime', 'location')
ORDER BY ordinal_position;

-- ==============================================================================
-- 6. CANDIDATE TABLES COLUMNS, TYPES & NULLABILITY (RESULT SET)
-- Returns column definitions for all candidate models that exist in the database
-- ==============================================================================
SELECT table_name,
       column_name,
       data_type,
       udt_name,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'Duty',
    'LeaveReviewRecord',
    'Request',
    'RequestHistoryRecord',
    'InquiryReply',
    'TimelineEvent',
    'BiometricTemplate',
    'Certificate',
    'AttendanceNotification',
    'PasswordReset',
    'AuthSession',
    'RecoveryChallenge',
    'DrillInstructorAssignment'
  )
ORDER BY table_name, ordinal_position;

-- ==============================================================================
-- 7. CANDIDATE TABLES CONSTRAINTS (PK, FK, UNIQUE) (RESULT SET)
-- ==============================================================================
SELECT tc.table_name,
       tc.constraint_name,
       tc.constraint_type,
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
  AND tc.table_name IN (
    'Duty',
    'LeaveReviewRecord',
    'Request',
    'RequestHistoryRecord',
    'InquiryReply',
    'TimelineEvent',
    'BiometricTemplate',
    'Certificate',
    'AttendanceNotification',
    'PasswordReset',
    'AuthSession',
    'RecoveryChallenge',
    'DrillInstructorAssignment'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- ==============================================================================
-- 8. CANDIDATE TABLES INDEX DEFINITIONS (RESULT SET)
-- ==============================================================================
SELECT tablename,
       indexname,
       indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'Duty',
    'LeaveReviewRecord',
    'Request',
    'RequestHistoryRecord',
    'InquiryReply',
    'TimelineEvent',
    'BiometricTemplate',
    'Certificate',
    'AttendanceNotification',
    'PasswordReset',
    'AuthSession',
    'RecoveryChallenge',
    'DrillInstructorAssignment'
  )
ORDER BY tablename, indexname;

-- ==============================================================================
-- 9. TRANSACTION ROLLBACK
-- Guarantees zero writes or state modifications persist from this session
-- ==============================================================================
ROLLBACK;
