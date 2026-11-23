# NCC Web & App — Features Built So Far

**Repository reviewed:** `SYEDABRAR037/AIT_NCC` working copy  
**Review date:** 22 November 2026  
**Branch:** `deployment-preparation` (local)  
**Review basis:** source code, routes, Prisma schema/migrations, existing project documentation and automated-test inventory. This is a feature inventory, not a fresh production or end-to-end certification.

## Executive overview

This repository contains a substantial NCC unit website and cadet/staff management system, not only a brochure page. It includes:

- A React/TypeScript public website and multi-role web portal.
- An Express/TypeScript API with authentication, role-scoped workflows and integrations.
- A PostgreSQL/Prisma data model for users, operations, records and notifications.
- A Flutter companion client for Android, iOS and web targets.
- Docker, Netlify and Render deployment configuration, plus migration, backup, security and audit documentation.

The source implements features across enrollment, authentication, approvals, attendance, leave, camps, duties, certificates, rank history, official inquiries, media, notifications and performance analytics. That describes code present in the repository. It does **not** mean that production hosting, all external providers, every API path or each workflow has been verified live.

## 1. Public NCC website

The mounted homepage in `frontend/src/App.tsx` includes:

- **Institutional landing page:** cinematic intro/hero, AIT NCC unit overview, institutional/about content, quote banner, senior appointments, and public contact details.
- **Public unit information:** strength statistics and notices; upcoming events and camps; verified achievements; gallery; enrollment call-to-action; contact/inquiry entry point.
- **Navigation and responsive presentation:** site header/footer, mobile navigation, section links, role/login entry points, help button, accessibility skip link, and institutional design system.
- **Public knowledge and rank content in source:** `KnowledgeHub`, `RankExplorer`, `MissionVisionValues`, and `TrainingActivities` components exist, but the current `App.tsx` does not mount them. They should be treated as implemented source components, not sections currently shown on the homepage.
- **Public digital ID verification:** `/verify-id/:token` displays a public verification result when the API can be reached.

Most public data sections call the API. Their layouts and integrations are implemented, but dynamic data depends on the backend and database being available.

## 2. Web login, registration and account security

- **Cadet self-registration:** profile, academic, contact and enrollment fields; duplicate-account validation in backend; optional profile photo and face enrollment data.
- **Email/mobile verification:** request, verify and resend OTP flows. Delivery depends on server-side email/SMS credentials.
- **Login:** accepts institutional identifiers (email, regimental number or college roll number) plus password, followed by a login OTP flow. Optional “remember me” controls session persistence.
- **Forgot password/account recovery:** uses registered email plus institutional identifier, requests/resends/verifies OTP, then resets the password. Responses are designed to avoid exposing whether an account exists.
- **Account security page:** list active sessions, revoke one session, sign out of all sessions, change password, and invalidate sessions after password changes.
- **Password/session protections in backend:** bcrypt password hashes, runtime secret validation, OTP challenge expiry/attempt limits, database-backed sessions, role/status checks, token/session validation and rate-limiting helpers are present in source.

The current `OtpChallenge.rememberMe` field has a corresponding pending Prisma migration in this local working copy. Remember-me behavior therefore needs that migration applied to the intended database before using the matching backend code.

## 3. Role-based command portals

The web app selects a command shell according to the authenticated database role:

| Role | Major portal areas found in the shell |
|---|---|
| **ADMIN_ANO** | Overview, approval desk, official inquiries, leave decisions, cadet directory/roles, camps, duty detail, unit timeline, certificate issuance, notices, audit logs, media/rank-holder management and account security. |
| **PLATOON_SENIOR** | Platoon overview, approvals, inquiries, leave review, attendance scanner, assigned platoon cadets, camp nominations, duties, timeline, certificates, media and account security. |
| **SENIOR** | Section overview, approvals, inquiries, leave review, attendance, assigned cadets, camps, duties, timeline, certificates, media and account security. |
| **DRILL_INSTRUCTOR** | Drill overview, parade attendance, duty details, unit timeline and account security. |
| **CADET** | Dashboard, digital profile and ID, requests, official inquiries, timeline, camps, assigned duties, attendance, certificates, leave applications, notices and account security. |

