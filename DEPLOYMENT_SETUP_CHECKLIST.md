# NCC deployment setup checklist (preparation only)

**Status:** No cloud database, service, deployment, email or migration was created or run. No commit or push was made. Configure services one at a time and stop at each owner approval gate.

## Current preserved state

- Local branch: `deployment-preparation`. Existing edits and untracked files are preserved; none were staged or discarded.
- The configured local database is PostgreSQL `ncc_local_dev` on loopback, server/client version 18.4. It was inspected read-only. `public` schema and `_prisma_migrations` exist. The database contains five account records, including one CADET role; report contains no identifying row data. Key operational table counts: `TrainingAttendance=0`, `AttendanceNotification=0`, `Leave=0`, `Request=0`, `Certificate=0`, `RecoveryChallenge=2`, `OtpChallenge=0`, `AuthSession=9`.
- Database migration history has only `20261107000000_init_baseline` applied. Repository migration files also include `20261116000000_cadet_performance_analytics` and `20261116010000_auth_session_hardening`; these appear pending against this database. No migration was run.
- Verified custom-format backup, outside the Git repository: `/Users/syedabrarahmed/Backups/NCC/ncc-ncc_local_dev-20261116T074235Z.dump` (105,059 bytes; SHA-256 `535f6d98bf047c20ace953c8910d23b47a819cc600e61d3b21919488098bc228`). File mode 600, parent directory mode 700; stored on a FileVault-encrypted volume. `pg_restore --list` enumerated 242 archive entries and a full archive read to `/dev/null` succeeded. No restore into a database was attempted. Keep this dump out of Git/GitHub and make a second encrypted copy before relying on it as disaster recovery.
- A separate ignored staging env file contains Supabase connection configuration, but it was not contacted. It lacks at least one required secret; do not use it as a deployment configuration as-is.

## 1. Supabase — separate staging destination only

**Current finding:** the schema uses PostgreSQL and Prisma, so Supabase PostgreSQL is compatible in principle. Compatibility is not a data migration or proof of a connected project. Keep the existing local PostgreSQL intact and authoritative until you explicitly decide otherwise.

**Owner configuration in Supabase dashboard:**

1. Create a separate staging project only when ready. Choose a strong database password, region, and a plan with backups suitable for any data you put there. Free-tier availability/retention may change; confirm current project limits and backup/recovery terms in the dashboard before use.
2. Do not copy cadet/production records. First configure an empty isolated staging database and load schema through a reviewed Prisma migration plan only after a separate approval. No `db push`, seed, or migration is part of this preparation.
3. Obtain the project PostgreSQL connection details. Prefer TLS. If using Supavisor, use the session-mode connection for the Prisma runtime unless the Prisma adapter/config is explicitly validated for transaction pooling. Set `DATABASE_URL` to the runtime connection and `DIRECT_URL` to the direct database connection for migration tooling. Keep both private.

**Credentials:** database password; connection URLs (which embed password); later, separate `JWT_SECRET` and `OTP_SECRET`. Put connection URLs only in the backend service secret store. Never add them to `VITE_*` or commit them.

**Codex can prepare:** schema/migration review, sanitized configuration templates, and a migration rehearsal plan against a separately approved disposable staging database.

**Owner approval required before:** creating the cloud project, connecting to it, running migrations, copying any data, or incurring charges.

## 2. Render — API service (not created)

**Repository settings:** backend root directory `backend`; Docker runtime; Dockerfile `./Dockerfile`; build context `.`. The Docker image runs `node dist/start.js`; equivalent package start command is `npm start`. Build is `npm ci`, Prisma client generation, then TypeScript build (Dockerfile performs this). The app binds `process.env.PORT` (defaults to 5050 locally). Readiness endpoint: `GET /api/health/ready` (checks database); liveness: `GET /api/health`.

**Owner configuration in Render dashboard/secret environment:**

