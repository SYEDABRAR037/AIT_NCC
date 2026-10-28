# NCC AIT — Production Rollback Runbook: Supabase to Render

**Current Status:** Standby Operational Safety Plan  
**Purpose:** Revert all traffic to Render backend & Render PostgreSQL with zero data loss if cutover encounters critical blockers.  

---

## 1. Rollback Decision Framework

The Incident Commander / Lead Migration Engineer must abort cutover and initiate rollback immediately upon encountering any of the following triggers:

| Trigger Condition | Threshold / Criteria | Rollback Decision |
|---|---|---|
| **Restore Failure** | `pg_restore` encounters fatal corruption or schema validation error. | **ABORT CUTOVER IMMEDIATELY** |
| **Migration Failure** | `prisma migrate deploy` fails on target with schema collision or deadlock. | **ABORT CUTOVER IMMEDIATELY** |
| **Backend Readiness Failure** | `/api/health/ready` returns 503 or fails database ping for > 5 minutes. | **ABORT CUTOVER IMMEDIATELY** |
| **Connection Pool Exhaustion** | Supavisor pooler drops connections or exceeds timeout limits during smoke test. | **ABORT CUTOVER IMMEDIATELY** |
| **Data Mismatch** | Target table row counts deviate from verified source backup. | **ABORT CUTOVER IMMEDIATELY** |
| **Time Threshold Exceeded** | Total maintenance window reaches **T+90 minutes** without passing Gate 9. | **MANDATORY HARD ABORT** |

---

## 2. Pre-Write vs. Post-Write Rollback Boundaries

### Boundary A: Pre-Write Rollback (Zero Target Writes)
- **Condition:** No client traffic has been routed to Supabase, or only read queries / health checks have been executed.
- **Data Impact:** **ZERO DATA LOSS.** Render database remains the 100% authoritative single source of truth.
- **Execution Time:** < 5 minutes.

### Boundary B: Post-Write Rollback (Target Accepted Writes)
- **Condition:** Client traffic was switched to Supabase, and new records (e.g. attendance, leave, audit logs) were written to Supabase before a critical failure manifested.
- **Data Impact:** Risk of split-brain or dropped writes. Requires running the Delta Extraction Procedure (Section 4) before restoring Render as primary.
- **Execution Time:** ~15–25 minutes.

---

## 3. Boundary A Rollback Procedure (Fast-Path)

Use this procedure if the decision to abort occurs during Phases 1 through 8 of the Cutover Runbook:

### Step A.1: Abort Target Services
1. Terminate or pause the target backend service on the new host to prevent accidental traffic absorption.
2. In Supabase Dashboard, set database to Read-Only or revoke API connection pooler credentials.

### Step A.2: Revert Maintenance Mode on Render
1. In Render Dashboard, remove the `MAINTENANCE_MODE=true` environment variable from the Render Web Service (`https://ait-ncc.onrender.com`).
2. Trigger a clean restart of the Render backend.

### Step A.3: Verify Render Backend Health
Execute health probes against the Render backend:
```bash
# Verify Render liveness
curl -fsSL https://ait-ncc.onrender.com/api/health

# Verify Render database connectivity
curl -fsSL https://ait-ncc.onrender.com/api/health/ready
```
Confirm both return HTTP 200 and operational status.

### Step A.4: Confirm Netlify Routing
Verify Netlify redirects continue proxying to Render:
```bash
curl -fsSL https://ncc-aitpune.netlify.app/api/health
```
If Netlify redirects were already modified in staging/preview, revert `_redirects` immediately:
```
/api/*  https://ait-ncc.onrender.com/api/:splat  200!
/*      /index.html                              200
```
Deploy the revert commit to Netlify.

---

## 4. Boundary B Rollback Procedure (Post-Write Delta Extraction)

Use this procedure only if live client writes occurred in Supabase prior to the rollback trigger:

### Step B.1: Immediate Target Freeze
1. Immediately place target backend in maintenance mode or stop the process to prevent any further writes:
   ```bash
   # Block new writes in Supabase
   ALTER DATABASE postgres SET default_transaction_read_only = on;
   ```
2. Close all active client connections:
   ```sql
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE datname = 'postgres' AND pid <> pg_backend_pid();
   ```

### Step B.2: Extract Delta Records Written to Supabase
Query all tables modified since the cutover timestamp ($CUTOVER_START_TIME):

```sql
-- Example delta query for Leave applications created during cutover window
COPY (
  SELECT * FROM public."Leave" 
  WHERE "createdAt" >= '2026-10-28 02:00:00+00'
) TO '/tmp/delta_leave.csv' WITH CSV HEADER;

-- Example delta query for Attendance records marked during cutover window
COPY (
  SELECT * FROM public."TrainingAttendance" 
  WHERE "createdAt" >= '2026-10-28 02:00:00+00'
) TO '/tmp/delta_attendance.csv' WITH CSV HEADER;

-- Example delta query for AuditLog entries created during cutover window
COPY (
  SELECT * FROM public."AuditLog" 
  WHERE "createdAt" >= '2026-10-28 02:00:00+00'
) TO '/tmp/delta_auditlog.csv' WITH CSV HEADER;
```

### Step B.3: Re-Import Delta Records into Render
1. Connect to Render PostgreSQL using administrative credentials.
2. Import the CSV delta files using `\copy`:
   ```sql
   \copy public."Leave" FROM '/tmp/delta_leave.csv' WITH CSV HEADER;
   \copy public."TrainingAttendance" FROM '/tmp/delta_attendance.csv' WITH CSV HEADER;
   \copy public."AuditLog" FROM '/tmp/delta_auditlog.csv' WITH CSV HEADER;
   ```
3. Update sequence counters to accommodate newly inserted IDs.

### Step B.4: Revert Client Configuration to Render
1. Update Netlify environment variables:
   `VITE_API_BASE_URL=https://ait-ncc.onrender.com`
   `BACKEND_URL=https://ait-ncc.onrender.com`
   `RECOVERY_API_BASE_URL=https://ait-ncc.onrender.com`
2. Deploy Netlify production.
3. Unfreeze Render backend service.

---

## 5. Post-Rollback Validation & Communications

1. **Verify Core Flows on Render:**
   - ANO login.
   - Cadet dashboard load.
   - Notice board retrieval.
   - Attendance history display.
2. **Incident Notification:**
   - Send notification to ANO / Unit Commander:
     *"The scheduled migration was rolled back to the stable Render production infrastructure per standard safety protocol. All institutional data is intact and fully operational."*
3. **Log Collection & Analysis:**
   - Preserve all Supabase error logs, migration logs, and psql outputs in a secure post-mortem folder.
   - Schedule root-cause review before any future migration attempt.