Backend middleware and route-level policies enforce access independently of the frontend role menu. Source presence and policy tests do not replace a live signed-in walkthrough of each role.

## 4. Cadet administration and service workflows

- **Enrollment review:** hierarchical application review by senior cadet, platoon senior and ANO/admin; decisions include approval, return/correction, hold or rejection, with review history.
- **Cadet directory and assignments:** account status/role changes, platoon transfers, assignment of seniors, platoon seniors and drill instructors, and roster/bulk import paths.
- **Cadet lifecycle:** status and service lifecycle changes, with service history and audit/timeline records.
- **Service record/profile:** cadet identity and service information, attendance summaries, camps, duties, leave, certificates, lifecycle history and performance scorecard data.
- **Official requests and inquiries:** cadets can submit requests/inquiries and view threads; staff can reply, route, act on requests and update inquiry status.
- **Global search:** authenticated search across records with results routed to relevant cadet, camp, duty, certificate, leave or notice sections.

## 5. Attendance and training

- **Training sessions/muster:** session creation, attendance roster and status handling, eligibility/summary routes and session closure workflows.
- **Manual attendance:** staff roles can record and manage attendance, including review/override flows.
- **Face enrollment and face attendance:** browser-hosted face-api models support face detection and descriptor capture; backend biometric routes support enrollment/verification and a challenge-based verification flow. Biometric descriptors and attendance records have dedicated data models and validation/security code.
- **Turnout inspections:** drill/uniform inspection scores and remarks are represented in the API/data model.
- **Attendance history/metrics:** cadet-facing attendance records, summaries and service-record reporting.
- **Attendance communications:** notification records and service adapters are present for SMS/WhatsApp workflows; service code includes a test-routing policy and provider integrations.

Camera permission, live face matching, real attendance entry and outbound delivery are not certified by this source review.

## 6. Leave, camps, events, duties and calendar

- **Leave:** submit, view, cancel and review leave applications; staff decisions and remarks follow role/workflow policies.
- **Camps:** publish/manage camps, eligibility and targeting fields, applications/nominations, participant status updates and camp documents.
- **Events/calendar:** publish and retrieve public or staff-managed events; calendar stream supports unit schedules.
- **Duties:** create/assign duties, view personal or unit rosters and update completion/status.
- **Timeline:** cadet, personal and unit timelines for service/workflow events.

## 7. Certificates, rank and identity

- **Digital NCC ID:** authenticated ID card with cadet identity fields and generated QR code; printable/savable from the browser.
- **Public ID verification:** token-based public endpoint and verification view for valid/inactive/passed-out/deactivated/invalid states.
- **Certificates:** issue/list/manage/verify certificate records; certificate verification can use serial or verification hash. The web shell includes certificate management and display paths.
- **Rank progression:** admin promotion endpoint and rank-history model record rank changes and responsible actor.

## 8. Performance analytics

- **Scorecard model:** weighted categories for attendance, drill, fitness, training, camp/event participation, certificate/achievement, and discipline/leadership.
- **Scores and feedback:** authorized staff roles can create assessments; cadets and authorized staff can retrieve role-scoped performance results.
- **Reporting periods and snapshots:** monthly, quarterly, annual and service-period calculations; snapshots track category data, score, grade, completeness and source digest.
- **Evidence:** calculations draw on attendance, assessment, camp participation and certificates.
- **Current limitation:** the two performance tables are in pending migration `20261116000000_cadet_performance_analytics` and are absent from the inspected local database. Performance API requests that reach these Prisma models require the migration on the target database first. Exports, configurable weights and manual adjustment approvals are not implemented in the reviewed code.

## 9. Notices, media and notifications

- **Public/staff notices:** public notices and authenticated management/publishing flows.
- **Media archive:** gallery and rank-holder images can be managed by authorized staff and served to public sections. The current data design stores image bytes in PostgreSQL.
- **Notification inbox/preferences:** per-user notifications, read/unread updates and notification preferences.
- **Web push:** subscription registration/revocation and VAPID public-key route; actual delivery requires server configuration.
- **Email:** Nodemailer/relay infrastructure exists. In the current uncommitted working copy, a Brevo HTTPS transactional API path has also been added for OTP delivery; sender verification and API credentials are still needed. No live message has been sent.
- **SMS/WhatsApp:** service adapters reference Fast2SMS/Twilio and MSG91; credentials, sender/template approval and service availability are configuration dependencies.

