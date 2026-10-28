-- Read-only PostgreSQL metadata and migration audit for AIT NCC (Portable SQL Edition).
-- Compatible with both psql CLI and GUI query tools (pgAdmin, DBeaver, Render PSQL Console).
-- Strictly metadata-only: does not return user records, credentials, or personal data.
-- Operates inside a read-only transaction and rolls back at the end.

BEGIN READ ONLY;

-- 1. Confirm read-only transaction state
SELECT current_setting('transaction_read_only') AS transaction_read_only;

-- 2. Inspect migration ledger in _prisma_migrations safely without psql meta-commands
DO $$
DECLARE
  rec RECORD;
  table_exists BOOLEAN;
BEGIN
  SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL INTO table_exists;
  IF table_exists THEN
    RAISE NOTICE '=== _PRISMA_MIGRATIONS LEDGER FOUND ===';
    FOR rec IN EXECUTE
      'SELECT migration_name, checksum, started_at, finished_at, rolled_back_at, applied_steps_count, (logs IS NOT NULL) AS has_error_log
       FROM public."_prisma_migrations"
       ORDER BY started_at ASC'
    LOOP
      RAISE NOTICE 'Migration: %, Checksum: %, AppliedSteps: %, HasError: %, FinishedAt: %',
        rec.migration_name, rec.checksum, rec.applied_steps_count, rec.has_error_log, rec.finished_at;
    END LOOP;
  ELSE
    RAISE NOTICE '=== public._prisma_migrations TABLE IS ABSENT ===';
  END IF;
END $$;

-- 3. Check existence of candidate schema tables (including 9 missing model migrations + Duty)
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

-- 4. Focused inspection of Duty table schedule and reporting columns
SELECT column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Duty'
  AND column_name IN ('startTime', 'endTime', 'reportingTime', 'location')
ORDER BY ordinal_position;

-- 5. Inspect columns for all candidate tables
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

-- 6. Inspect constraints (PK, FK, UNIQUE) for candidate tables
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

-- 7. Inspect index definitions for candidate tables
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

ROLLBACK;
