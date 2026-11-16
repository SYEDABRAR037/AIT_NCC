# NCC Test Results

**Date:** 16 November 2026. Results describe the current workspace files.

## Build and automated test summary

| Area | Command/check | Result | Status |
|---|---|---|---|
| Frontend | `cd frontend && npm run build` | TypeScript/Vite build succeeded; 1,960 modules; largest JavaScript asset 2,163.53 kB (~527.99 kB gzip), with Vite chunk-size warning. | PASS |
| Frontend unit/security | `node --test frontend/src/utils/*.test.mjs frontend/securityHeaders.test.mjs frontend/netlify/functions/*.test.mjs` | 4 test files passed, 0 failed. | PASS |
| Backend | `cd backend && npm run build` | `prisma generate` and `tsc` succeeded. | PASS |
| Backend safety | `npm test` suite 1: test isolation | 5 printed checks passed. | PASS |
| Backend safety | `npm test` suite 2: script/database safety | 12 checks passed. | PASS |
| Backend public routes | Suite 3 | 7 checks passed. | PASS |
| Biometric security | Suite 4 | 28 checks passed, using mocked/session-store tests. | PASS |
| Auth/session/digital ID security | Suite 5 | 25 checks passed. | PASS |
| Login/registration OTP fallback | Suite 6 | 5 printed checks passed with mocked delivery. | PASS |
| Recovery behavior | Suite 7 | Recovery behavior assertions passed; runner does not print an exact case count. | PASS |
| Recovery delivery | Suite 8 | Recovery delivery assertions passed with mocked persistence/provider; runner does not print an exact case count. | PASS |
| Flutter | `cd mobile && flutter test` | 48 tests passed. | PASS |
| Flutter static analysis | `cd mobile && flutter analyze` | No issues found. | PASS |
| Local browser | Open `http://localhost:3000/` | HTTP 200; homepage landmarks and sections rendered. | PASS |

The backend suite emitted **82 explicitly counted passing checks** across six scripts; two additional scripts completed successfully but report assertions as grouped summaries, so no aggregate assertion count is invented. The first backend suite attempt occurred before Prisma client generation and failed to compile; after running the backend build, the full suite succeeded.

## Browser interaction checks

| Interaction | Expected | Observed | Status |
|---|---|---|---|
| Load `/` | Render homepage | NCC homepage rendered in the local browser. | PASS |
| Toggle mobile navigation | Open links and role choices | Drawer opened with homepage anchors, five role choices, login and registration. | PASS |
| Choose ANO/Admin while unauthenticated | Require authentication | Login dialog opened. | PASS |
| Open registration | Show enrollment fields | Registration dialog and required fields were visible. No data was entered or submitted. | PASS for display only |
| Open login | Show credential fields | Login dialog displayed regimental number/password fields. No credentials entered. | PASS for display only |
| Open recovery | Show account-identification form | Recovery dialog displayed email and regimental number fields. | PASS for display only |
| Submit recovery with both fields empty | Block invalid form | Browser native required-field validation focused the email field and reported it required. No request was submitted. | PASS |

## Blocked or untested integration cases

| Feature/integration | Reason | Status |
|---|---|---|
| Express `/api/health` and readiness | API not running on port 5050. | BLOCKED |
| PostgreSQL queries/migrations | No read/write test performed; local data was not inspected. Docker daemon unavailable. | BLOCKED |
| Login/OTP/recovery with live API | Requires API, synthetic isolated DB and safe provider routing. | BLOCKED |
| Registration and review journey | Would create records; no isolated database was started. | BLOCKED |
| Attendance/leave/duty/camp/certificates/admin workflows | Authenticated API and seeded isolated records unavailable. | BLOCKED |
| Face capture/inference | No camera permission or biometric test participant used. | NOT TESTED |
| Claude/Gemini inference | Provider keys absent; no external model calls attempted. | BLOCKED |
| Mobile device browser workflows | Automated tests only; no device-run session. | NOT TESTED |

## Audit limits

No production/live URL was accessed. No database row, migration, email, SMS or push message was created/sent by the audit. The normal backend process was deliberately not launched because startup invokes notification delivery and the existing local environment includes mail configuration.
