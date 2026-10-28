# NCC AIT — Production Cutover Runbook: Render to Supabase

**Current Status:** STRICTLY BLOCKED — DO NOT EXECUTE  
**Prerequisites Required:** Owner Metadata Verification + Staging Dry Run Pass + Command Authorization  
**Target Window Duration:** 120 Minutes (Maintenance Window)  

---

## 1. Cutover Architecture & Overview

| Component | Active Production (Current) | Target Production (Post-Cutover) |
|---|---|---|
| **Web Frontend** | Netlify (`https://ncc-aitpune.netlify.app`) | Netlify (`https://ncc-aitpune.netlify.app`) |
| **Backend API** | Render Web Service (`https://ait-ncc.onrender.com`) | Approved Node.js Host (e.g. Koyeb/Render Production) |
| **Database** | Render PostgreSQL (managed) | Supabase PostgreSQL (`aws-0-<region>.pooler.supabase.com`) |
| **ORM / Migrations** | Prisma 6.19.3 (Single URL) | Prisma 6.19.3 (`DATABASE_URL` + `DIRECT_URL`) |
| **Mobile App** | Flutter Release (hardcoded/defined Render URL) | Flutter Release (`NCC_API_BASE_URL` define) |

---

## 2. Hard Prerequisites & Pre-Cutover Gates

Execution of this runbook is strictly prohibited until **ALL** five gates pass:

1. **Gate 1 (Production Metadata Verified):** The Render database owner has executed `backend/prisma/inspect_schema_and_migrations_readonly.sql` and returned sanitized catalog results verifying table existence and migration checksums.
2. **Gate 2 (Forward Migration Verified):** An evidence-based, forward-only repair migration has been written, validated on a fresh disposable PostgreSQL instance, and validated on an upgrade path against a replica of Render's schema.
3. **Gate 3 (Staging Dry Run Passed):** Staging backup restore, migration deployment, and all 46 backend tests have passed without error.
4. **Gate 4 (Backup Validated):** A native PostgreSQL backup of Render production has been taken, checksummed, and test-restored into an isolated database.
5. **Gate 5 (Command Authorization):** Written approval of the maintenance window received from the ANO / Unit Commander.

---

## 3. Pre-Cutover Preparation (T-24 Hours)

1. **Maintenance Notification:** Display scheduled maintenance banner on the Netlify portal:
   *"Institutional Portal Maintenance Scheduled: [Date] 02:00 IST – 04:00 IST. Write operations will be paused."*
2. **DNS & TTL Verification:** Verify that DNS TTLs for custom domains (if applicable) are lowered to 300 seconds.
3. **Secrets Verification:** Confirm that all target production secrets (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `PUBLIC_APP_URL`) are loaded into the target backend provider's secret manager.
4. **Tools Readiness:** Ensure the migration operator has `psql` (v16+), `pg_dump`, `pg_restore`, Node.js 22, and the project repository checked out on `codex/ncc-release-candidate-20261028`.

---

## 4. Phase-by-Phase Cutover Execution Plan

```
 [T+00] Maintenance Mode & Write Freeze
   │
 [T+10] Final Full Backup & Checksum Verification
   │
 [T+25] Supabase Production Target Restore
   │
 [T+45] Run Prisma Migrate Deploy (Direct Connection)
   │
 [T+55] Row Count & Sequence Integrity Reconciliation
   │
 [T+65] Deploy Target Backend API
   │
 [T+75] Health & Readiness Probes Validation (/api/health/ready)
   │
 [T+85] Atomic Client Cutover (Netlify Redirects & CSP)
   │
 [T+95] Production Smoke Tests (Read & Controlled Write)
   │
 [T+110] Sign-off or Rollback Trigger
```

### Phase 1: Write Freeze & Maintenance Mode (T+00)
1. In Render Dashboard, set backend environment variable:
   `MAINTENANCE_MODE=true`
2. Restart Render web service. All incoming mutation endpoints (`POST`, `PUT`, `DELETE`, `PATCH`) return `503 Service Unavailable` with maintenance message.
3. Allow ongoing read queries and in-flight transactions to settle (wait 3 minutes).

### Phase 2: Final Production Backup (T+10)
Execute encrypted native backup from Render via owner's administrative terminal:

```bash
# Set secure timestamped filename
BACKUP_FILE="ncc_render_prod_backup_$(date +%Y%m%d_%H%M%S).dump"

# Dump schema, data, large objects, and bloblike photos in custom directory/compressed format
pg_dump --format=custom --compress=9 --no-owner --no-privileges \
  --dbname="$RENDER_PROD_DATABASE_URL" \
  --file="$BACKUP_FILE"

# Generate and record SHA-256 checksum
shasum -a 256 "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"
cat "${BACKUP_FILE}.sha256"
```

### Phase 3: Restore to Target Supabase Production (T+25)
Restore into the prepared, clean Supabase production database:

```bash
# Verify checksum prior to restore
shasum -a 256 -c "${BACKUP_FILE}.sha256"

# Restore using direct connection over TLS
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="$SUPABASE_PROD_DIRECT_URL" \
  "$BACKUP_FILE"
```

