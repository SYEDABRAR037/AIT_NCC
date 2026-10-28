-- NCC AIT — Production Schema & Migration Ledger Read-Only Audit (Reviewed Edition)
-- Strictly metadata-only: does not query cadet records, credentials, or personal data.
-- Safe for execution via psql CLI or graphical query consoles (pgAdmin, DBeaver, Render Web Console).
-- Executes entirely inside an explicit READ ONLY transaction and ends with ROLLBACK.
--
-- SECURITY NOTICE:
-- 'BEGIN READ ONLY' enforces engine-level read-only constraints for this transaction block.
-- However, session-level read-only mode is NOT a substitute for an approved read-only database
-- role with restricted SELECT-only grants. Use an authorized read-only connection profile where available.

BEGIN READ ONLY;

-- ==============================================================================
-- 1. TRANSACTION STATE VERIFICATION
-- ==============================================================================
SELECT current_setting('transaction_read_only') AS transaction_read_only;

-- ==============================================================================
-- 2. PRISMA MIGRATION LEDGER PRESENCE
-- ==============================================================================
SELECT
  to_regclass('public."_prisma_migrations"') IS NOT NULL AS migration_ledger_exists,
  CASE
    WHEN to_regclass('public."_prisma_migrations"') IS NOT NULL THEN 'public._prisma_migrations table is present'
    ELSE 'public._prisma_migrations table is ABSENT (no migrations recorded)'
  END AS ledger_status;

-- ==============================================================================
-- 3. PRISMA MIGRATION LEDGER RECORDS (RESULT SET)
-- Safely queries _prisma_migrations dynamically; returns 0 rows if table is absent,
-- or full migration history if present, without failing query planning.
-- Error logs are converted to a boolean (has_error_log) to protect sensitive diagnostics.
-- NOTE: Migration checksums verify historical ledger integrity only; they do NOT
-- prove that subsequent unversioned DDL (e.g. manual ALTER or db push) has not drifted.
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
      'SELECT migration_name, checksum, started_at::text, finished_at::text, rolled_back_at::text, applied_steps_count, (logs IS NOT NULL) AS has_error_log FROM public."_prisma_migrations" ORDER BY started_at ASC',
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
    has_error_log boolean PATH 'has_error_log'
) m;

-- ==============================================================================
-- 4. CANDIDATE TABLES EXISTENCE (RESULT SET)
-- Checks the 9 missing candidate models + Duty + recent security models
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
-- 5. DUTY TABLE COLUMNS & SCHEDULE FIELDS (RESULT SET)
-- Focused inspection of Duty schedule and reporting columns to detect drift
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
