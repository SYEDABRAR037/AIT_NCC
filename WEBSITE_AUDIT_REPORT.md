# NCC Website Audit Report

**Audit date:** 16 November 2026
**Repository:** `SYEDABRAR037/AIT_NCC`
**Branch inspected:** `codex/ncc-release-candidate-20261028`
**Assessment:** The public React website builds and renders locally. Full-stack operational readiness is **not verified** because the API was not started against the existing local database; its startup launches an outbound notification worker. The local preview is running at [http://localhost:3000](http://localhost:3000).

## 1. Executive summary

This repository contains an NCC institutional website and management system for the AIT Pune NCC unit, an Express and Prisma API, a PostgreSQL schema, and a Flutter application. There are 372 tracked repository files, including 39 Prisma models and 154 route declarations (route aliases included).

The public homepage rendered in a browser. The homepage navigation drawer, registration dialog, login dialog, recovery dialog, native required-field validation, and role-menu-to-login gate were exercised locally. The React frontend and backend TypeScript/Prisma builds succeeded. Four frontend test files, eight backend test scripts, and the Flutter test suite passed; Flutter analysis reported no issues.

The website is **not verified as a complete working system**. The API was not listening on port 5050, so Vite’s `/api` proxy requests failed. Public statistics and gallery data could not be checked against the database, and authenticated tasks such as sign-in, enrollment, attendance, leave, camp nomination, and administration were not run end to end. Docker was installed but its daemon was unavailable. The backend `.env` configures a loopback PostgreSQL endpoint, but it also contains mail configuration; starting the API would start a worker that can process and send pending notifications. I therefore did not start it or query its data.

The audit updated only dependency lockfiles for compatible advisory fixes and added documentation. It did not change application source behavior. The final full frontend dependency audit reports zero vulnerabilities. The backend production dependency audit still reports three high findings related to Prisma 6’s CLI/config dependency tree. Prisma 7 is a major upgrade and was not applied.

## 2. Website overview

The system serves public visitors, prospective cadets, cadets, senior cadets, platoon seniors, drill instructors, and ANO/admin staff. It combines institutional information with operational workflows: onboarding and review, attendance and biometric matching, service records, leave, duties, camps, certificates, notices, media, inquiries, timelines, and notifications.

The web client is a React single-page application. Its primary public route is `/`; the source also handles `/verify-id/:token`. Login and registration are dialogs rather than separate URL pages. Role-specific panels are views within the app shell.

See [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md) for the grouped capability inventory and verification status.

## 3. Technology stack

| Area | Implementation found |
|---|---|
| Web UI | React 19, TypeScript, Vite, React Router, CSS, Lucide icons, GSAP |
| API | Node.js, Express, TypeScript, Helmet, CORS, cookie-parser |
| Persistence | PostgreSQL through Prisma ORM; 39 models in `backend/prisma/schema.prisma` |
| Authentication | JWT, bcrypt, OTP challenges, durable session records, role checks |
| Face processing | Browser-side `@vladmandic/face-api`; Tiny Face Detector, 68-point landmarks, face-recognition descriptors; model assets under `frontend/public/models` |
| AI assistant | Optional Anthropic Claude and Google Gemini providers; online research helper and local NCC knowledge/synthesis fallback |
| Email/SMS/push | Nodemailer SMTP, configured SMS provider adapters, Web Push/VAPID |
| Mobile | Flutter/Dart; Android, iOS and web project files |
| Hosting/build | Dockerfiles, Docker Compose, Nginx, Netlify functions/redirects, Render/Koyeb configuration and runbooks |

Environment variable names and readiness are described in `backend/.env.example`. Secret values were not copied into this report. The inspected local environment had loopback database URLs, mail variables set, SMS provider keys absent, and Anthropic/Gemini keys absent. Those checks report presence only and do not validate provider credentials.

## 4. Complete feature documentation

The public feature set and role-specific workflows are detailed in [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md). The code connects these areas to route modules listed in [API_DOCUMENTATION.md](API_DOCUMENTATION.md). A UI appearing in the source or browser does not establish that its database or provider integration is operational.

### AI and machine learning

**Face attendance/enrollment:** browser code loads detector, landmark, and recognition model files from `/models`; it requests camera access only after a user consent checkbox and an explicit camera action. The client extracts a 128-value face descriptor and submits it to API endpoints. The backend has descriptor validation, single-use challenge, scope, replay, leave, duplicate-attendance, and manual correction tests. No camera permission was granted and no live face inference was performed during this audit. Therefore browser inference and enrollment/attendance integration are **not tested** here.

**Command Saathi:** source can call Claude first, then Gemini, and otherwise synthesizes answers from an internal NCC knowledge set and Wikipedia search results. The API has input-size/history validation and process-local rate limiting. The local environment did not have either LLM key configured. No real provider inference was verified. The fallback is application logic plus retrieved content, not proof of a generative model call.

## 5. Page-by-page documentation

| Route or view | Purpose and observed behavior | Status |
|---|---|---|
| `/` | Public NCC homepage with hero, unit information, strength/notices, seniors, events/camps, achievements, gallery, joining process, contact, and footer. Rendered in browser. Dynamic sections could not load without API. | PASS for render; BLOCKED for live data |
| Login dialog | Regimental number and password form; OTP step is conditional on API response; link opens account recovery. Dialog opened and rendered. No credentials submitted. | PASS for opening; BLOCKED for authentication |
| Registration dialog | Cadet details, identifiers, email/mobile verification, academic data, optional photo, password, consent-gated face capture and submission. Opened and inspected; no data submitted. | PASS for opening; BLOCKED for registration |
| Account recovery dialog | Institutional email and regimental number identify account, then OTP, reset-token, and password stages. Opened; empty input produced native required-field validation. | PASS for empty-field validation; BLOCKED for delivery/reset |
| `/verify-id/:token` | Public digital-ID verification view implemented in `frontend/src/components/digitalId/DigitalIdView.tsx`. Not opened with a real or synthetic token in browser. | NOT TESTED |
| Role command views | Admin/ANO, platoon senior, senior, drill instructor, and cadet shells share a shell component with role-specific tabs and panels. Role menu correctly opened login when unauthenticated. No authenticated role session available for panel walkthroughs. | PASS for access gate; BLOCKED for role workflows |
| Mobile application | Flutter application with auth, cadet/staff shells, attendance, leave, notices, camps, inquiries, digital ID, and staff approval views. Widget/model tests and analyzer run locally. Device/browser end-to-end use not performed. | PASS for automated suite; NOT TESTED on device |

## 6. Backend and API documentation

The API route inventory contains **154 route declarations**, counting compatibility aliases and duplicate public media aliases as declared. It includes health/readiness endpoints and route modules for auth, admin, hierarchy, review, leave, attendance, certificates, notifications, assistant, requests, timeline, calendar, duties, camps, dashboard, service records, ranks, media, search, and digital IDs.

`API_DOCUMENTATION.md` lists each declared method/path, source router, access class, and broad purpose. Request bodies and response payloads are controller-specific; inspect the linked source handler for exact field-level contracts. Route declarations and unit tests are not equivalent to live HTTP integration verification. The local API health endpoint returned connection refused because no API process was started.

## 7. Database documentation

Prisma defines 39 models covering users and roles, sessions/recovery/OTP, review and hierarchy, platoons, notices/events/camps, attendance and biometric templates, leaves/requests/inquiries, duties/timeline, certificates/rank history/service records, media, audits, and notification delivery/preferences/push subscriptions.

The API uses Prisma for CRUD and transactional workflow operations. Database migrations were not applied, and no database contents were queried. `SUPABASE_MIGRATION_READINESS.md` records fresh-schema migration gaps and marks the proposed cutover **NO-GO** pending schema reconciliation. That file is a repository readiness note, not a live database assessment. A fresh-database migrate/deploy run remains unverified.

## 8. Testing results

| Test or check | Actual result | Status |
|---|---|---|
| Frontend production build (`frontend/npm run build`) | Vite build succeeded; 1,960 modules transformed. Largest JS asset ~2,163.53 kB uncompressed (~527.99 kB gzip). Vite emitted a >500 kB chunk warning. | PASS |
| Frontend utility/security tests | 4 Node test files passed: API URL resolution, safe external URLs, security headers, Netlify recovery routing. | PASS |
| Backend production build (`backend/npm run build`) | Prisma Client generation and TypeScript build succeeded. | PASS |
| Backend test command (`backend/npm test`) | All 8 scripts completed successfully after Prisma Client generation. The first run before generation failed to compile because generated `Role`/`AccountStatus` exports were absent; build generation resolved the setup blocker. Six suites print 82 explicit passing checks; two recovery suites report success with multiple assertions but do not print case totals. | PASS after generation |
| Flutter test suite | 48 tests passed. | PASS |
| Flutter analyzer | No issues found. | PASS |
| Local browser homepage | `http://localhost:3000/` returned 200 and rendered the homepage. | PASS |
| Local menu/dialog smoke interactions | Menu opened; registration/login/recovery dialogs opened; empty recovery fields were rejected; selecting an admin role opened login when unauthenticated. | PASS for these interactions |
| API/DB readiness | API on port 5050 was not running. No database query, migration, or write was performed. | BLOCKED |
| Live auth, OTP/email/SMS, role dashboards, write workflows | Requires running API, isolated seeded database and safe provider setup. Not executed. | BLOCKED |
| Face inference/camera | Requires browser camera permission and synthetic consented participant data. Not performed. | NOT TESTED |
| Claude/Gemini inference | Provider keys unavailable in local config; no inference attempted. | BLOCKED |
| Mobile device/browser end to end | Automated Flutter tests passed; no device workflow performed. | NOT TESTED |

These totals are intentionally expressed at the level the test runners actually report: 4 frontend test files, 8 backend scripts (with 82 explicitly counted checks plus two uncounted assertion groups), and 48 Flutter tests. This report does not claim complete feature-level coverage or full end-to-end verification.

## 9. Bugs and fixes

| Issue | Location | Root cause | Fix implemented | Retest result |
|---|---|---|---|---|
| Compatible production dependency advisories: Nodemailer, `body-parser`, `brace-expansion`, `follow-redirects`, `multer`, `proxy-addr`, and `qs` | `backend/package-lock.json`; Nodemailer in `frontend/package-lock.json` | Locked versions matched advisories; fixes fit existing semver ranges. | Updated lockfiles using compatible `npm audit fix --omit=dev`; no application source changed. | Backend build and tests pass. Frontend build and tests pass. Backend production audit still reports Prisma-only high findings. |
| Frontend Vite/source-map-js development dependency advisories | `frontend/package-lock.json` | Locked build-tool dependency versions matched advisories. | Updated compatible frontend dependencies with `npm audit fix`. | Frontend audit reported zero vulnerabilities afterward; frontend build/tests rerun. |
| Initial backend test run could not compile generated Prisma enum exports | Local generated dependency state | Prisma Client had not yet been generated in this install state. | Ran the existing backend build, which runs `prisma generate`; no source change. | Backend test command passed on rerun. |
| Local homepage live API requests fail | Local runtime only; API process absent | Frontend proxy targets `http://localhost:5050`; backend was not started to avoid notification-worker side effects against the configured local database/mail setup. | No application workaround added; recorded limitation. | Frontend still returns 200; API/DB integration remains BLOCKED. |

## 10. Security audit

- Authentication middleware validates JWT algorithm, account state and durable sessions; role middleware denies missing users and insufficient roles. Mocked security tests cover expired/revoked tokens, role access, OTP lifecycle, biometric challenge replay, data leakage, and test database guards.
- The backend uses Helmet and credentialed CORS with an explicit origin list. Runtime configuration rejects short/placeholder JWT and OTP secrets and validates PostgreSQL URLs and Supabase SSL requirements.
- Face descriptors and ID/session data are highly sensitive. This audit did not capture real biometric data or inspect database rows.
- `npm audit --omit=dev` after compatible fixes reported zero frontend production vulnerabilities and three high backend findings (`prisma`, `@prisma/config`, and `deepmerge-ts`) requiring Prisma 7. A full frontend audit after fixes reported zero vulnerabilities. Do not apply the Prisma major upgrade without migration/build compatibility work.
- Several rate limit stores are process-local, so their limits are not deployment-wide across multiple API instances.
- Backend startup invokes notification delivery immediately and on a timer. That creates a possible email/push side effect from queued records; this is why the normal API process was not started against the pre-existing local configuration.

## 11. Performance audit

The production bundle has one approximately 2.16 MB JavaScript asset (~528 kB gzip), above Vite’s 500 kB advisory threshold. Code splitting/lazy loading should be evaluated. No page-load timing, database query performance, or model inference benchmark was collected.

## 12. Remaining issues and requirements

1. For safe API testing, provide an isolated disposable PostgreSQL database with synthetic seed data and a notification-worker-disabled/test configuration. Do not use the existing `.env` database as a test target until its data and outbound delivery state are understood.
2. Reconcile Prisma schema/migration gaps recorded in `SUPABASE_MIGRATION_READINESS.md`; test a fresh schema before any deployment/cutover.
3. Review and plan the Prisma 7 upgrade to clear the three remaining backend dependency advisories.
4. Configure valid test email/SMS/LLM providers only in an isolated test environment if delivery/inference needs end-to-end verification.
5. Complete authenticated role-by-role browser walkthroughs, write workflows, API/database integration checks, camera-based biometric tests with explicit consent, and responsive device-size checks.
6. Consider code splitting for the large frontend bundle.

## 13. Final assessment

| Metric | Verified value |
|---|---:|
| Top-level web route patterns identified | 2 (`/` and `/verify-id/:token`) |
| API route declarations inventoried | 154, including aliases |
| Prisma models found | 39 |
| Grouped website feature areas | 27 in `FEATURE_INVENTORY.md` |
| Frontend test files passed | 4 |
| Backend test scripts passed | 8, after Prisma Client generation |
| Explicit backend passing checks printed | 82, plus two successful suites without case totals |
| Flutter automated tests passed | 48 |
| Frontend/backend builds | Both PASS |
| Local homepage | PASS at `http://localhost:3000/` |
| Live full-stack workflows verified | 0; BLOCKED by absent API and safe database/provider constraints |
| Fixed dependency issues | Compatible lockfile fixes applied; Prisma major-version findings remain |
| Remaining unresolved categories | Live API/database, credentials/providers, biometric inference, authenticated UI workflows, Prisma migrations, bundle size |

**Operational status: PARTIALLY VERIFIED / NOT READY TO CLAIM FULLY OPERATIONAL.** The public frontend works locally. API-backed features have not been validated end to end; this report does not certify production readiness.

## 14. Audit artifacts

### Performance analytics implementation update (16 November 2026)

Added an internal NCC cadet performance scorecard to the 360° profile, an additive Prisma migration, centralized weighted scoring, role/assignment-scoped read and assessment endpoints, verified session-date attendance calculations, and append-only digest-keyed snapshots. Default weights and grade bands are clearly internal. Missing categories remain unassessed, attendance excludes excused sessions, and camp/certificate data is presented as evidence rather than scored without a defensible formula.

The implementation builds and the pure calculation cases pass. The migration has not been applied and the API is not running locally, so the new authenticated workflow has not been verified against a database. The current slice also does not yet include configurable weights/bands, manual adjustment approval, recommendations, cross-cadet comparisons, or PDF/Excel exports. Existing local frontend `/` responds with HTTP 200 at port 3000; the Vite proxy targets port 5050, where no API process was listening during this check. The unrelated process on port 5000 is not the NCC API.

- [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md)
- [BUG_FIX_LOG.md](BUG_FIX_LOG.md)
- [TEST_RESULTS.md](TEST_RESULTS.md)
- [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
