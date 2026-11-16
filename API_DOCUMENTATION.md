# NCC API Documentation

**Inventory date:** 16 November 2026
**Base URL:** local development uses `http://localhost:5050`; Vite proxies frontend `/api` requests to that server.
**Declared routes:** 154 (includes route aliases and duplicate media paths mounted through two routers).
**Runtime verification:** No API process was started; routes below are statically inventoried from Express routers. Do not interpret this list as live endpoint availability.

## Common request and response conventions

Most endpoints use JSON. Media endpoints may use multipart form data. Parameter names written as `:name` are path parameters. Query/body fields and result shapes vary by controller; inspect the linked controller for the exact contract. Authenticated routes use a bearer token (or configured auth cookie) and role middleware where listed. Error handlers generally return `{ success: false, message }`.

## Route inventory

| Method | Path | Access | Purpose group | Source |
|---|---|---|---|---|
| POST | `/api/admin/assignments/drill-instructor` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| POST | `/api/admin/assignments/platoon-senior` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| POST | `/api/admin/assignments/senior` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| GET | `/api/admin/audit-logs` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| GET | `/api/admin/camps` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| POST | `/api/admin/camps` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| DELETE | `/api/admin/camps/:id` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| GET | `/api/admin/dashboard` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| GET | `/api/admin/events` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| POST | `/api/admin/events` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| DELETE | `/api/admin/events/:id` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| POST | `/api/admin/import-cadets` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| GET | `/api/admin/leaves` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| PATCH | `/api/admin/leaves/:id/decision` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| GET | `/api/admin/notices` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| POST | `/api/admin/notices` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| DELETE | `/api/admin/notices/:id` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| GET | `/api/admin/pending-reviews` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| POST | `/api/admin/review-registration` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| GET | `/api/admin/users` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| PATCH | `/api/admin/users/:id/platoon` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| PATCH | `/api/admin/users/:id/role` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| PATCH | `/api/admin/users/:id/status` | Authenticated; ADMIN_ANO role required for the router. | admin | [admin.routes.ts](backend/src/admin.routes.ts) |
| POST | `/api/assistant/chat` | Public; no login required. | assistant | [assistant.routes.ts](backend/src/assistant.routes.ts) |
| POST | `/api/attendance/biometrics/enroll` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| GET | `/api/attendance/biometrics/roster` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| POST | `/api/attendance/bulk-import` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| GET | `/api/attendance/my` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| GET | `/api/attendance/sessions` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| POST | `/api/attendance/sessions` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| GET | `/api/attendance/sessions/:sessionId` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| GET | `/api/attendance/sessions/:sessionId/absent-list` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| GET | `/api/attendance/sessions/:sessionId/eligible-biometrics` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| POST | `/api/attendance/sessions/:sessionId/end` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| GET | `/api/attendance/sessions/:sessionId/live-stats` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| PATCH | `/api/attendance/sessions/:sessionId/mark` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| GET | `/api/attendance/sessions/:sessionId/notifications` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| GET | `/api/attendance/sessions/:sessionId/verification-challenge` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| POST | `/api/attendance/sessions/:sessionId/verify-face` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| POST | `/api/attendance/sessions/eligibility-preview` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| GET | `/api/attendance/summary` | Authenticated; route-level roles apply where declared. | attendance | [attendance.routes.ts](backend/src/attendance.routes.ts) |
| POST | `/api/auth/forgot-password` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/login` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/login/verify-otp` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/logout` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| GET | `/api/auth/me` | Bearer/cookie token required. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/otp/resend` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/recovery/request-otp` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/recovery/resend-otp` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/recovery/reset-password` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/recovery/verify-otp` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/register` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/registration/request-otp` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/registration/resend-otp` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/registration/verify-otp` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/reset-password` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| POST | `/api/auth/verify-otp` | Public auth/recovery endpoint; apply endpoint validation and rate limits. | auth | [auth.routes.ts](backend/src/auth.routes.ts) |
| GET | `/api/calendar/` | Authenticated; route-level roles apply where declared. | calendar | [calendar.routes.ts](backend/src/calendar.routes.ts) |
| POST | `/api/calendar/` | Authenticated; route-level roles apply where declared. | calendar | [calendar.routes.ts](backend/src/calendar.routes.ts) |
| GET | `/api/calendar/events` | Authenticated; route-level roles apply where declared. | calendar | [calendar.routes.ts](backend/src/calendar.routes.ts) |
| POST | `/api/calendar/events` | Authenticated; route-level roles apply where declared. | calendar | [calendar.routes.ts](backend/src/calendar.routes.ts) |
| GET | `/api/camps/` | Authenticated; route-level roles apply where declared. | camp | [camp.routes.ts](backend/src/camp.routes.ts) |
| POST | `/api/camps/` | Authenticated; route-level roles apply where declared. | camp | [camp.routes.ts](backend/src/camp.routes.ts) |
| PATCH | `/api/camps/:campId/participants/:cadetId` | Authenticated; route-level roles apply where declared. | camp | [camp.routes.ts](backend/src/camp.routes.ts) |
| DELETE | `/api/camps/:id` | Authenticated; route-level roles apply where declared. | camp | [camp.routes.ts](backend/src/camp.routes.ts) |
| POST | `/api/camps/:id/apply` | Authenticated; route-level roles apply where declared. | camp | [camp.routes.ts](backend/src/camp.routes.ts) |
| POST | `/api/camps/:id/documents` | Authenticated; route-level roles apply where declared. | camp | [camp.routes.ts](backend/src/camp.routes.ts) |
| PATCH | `/api/camps/:id/status` | Authenticated; route-level roles apply where declared. | camp | [camp.routes.ts](backend/src/camp.routes.ts) |
| PATCH | `/api/certificates/:id/revoke` | Authenticated; route-level roles apply where declared. | certificate | [certificate.routes.ts](backend/src/certificate.routes.ts) |
| GET | `/api/certificates/all` | Authenticated; route-level roles apply where declared. | certificate | [certificate.routes.ts](backend/src/certificate.routes.ts) |
| POST | `/api/certificates/issue` | Authenticated; route-level roles apply where declared. | certificate | [certificate.routes.ts](backend/src/certificate.routes.ts) |
| GET | `/api/certificates/my` | Authenticated; route-level roles apply where declared. | certificate | [certificate.routes.ts](backend/src/certificate.routes.ts) |
| GET | `/api/certificates/vault` | Authenticated; route-level roles apply where declared. | certificate | [certificate.routes.ts](backend/src/certificate.routes.ts) |
| GET | `/api/certificates/verify/:query` | Authenticated; route-level roles apply where declared. | certificate | [certificate.routes.ts](backend/src/certificate.routes.ts) |
| GET | `/api/dashboard/pending-actions` | Authenticated; route-level roles apply where declared. | dashboard | [dashboard.routes.ts](backend/src/dashboard.routes.ts) |
| GET | `/api/digital-id/:cadetId` | Authenticated; route-level roles apply where declared. | digital id | [digitalId.routes.ts](backend/src/digitalId.routes.ts) |
| GET | `/api/digital-id/me` | Authenticated; route-level roles apply where declared. | digital id | [digitalId.routes.ts](backend/src/digitalId.routes.ts) |
| GET | `/api/duties/` | Authenticated; route-level roles apply where declared. | duty | [duty.routes.ts](backend/src/duty.routes.ts) |
| PATCH | `/api/duties/:id/status` | Authenticated; route-level roles apply where declared. | duty | [duty.routes.ts](backend/src/duty.routes.ts) |
| POST | `/api/duties/assign` | Authenticated; route-level roles apply where declared. | duty | [duty.routes.ts](backend/src/duty.routes.ts) |
| GET | `/api/duties/cadets` | Authenticated; route-level roles apply where declared. | duty | [duty.routes.ts](backend/src/duty.routes.ts) |
| GET | `/api/duties/my` | Authenticated; route-level roles apply where declared. | duty | [duty.routes.ts](backend/src/duty.routes.ts) |
| GET | `/api/duties/unit` | Authenticated; route-level roles apply where declared. | duty | [duty.routes.ts](backend/src/duty.routes.ts) |
| GET | `/api/gallery` | Authenticated; route-level roles apply where declared. | media | [media.routes.ts](backend/src/media.routes.ts) |
| POST | `/api/gallery` | Authenticated; route-level roles apply where declared. | media | [media.routes.ts](backend/src/media.routes.ts) |
| DELETE | `/api/gallery/:id` | Authenticated; route-level roles apply where declared. | media | [media.routes.ts](backend/src/media.routes.ts) |
| PUT | `/api/gallery/:id` | Authenticated; route-level roles apply where declared. | media | [media.routes.ts](backend/src/media.routes.ts) |
| GET | `/api/gallery/:id/image` | Authenticated; route-level roles apply where declared. | media | [media.routes.ts](backend/src/media.routes.ts) |
| GET | `/api/health` | Public; liveness only. | health | [server.ts](backend/src/server.ts) |
| GET | `/api/health/ready` | Public; checks database readiness. | health | [server.ts](backend/src/server.ts) |
| GET | `/api/hierarchy/assigned-cadets` | Authenticated; route-level roles apply where declared. | hierarchy | [hierarchy.routes.ts](backend/src/hierarchy.routes.ts) |
| POST | `/api/hierarchy/cadets/:cadetId/lifecycle` | Authenticated; route-level roles apply where declared. | hierarchy | [hierarchy.routes.ts](backend/src/hierarchy.routes.ts) |
| GET | `/api/hierarchy/my-assigned-cadets` | Authenticated; route-level roles apply where declared. | hierarchy | [hierarchy.routes.ts](backend/src/hierarchy.routes.ts) |
| GET | `/api/hierarchy/my-platoon-cadets` | Authenticated; route-level roles apply where declared. | hierarchy | [hierarchy.routes.ts](backend/src/hierarchy.routes.ts) |
| GET | `/api/hierarchy/platoon-cadets` | Authenticated; route-level roles apply where declared. | hierarchy | [hierarchy.routes.ts](backend/src/hierarchy.routes.ts) |
| GET | `/api/hierarchy/platoon-senior/cadets` | Authenticated; route-level roles apply where declared. | hierarchy | [hierarchy.routes.ts](backend/src/hierarchy.routes.ts) |
| GET | `/api/hierarchy/senior/cadets` | Authenticated; route-level roles apply where declared. | hierarchy | [hierarchy.routes.ts](backend/src/hierarchy.routes.ts) |
| PUT | `/api/institutional-info` | Authenticated; route-level roles apply where declared. | media | [media.routes.ts](backend/src/media.routes.ts) |
| PATCH | `/api/leave/:leaveId/action` | Authenticated; route-level roles apply where declared. | leave | [leave.routes.ts](backend/src/leave.routes.ts) |
| POST | `/api/leave/:leaveId/action` | Authenticated; route-level roles apply where declared. | leave | [leave.routes.ts](backend/src/leave.routes.ts) |
| POST | `/api/leave/:leaveId/cancel` | Authenticated; route-level roles apply where declared. | leave | [leave.routes.ts](backend/src/leave.routes.ts) |
| POST | `/api/leave/:leaveId/review` | Authenticated; route-level roles apply where declared. | leave | [leave.routes.ts](backend/src/leave.routes.ts) |
| POST | `/api/leave/apply` | Authenticated; route-level roles apply where declared. | leave | [leave.routes.ts](backend/src/leave.routes.ts) |
| GET | `/api/leave/my` | Authenticated; route-level roles apply where declared. | leave | [leave.routes.ts](backend/src/leave.routes.ts) |
| GET | `/api/leave/pending` | Authenticated; route-level roles apply where declared. | leave | [leave.routes.ts](backend/src/leave.routes.ts) |
| GET | `/api/leave/review` | Authenticated; route-level roles apply where declared. | leave | [leave.routes.ts](backend/src/leave.routes.ts) |
| PATCH | `/api/notifications/:id/read` | Authenticated; route-level roles apply where declared. | notification | [notification.routes.ts](backend/src/notification.routes.ts) |
| GET | `/api/notifications/my` | Authenticated; route-level roles apply where declared. | notification | [notification.routes.ts](backend/src/notification.routes.ts) |
| GET | `/api/notifications/preferences` | Authenticated; route-level roles apply where declared. | notification | [notification.routes.ts](backend/src/notification.routes.ts) |
| PUT | `/api/notifications/preferences` | Authenticated; route-level roles apply where declared. | notification | [notification.routes.ts](backend/src/notification.routes.ts) |
| GET | `/api/notifications/push/public-key` | Authenticated; route-level roles apply where declared. | notification | [notification.routes.ts](backend/src/notification.routes.ts) |
| DELETE | `/api/notifications/push/subscription` | Authenticated; route-level roles apply where declared. | notification | [notification.routes.ts](backend/src/notification.routes.ts) |
| POST | `/api/notifications/push/subscription` | Authenticated; route-level roles apply where declared. | notification | [notification.routes.ts](backend/src/notification.routes.ts) |
| PATCH | `/api/notifications/read-all` | Authenticated; route-level roles apply where declared. | notification | [notification.routes.ts](backend/src/notification.routes.ts) |
| GET | `/api/public/achievements` | Public; no login required. | public | [public.routes.ts](backend/src/public.routes.ts) |
| GET | `/api/public/camps` | Public; no login required. | public | [public.routes.ts](backend/src/public.routes.ts) |
| GET | `/api/public/digital-id/:token` | Public; no login required. | digital id public | [digitalIdPublic.routes.ts](backend/src/digitalIdPublic.routes.ts) |
| GET | `/api/public/events` | Public; no login required. | public | [public.routes.ts](backend/src/public.routes.ts) |
| GET | `/api/public/gallery` | Authenticated; route-level roles apply where declared. | media | [media.routes.ts](backend/src/media.routes.ts) |
| GET | `/api/public/gallery` | Public; no login required. | public | [public.routes.ts](backend/src/public.routes.ts) |
| GET | `/api/public/gallery/:id/image` | Authenticated; route-level roles apply where declared. | media | [media.routes.ts](backend/src/media.routes.ts) |
| GET | `/api/public/gallery/:id/image` | Public; no login required. | public | [public.routes.ts](backend/src/public.routes.ts) |
| GET | `/api/public/institutional-info` | Authenticated; route-level roles apply where declared. | media | [media.routes.ts](backend/src/media.routes.ts) |
| GET | `/api/public/notices` | Public; no login required. | public | [public.routes.ts](backend/src/public.routes.ts) |
| GET | `/api/public/rank-holders` | Authenticated; route-level roles apply where declared. | media | [media.routes.ts](backend/src/media.routes.ts) |
| GET | `/api/public/rank-holders` | Public; no login required. | public | [public.routes.ts](backend/src/public.routes.ts) |
| GET | `/api/public/rank-holders/:id/image` | Authenticated; route-level roles apply where declared. | media | [media.routes.ts](backend/src/media.routes.ts) |
| GET | `/api/public/rank-holders/:id/image` | Public; no login required. | public | [public.routes.ts](backend/src/public.routes.ts) |
| GET | `/api/public/stats` | Public; no login required. | public | [public.routes.ts](backend/src/public.routes.ts) |
| PUT | `/api/rank-holders` | Authenticated; route-level roles apply where declared. | media | [media.routes.ts](backend/src/media.routes.ts) |
| POST | `/api/ranks/cadets/:cadetId` | Authenticated; route-level roles apply where declared. | rank | [rank.routes.ts](backend/src/rank.routes.ts) |
| POST | `/api/requests/:id/action` | Authenticated; route-level roles apply where declared. | request | [request.routes.ts](backend/src/request.routes.ts) |
| POST | `/api/requests/:id/cancel` | Authenticated; route-level roles apply where declared. | request | [request.routes.ts](backend/src/request.routes.ts) |
| GET | `/api/requests/inquiries` | Authenticated; route-level roles apply where declared. | request | [request.routes.ts](backend/src/request.routes.ts) |
| POST | `/api/requests/inquiry` | Authenticated; route-level roles apply where declared. | request | [request.routes.ts](backend/src/request.routes.ts) |
| GET | `/api/requests/inquiry/:id` | Authenticated; route-level roles apply where declared. | request | [request.routes.ts](backend/src/request.routes.ts) |
| POST | `/api/requests/inquiry/:id/reply` | Authenticated; route-level roles apply where declared. | request | [request.routes.ts](backend/src/request.routes.ts) |
| PATCH | `/api/requests/inquiry/:id/status` | Authenticated; route-level roles apply where declared. | request | [request.routes.ts](backend/src/request.routes.ts) |
| GET | `/api/requests/my` | Authenticated; route-level roles apply where declared. | request | [request.routes.ts](backend/src/request.routes.ts) |
| GET | `/api/requests/officer` | Authenticated; route-level roles apply where declared. | request | [request.routes.ts](backend/src/request.routes.ts) |
| GET | `/api/requests/officer/pending` | Authenticated; route-level roles apply where declared. | request | [request.routes.ts](backend/src/request.routes.ts) |
| POST | `/api/requests/submit` | Authenticated; route-level roles apply where declared. | request | [request.routes.ts](backend/src/request.routes.ts) |
| GET | `/api/reviews/:cadetId` | Authenticated; ADMIN_ANO, PLATOON_SENIOR, or SENIOR. | review | [review.routes.ts](backend/src/review.routes.ts) |
| POST | `/api/reviews/:cadetId/action` | Authenticated; ADMIN_ANO, PLATOON_SENIOR, or SENIOR. | review | [review.routes.ts](backend/src/review.routes.ts) |
| GET | `/api/reviews/:cadetId/history` | Authenticated; ADMIN_ANO, PLATOON_SENIOR, or SENIOR. | review | [review.routes.ts](backend/src/review.routes.ts) |
| GET | `/api/reviews/application/:cadetId` | Authenticated; ADMIN_ANO, PLATOON_SENIOR, or SENIOR. | review | [review.routes.ts](backend/src/review.routes.ts) |
| GET | `/api/reviews/pending` | Authenticated; ADMIN_ANO, PLATOON_SENIOR, or SENIOR. | review | [review.routes.ts](backend/src/review.routes.ts) |
| GET | `/api/search/` | Authenticated; route-level roles apply where declared. | search | [search.routes.ts](backend/src/search.routes.ts) |
| GET | `/api/service-record/:cadetId` | Authenticated; route-level roles apply where declared. | service record | [serviceRecord.routes.ts](backend/src/serviceRecord.routes.ts) |
| GET | `/api/service-record/me` | Authenticated; route-level roles apply where declared. | service record | [serviceRecord.routes.ts](backend/src/serviceRecord.routes.ts) |
| GET | `/api/timeline/all` | Authenticated; route-level roles apply where declared. | timeline | [timeline.routes.ts](backend/src/timeline.routes.ts) |
| GET | `/api/timeline/cadet/:cadetId` | Authenticated; route-level roles apply where declared. | timeline | [timeline.routes.ts](backend/src/timeline.routes.ts) |
| GET | `/api/timeline/my` | Authenticated; route-level roles apply where declared. | timeline | [timeline.routes.ts](backend/src/timeline.routes.ts) |
| GET | `/api/timeline/unit` | Authenticated; route-level roles apply where declared. | timeline | [timeline.routes.ts](backend/src/timeline.routes.ts) |

## Families and principal workflows

- **Authentication/recovery:** `/api/auth/*`; registration/login and OTP requests are public inputs, `/me` requires a token. Account lookup, challenge status and reset results are returned by auth/recovery controllers.
- **Public institutional content:** `/api/public/*`; public notices, events, camps, achievements, strength, gallery, rank holders and institutional information.
- **Admin and review:** `/api/admin/*`, `/api/reviews/*`, `/api/hierarchy/*`; authenticated role-gated operations manage account status/roles, assignment, review, leave and audit records.
- **Attendance:** `/api/attendance/*`; sessions, eligibility, manual marks, biometrics, face verification, summaries and roster import. Attendance router installs authentication globally.
- **Cadet services:** `/api/leave/*`, `/api/requests/*`, `/api/duties/*`, `/api/camps/*`, `/api/calendar/*`, `/api/timeline/*`, `/api/service-record/*`, `/api/certificates/*`, `/api/ranks/*`, `/api/digital-id/*`.
- **Messaging, media and assistant:** `/api/notifications/*`, `/api/gallery*`, `/api/rank-holders*`, `/api/institutional-info`, `/api/assistant/chat`.
- **Health:** `/api/health` reports liveness; `/api/health/ready` checks database readiness.

## Testing status

The repository backend tests exercise public controller functions and mocked security/workflow behavior. In this audit those tests passed after Prisma Client generation. The API was not started and no HTTP/database integration test was performed. Exact endpoint request schemas and response fields were not independently verified against a running service.