### Phase 4: Run Forward Migration via Prisma CLI (T+45)
Deploy checked-in migrations using the dedicated direct migration connection:

```bash
cd backend

# Enforce direct connection for migration runner
DIRECT_URL="$SUPABASE_PROD_DIRECT_URL" DATABASE_URL="$SUPABASE_PROD_DATABASE_URL" \
  npx prisma migrate deploy

# Check migration status
DIRECT_URL="$SUPABASE_PROD_DIRECT_URL" DATABASE_URL="$SUPABASE_PROD_DATABASE_URL" \
  npx prisma migrate status
```

### Phase 5: Data Integrity & Sequence Reconciliation (T+55)
Execute sequence reset script in `psql` against Supabase to ensure all PostgreSQL auto-increment sequences match table maximum IDs:

```sql
-- Reset sequence values for all serial columns
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT tc.table_name, c.column_name,
           pg_get_serial_sequence(format('public."%s"', tc.table_name), c.column_name) AS seq_name
    FROM information_schema.columns c
    JOIN information_schema.tables tc ON tc.table_name = c.table_name AND tc.table_schema = 'public'
    WHERE c.column_default LIKE 'nextval%' AND tc.table_type = 'BASE TABLE'
  LOOP
    IF rec.seq_name IS NOT NULL THEN
      EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM public."%s"), 1))',
                     rec.seq_name, rec.column_name, rec.table_name);
    END IF;
  END LOOP;
END $$;
```

Verify row counts between Render source backup and Supabase target:
```sql
SELECT schemaname, relname, n_live_tup 
FROM pg_stat_user_tables 
ORDER BY relname;
```

### Phase 6: Target Backend API Deployment (T+65)
1. Deploy the Node.js backend to the target production host (configured with Supabase `DATABASE_URL` session pooler and `DIRECT_URL`).
2. Verify container logs:
   - `[NCC COMMAND SERVER] Running on port 5050`
   - Zero crash loops or unhandled rejections.

### Phase 7: Health & Readiness Verification (T+75)
Execute automated curl probes against the new backend:

```bash
# 1. Liveness check
curl -fsSL https://<NEW_BACKEND_HOST>/api/health
# Expected: {"status":"online", "system":"NCC Digital Command & Cadet Management System", ...}

# 2. Database readiness check (probes active connection)
curl -fsSL https://<NEW_BACKEND_HOST>/api/health/ready
# Expected: {"status":"ready", "database":"connected"}
```

### Phase 8: Atomic Client Cutover (T+85)
1. **Netlify Redirects & CSP Cutover:**
   - In Netlify Dashboard, update environment variable:
     `VITE_API_BASE_URL=https://<NEW_BACKEND_HOST>`
     `BACKEND_URL=https://<NEW_BACKEND_HOST>`
     `RECOVERY_API_BASE_URL=https://<NEW_BACKEND_HOST>`
   - Trigger production deploy: Netlify runs `generate-redirects.cjs` which updates `public/_redirects` to proxy `/api/*` to `https://<NEW_BACKEND_HOST>/api/:splat`.
   - Update `netlify.toml` CSP `connect-src` to include `https://<NEW_BACKEND_HOST>`.
2. **Mobile App Release:**
   - Trigger CI release build with `--dart-define=NCC_API_BASE_URL=https://<NEW_BACKEND_HOST>/api`.
   - Distribute update via internal/institutional distribution channels.

### Phase 9: Live Production Smoke Testing (T+95)
1. **Authentication:** Login with ANO institutional credentials.
2. **Dashboard Metrics:** Verify battalion strength, platoon counts, and drill schedules render accurately.
3. **Cadet Service Records:** Retrieve a cadet profile and digital ID; confirm no missing historical data.
4. **Notice Board:** Post a test administrative notice; verify immediate visibility.
5. **Attendance Session:** Open attendance session, mark one synthetic test record, close session. Confirm biometric attendance remains disabled.

### Phase 10: Cutover Sign-Off (T+110)
- Confirm error rates on target backend are `< 0.1%`.
- Confirm response times are `< 250ms`.
- Lift maintenance banner.
- Mark cutover complete.

---

## 5. Hosting Limitations & Cost Profile

| Provider / Tier | Current Limits | Risk Profile & Mitigation |
|---|---|---|
| **Supabase Free** | 500 MB DB, 5 GB egress, 2 active projects, no automated daily backups, pauses after 7 days of inactivity. | **UNACCEPTABLE FOR PRODUCTION.** Production requires Supabase Pro ($25/mo) for automated 7-day backups and zero inactivity pausing. |
| **Koyeb Free** | 512 MB RAM, 0.1 vCPU, scales to zero after inactivity. | **PREVIEW/STAGING ONLY.** Cold starts cause 5-10s latency. Production requires Koyeb Standard or Render Starter ($7/mo) with zero sleep. |
| **Railway Hobby** | Minimum $5/month, CPU/RAM usage overages. | Budget required. Requires explicit monthly spending cap. |