## 10. Assistant and external research

- Backend has a `/api/assistant/chat` route and a Command Saathi service with optional Gemini/Anthropic provider integration, online research adapters (Wikipedia/DuckDuckGo) and a local NCC knowledge base.
- Provider keys and outbound connectivity are required for external model/research behavior. This source inventory did not verify provider answers or accuracy live.
- The assistant endpoint is present in backend routing; no visible assistant entry point was found in the currently mounted public homepage or role-shell navigation during this review.

## 11. Flutter companion application

Flutter files provide:

- Login, session/auth provider, secure token storage, logout and password recovery screens.
- Cadet dashboard with identity/status and attendance summary; demo presentation mode explicitly disables live API requests.
- Cadet digital ID, QR display, attendance history, notices, leave, camp registration/nomination and official inquiries/thread screens.
- Staff screens for cadet roster, attendance sessions, application approvals and leave review.
- API service, typed models/providers, theme, Android/iOS project configuration, and Flutter web assets.

The mobile navigation is narrower than the web portal; it does not expose every web workflow. Staff dashboard/notice and service screens exist, but feature access depends on the role and API. Flutter automated test files are present; they were not run for this report.

## 12. Data and technical foundation

- **Backend:** Node.js/Express + TypeScript; modular route/controller/service structure; security headers, CORS, JSON/cookie middleware and error handling.
- **Database:** PostgreSQL accessed through Prisma. The schema currently defines **41 models** and three enums. Its entities cover users/roles, assignments/reviews, sessions/OTP/recovery, attendance/biometrics, leave/requests, camps/events/duties, certificates/rank, timeline/audit, media, notifications and performance analytics.
- **Health checks:** `/api/health` is liveness; `/api/health/ready` checks database readiness.
- **Web deployment assets:** Vite, Netlify redirects/functions, Docker/Nginx configuration, and Render blueprint.
- **Documentation and test assets:** API inventory, architecture, deployment/cutover/rollback guidance, recovery/security audits, bug log, test reports, automated backend/frontend/Netlify/Flutter tests, migration history and read-only inspection scripts.

## 13. Features/components not currently part of the live flow

- `KnowledgeHub`, `RankExplorer`, `MissionVisionValues` and `TrainingActivities` exist as frontend components but are not imported/mounted by the current `App.tsx` homepage.
- Assistant API exists but no assistant screen/entry point is mounted in the currently inspected web navigation.
- The mobile app is a companion with selected cadet and staff workflows, not a full feature-equivalent copy of the web command portal.
- Data export/reporting items such as performance PDF/XLSX exports and advanced analytics configuration are not present in the reviewed implementation.

## 14. What remains necessary before calling the system fully working

1. Configure and run the backend against the intended database; verify the exact target before doing so.
2. Review/apply the pending Prisma migrations on an isolated staging database before deploying application code that uses the new tables/column. The baseline/history mismatch must be respected; do not initialize an already populated database as if it were empty.
3. Configure server-only email/SMS/AI/push credentials and test only with approved owner-controlled identities.
4. Configure hosting and production API/CORS URLs; verify health/readiness and frontend/API connectivity after deployment approval.
5. Run role-by-role end-to-end workflows, especially registration/login OTP, recovery, reviews, attendance, leave, certificates and notifications.
6. Complete migration/backup restore rehearsal and review security/privacy/retention policies before storing real cadet data.

## Verification boundaries

This report reviewed 397 tracked and unignored project files by inventory and inspected the relevant source, route, schema, configuration and documentation areas. Binary assets were inventoried, not semantically inspected; dependency folders, generated builds and ignored local environment/secrets were excluded. No production deployment, live API workflow, outbound provider call, or application build/test was run for this report. Existing automated tests and prior audit reports are evidence of earlier isolated checks only, not current end-to-end certification.
