# NCC AIT — Supabase Staging Environment Setup Guide

**Status:** Ready for Staging Setup (Synthetic Data Only)  
**Security Classification:** Controlled Institutional Architecture Document  
**Production Cutover:** STRICTLY NO-GO / BLOCKED  

---

## 1. Staging Architecture Overview

The staging environment mirrors the target production architecture without connecting to any live cadet records, credentials, or production services:

```
[Netlify Staging / Local Preview]
               │ (HTTPS / CORS / Cookies)
               ▼
   [Express Node.js Backend]
   (Port 5050 / Host-injected PORT)
               │
      ┌────────┴──────────────────────────┐
      │ (Runtime Pooler - Port 5432)      │ (Direct Migration Runner - Port 5432)
      ▼                                   ▼
[Supabase Session Pooler]        [Supabase PostgreSQL DB]
 (aws-0-<region>.pooler.supabase.com) (db.<project-ref>.supabase.co)
```

---

## 2. Strict Safety & Isolation Constraints

- **Synthetic Records Only:** Never import production database dumps, real cadet names, mobile numbers, regimental numbers, or parent contact details into staging.
- **Biometric Attendance Disabled:** Staging must operate with `ENABLE_BIOMETRIC_ATTENDANCE=false`.
- **Zero Real Communications:** Never configure production SMTP credentials, Twilio credentials, or WebPush keys in staging. All notification services will fail safe or route to mock sentinels.
- **No Direct Local Port 5432:** Never point staging configurations to an unknown local PostgreSQL instance on port 5432.
- **Fail-Closed Flags:** When running test scripts against staging, adhere to `ALLOW_DISPOSABLE_TEST_DB=true` and explicit confirmation flags.

---

## 3. Supabase Staging Project Provisioning

### Step 3.1: Create Staging Project
1. Log in to the Supabase Dashboard.
2. Create a new organization project named `ncc-ait-staging`.
3. Choose the region nearest to users (e.g., `ap-south-1` Mumbai).
4. Generate a strong, unique database password (store in institutional password manager; never commit to Git).
5. Ensure the project is tagged as **Staging / Disposable**.

### Step 3.2: Configure Connection Pooling
1. Navigate to **Project Settings** → **Database** → **Connection Pooling**.
2. **Pool Mode:** Select **Session Mode** (Port `5432`).
   > [!IMPORTANT]
   > Do **NOT** use Transaction Mode (Port `6543`) for this persistent Express + Prisma architecture. Transaction mode does not support session-level prepared statements or advisory locks without complex workarounds.
3. **Pool Size:** Allocate an initial pool of `10` to `15` connections.
4. **SSL Enforcement:** Verify that **Enforce SSL** is enabled (`sslmode=require`).

### Step 3.3: Record Connection Strings (Placeholder Format)
- **Runtime Pooler URL (`DATABASE_URL`):**
  `postgresql://postgres.<project-ref>:[PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require`
- **Direct Migration URL (`DIRECT_URL`):**
  `postgresql://postgres:[PASSWORD]@db.<project-ref>.supabase.co:5432/postgres?sslmode=require`

---

## 4. Backend Staging Configuration

Configure the staging backend environment variables in the staging host's protected secrets manager (e.g., Koyeb or Render staging service):

```dotenv
NODE_ENV=production
PORT=5050
DATABASE_URL=postgresql://postgres.<project-ref>:<STAGING_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
DIRECT_URL=postgresql://postgres:<STAGING_PASSWORD>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
JWT_SECRET=<UNIQUE_CRYPTOGRAPHICALLY_RANDOM_64_CHAR_HEX_STRING>
CORS_ORIGIN=https://staging--ncc-aitpune.netlify.app,http://localhost:3000
PUBLIC_APP_URL=https://staging--ncc-aitpune.netlify.app
ENABLE_BIOMETRIC_ATTENDANCE=false

# Controlled staging mail sink (leave unset to use built-in safe mock logs)
# RECOVERY_API_BASE_URL=https://ncc-staging-api.koyeb.app
```

---

## 5. Migration Execution on Staging

> [!WARNING]
> Database migrations must **never** run automatically during application container startup. Run migrations as an explicit, reviewed step via the migration runner.

From an authorized staging deployment terminal or CI runner:

```bash
cd backend

# Validate schema definition
npx prisma validate

# Run migration deployment using the direct connection
DIRECT_URL="$STAGING_DIRECT_URL" DATABASE_URL="$STAGING_DATABASE_URL" \
  npx prisma migrate deploy

# Verify schema state against Prisma datamodel
DIRECT_URL="$STAGING_DIRECT_URL" DATABASE_URL="$STAGING_DATABASE_URL" \
  npx prisma migrate status
```

---

## 6. Synthetic Data Seeding

Populate the staging database with synthetic institutional accounts:

```bash
cd backend
DIRECT_URL="$STAGING_DIRECT_URL" DATABASE_URL="$STAGING_DATABASE_URL" \
  npm run prisma:seed
```

The seed script creates synthetic test accounts with distinct passwords:
- 1 Admin / ANO (`ano@aitpune.edu.in`)
- 1 Drill Instructor (`di@aitpune.edu.in`)
- 2 Platoon Seniors (`senior.alpha@aitpune.edu.in`, `senior.bravo@aitpune.edu.in`)
- 10 Synthetic Cadets across Platoons Alpha and Bravo
- Mock Parade Schedules, Training Sessions, and Camp records

---

## 7. Staging Verification & Smoke Test Checklist

Once deployed to staging, perform the following validation pass:

1. **Liveness & Readiness Probes:**
   - `GET /api/health` → `200 OK` (returns system version and online status).
   - `GET /api/health/ready` → `200 OK` (verifies active PostgreSQL connection via `SELECT 1`).
2. **Authentication Workflows:**
   - Login as synthetic ANO (`/api/auth/login`).
   - OTP challenge verification.
   - JWT issuance and HTTP-only cookie setting.
   - Token refresh and logout.
3. **Role-Based Access Control (RBAC):**
   - Cadet attempts to access `/api/admin/users` → `403 Forbidden`.
   - Drill Instructor creates training session → `200 OK`.
   - Platoon Senior reviews attendance → `200 OK`.
4. **Attendance Operations:**
   - Create attendance session.
   - Mark synthetic cadet attendance (PRESENT / ABSENT / EXCUSED).
   - Confirm biometric verification is blocked (`403` / `BIOMETRIC_AUTOMATION_DISABLED`).
5. **Leave & Inquiry Workflows:**
   - Cadet submits leave request.
   - Platoon Senior approves / forwards.
   - ANO grants final approval.
6. **Graceful Shutdown & Connection Release:**
   - Send `SIGTERM` to staging backend process.
   - Verify logs: `Received SIGTERM. Closing server gracefully...` → `Prisma connections closed.`