- `DATABASE_URL` — only after the authoritative existing database is selected and a safe network/TLS path is confirmed.
- `DIRECT_URL` — direct migration URL as required by Prisma/provider. Do not run a migration just by setting it.
- `NODE_ENV=production`
- `JWT_SECRET` and `OTP_SECRET` — distinct cryptographically random values, at least 32 characters, never placeholders.
- `CORS_ORIGIN` — exact deployed Netlify origin, no localhost origin in production.
- `PUBLIC_APP_URL` — deployed HTTPS frontend origin.
- Brevo values described below, once sender/key setup is complete.
- `PORT` is supplied by Render; do not pin a fixed production port. The local blueprint currently includes 5050 for its service config; confirm Render's current port behavior before creation.
- Optional integrations (SMS, AI, push) only if intentionally activated; secrets remain server-side.

Render Free instances may sleep and have cold starts and are not a durable production choice for a service handling real cadet information. Review current plan limits and database network access before choosing it. This checklist does not create a Render service.

**Codex can prepare:** blueprint/config edits, command and health verification, and a secret-name list. **Owner approval required before:** connecting the GitHub repository, creating the service, enabling auto-deploy, adding secrets, or deploying.

## 3. Brevo — transactional email for OTPs

**Existing code:** OTP email uses `backend/src/services/mail.service.ts`. A server-side HTTPS path now calls Brevo `POST https://api.brevo.com/v3/smtp/email` when `BREVO_API_KEY` is configured. It sends the OTP template and verified sender over HTTPS. If Brevo is selected and its request fails, the code returns failure and does not fall through to SMTP/relay, avoiding potentially duplicated OTPs. This integration is locally implemented only; no real request or email was sent. Legacy SMTP/Netlify relay paths remain available if Brevo is not configured.

**Owner configuration in Brevo:** activate transactional email, create an API key, register and verify the sender address (and domain if requested), and ensure account sending is enabled. Confirm sender identity before entering anything in Render.

**Render backend variables:**

- `BREVO_API_KEY` — secret API key.
- `BREVO_SENDER_EMAIL` — verified sender email.
- `BREVO_SENDER_NAME` — visible sender name (optional; defaults to the NCC name).

Do not put these in Netlify frontend variables, `VITE_*`, source files, or GitHub. Do not configure a real recipient test until the owner has added credentials and approved a test to an owner-controlled mailbox. Render Free SMTP port availability is not assumed; the API uses HTTPS.

**Codex can prepare:** API integration and mocked/local-only validation. **Owner approval required before:** adding production credentials or sending any real email.

## 4. Netlify — frontend (site not created/configured here)

**Existing repository settings:** root `netlify.toml` sets base directory `frontend`, build command `npm run build`, publish directory `dist`, and Functions directory `netlify/functions`. The Vite production build creates `frontend/dist`. API proxy target and CSP currently use `https://ait-ncc.onrender.com`; the fallback frontend API origin also uses that HTTPS host. Production source has no localhost API URL; `http://localhost:5050` exists only in local Vite development proxy/configuration.

**Owner configuration in Netlify site settings:** connect the GitHub repository only when ready; select the correct production branch after deciding branch strategy; set `VITE_API_BASE_URL` to the final public HTTPS API origin (or leave unset to use the configured `/api` proxy). This is a public build-time URL, not a credential. Ensure the API redirect target, CSP `connect-src`, and Vite API base agree if the backend hostname changes. No private keys or database credentials belong in Netlify frontend environment variables.

If retaining the optional Netlify email relay, its function secrets belong in Netlify's server-side function environment, but Brevo direct API is the preferred OTP path and needs no relay secret. Ensure deployed backend `CORS_ORIGIN` allows the exact Netlify origin.

**Codex can prepare:** frontend build configuration and coordinated API/CSP/redirect edits once the final API hostname is known. **Owner approval required before:** connecting the repo, adding environment values, or deploying.

## One-by-one sequence and approval gates

1. Owner confirms whether the local `ncc_local_dev` database is the authoritative dataset and keeps the verified dump safe.
2. Owner configures Brevo sender/API access; no email test until explicitly approved.
3. Owner creates an isolated Supabase staging project only if needed; no real records copied. Review migration compatibility on the empty staging project before approval to migrate schema.
4. Decide Render plan/network path and final API hostname; configure secrets only after the database endpoint and provider are confirmed.
5. Configure Netlify with the final HTTPS API origin and matching CSP/proxy/CORS values.
6. Deploy only after a separate explicit approval. Verify health, then test login/recovery using a dedicated test identity and approved mailbox. Production migration, data copy, deployment, commit and push remain outside this preparation.
