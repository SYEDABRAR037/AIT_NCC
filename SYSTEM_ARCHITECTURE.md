# NCC System Architecture

## Overview

```text
Public web browser / Flutter app
             │ JSON over HTTP(S), bearer token or cookie
             ▼
React + Vite SPA                 Flutter mobile client
             │ /api requests            │ /api requests
             └──────────────┬───────────┘
                            ▼
                    Express + TypeScript API
                 auth, role policy, workflows,
                 notifications and integrations
                            │ Prisma Client
                            ▼
                       PostgreSQL

Browser-only face model assets ──► face descriptor ──► API verification workflow
API assistant ──► optional Claude / Gemini; Wikipedia retrieval and local NCC
                  knowledge/synthesis fallback
API notification worker ──► SMTP / push adapters; SMS adapters are used by OTP flows
```

## Frontend

`frontend/src/main.tsx` mounts React and `App.tsx` composes the public page, auth provider, dialogs, help button, public verification route and role shell. Homepage components under `components/home` render institutional sections. `RoleShellView.tsx` chooses role-dependent command panels. Shared auth logic is in `context/AuthContext.tsx`; API base resolution and safe fetch helpers are under `utils`.

Vite serves local development on port 3000 and proxies `/api` to `http://localhost:5050`. Production configuration includes Netlify redirects/functions and an Nginx/Docker path.

## Backend

`backend/src/start.ts` loads dotenv and applies safe `DIRECT_URL` fallback rules. `server.ts` validates required secrets/database URL, configures Helmet, explicit CORS origins, cookies and JSON parsing, mounts route modules, and exposes liveness/readiness endpoints. Controllers implement request handling; services apply workflow policies, rate limits, OTP dispatch, AI integrations, notification delivery and domain scopes. Auth middleware verifies session tokens and role middleware enforces access.

The API route inventory is in [API_DOCUMENTATION.md](API_DOCUMENTATION.md). The configured local API port is 5050.

## Database

Prisma schema: `backend/prisma/schema.prisma` (39 models). It stores account/session/OTP state, enrollment reviews, roles and platoon assignments, event/camp/duty/leave/attendance records, biometric descriptors, service/rank/certificate records, media, audits and notifications. Runtime data operations use Prisma. The audit did not run migrations or query rows. Consult the existing migration/cutover readiness and runbooks before any DB setup or deployment.

## Authentication and authorization

The web and mobile clients authenticate through the Express API. Source supports JWT plus cookie parsing, durable auth sessions, password hashing, OTP login/registration/recovery and role-scoped actions. Roles include `ADMIN_ANO`, `DRILL_INSTRUCTOR`, `PLATOON_SENIOR`, `SENIOR`, and `CADET`. Most private routers install `authenticateToken`; `requireRole` applies role limits. Controller/policy tests are isolated/mocked in this audit.

## AI, face processing and integrations

- **Face models:** face-api assets are served from `frontend/public/models`; the browser code detects a face, extracts a descriptor and sends it through attendance enrollment/verification APIs. Camera use is consent-gated. No live inference was run.
- **Command Saathi:** assistant service can use Anthropic Claude or Gemini keys. It also searches Wikipedia and has local NCC knowledge synthesis. Provider keys were absent locally, so actual external inference was not tested.
- **Messaging:** Nodemailer supports SMTP and recovery/notification workflows; SMS service code supports configured provider adapters; notification worker uses SMTP and Web Push/VAPID. Local startup was not attempted to avoid queued-message side effects.
- **Uploads/media:** Express routes process image upload requests and store/serve gallery/rank-holder media. Storage runtime was not exercised.

## Deployment configuration

The repository includes Docker Compose for PostgreSQL, backend and Nginx frontend; individual Dockerfiles; Netlify configuration/functions; Render/Koyeb references; and database migration runbooks. These files describe deployment options and do not prove that any hosting provider is configured or that a live deployment exists.

## Runtime flow

1. Browser or Flutter client submits to an API route with JSON or multipart content.
2. Auth middleware validates bearer/cookie token, session and account state where required.
3. Route-level role policy checks authorization.
4. Controller validates inputs and invokes service/domain/database operations.
5. Prisma reads/writes PostgreSQL; selected workflows create audit/timeline/notification records.
6. API returns JSON; clients update the visible view. Email/SMS/push and AI calls depend on server-only configuration.

This flow is derived from source inspection. The full-stack runtime path was not exercised end to end because no isolated database/API environment was available.
