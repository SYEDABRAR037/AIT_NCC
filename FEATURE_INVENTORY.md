# NCC Feature Inventory

Grouped inventory of user-facing and system capabilities found in the repository. Status describes only the verification scope performed in this audit.

| # | Feature area | Purpose and access | Main implementation / integration | Audit status |
|---:|---|---|---|---|
| 1 | Public homepage and hero | Unit introduction and entry points at `/`. | `frontend/src/App.tsx`, `components/home/*` | PASS: rendered locally |
| 2 | Header, mobile navigation, footer | Section links, role menu, external links and help link. | `Header.tsx`, `Footer.tsx`, CSS | PASS: mobile drawer and role menu opened |
| 3 | Unit overview and NCC history | Public institutional context, mission, affiliation and contact. | About/UnitIntroduction components | PASS: rendered |
| 4 | Strength counters and public notices | Public snapshot and current notices. | `StrengthAndNotices.tsx`; `/api/public/stats`, `/notices` | BLOCKED: API absent; route unit tests pass |
| 5 | Senior appointments | Public rank-holder cards / confirmation state. | `MeetOurSeniors.tsx`; rank-holder API | BLOCKED: dynamic endpoint unavailable |
| 6 | Events and training camps | Public event/camp schedule and filters. | `UpcomingEvents.tsx`; public events/camps routes | BLOCKED: API absent; public route unit tests pass |
| 7 | Achievements | Verified cadet/unit achievements. | `Achievements.tsx`; public achievements route | BLOCKED: API absent; route unit test passes |
| 8 | Public photo gallery | Filtered approved media and image delivery. | `GallerySection.tsx`; public gallery APIs | BLOCKED: browser showed load failure without API |
| 9 | Cadet enrollment information | Eligibility and enrollment journey. | `JoinNCC.tsx` | PASS: static section rendered |
| 10 | Cadet registration form | Cadet profile, academic data, email/mobile proof, password, photo, face descriptor. | `RegisterModal.tsx`, `AuthContext.tsx`, auth/attendance APIs, User/BiometricTemplate | PASS: dialog inspected; BLOCKED: no submission or provider/database integration |
| 11 | Email/mobile registration OTP | Verify destination before registration. | Auth controllers, OTP/recovery services, email/SMS adapters | BLOCKED end to end; mocked backend OTP tests pass |
| 12 | Login and login OTP | Authenticate regimental number/password; verify OTP when required. | `LoginModal.tsx`, AuthContext, auth controllers, AuthSession/OtpChallenge | PASS: dialog opened; BLOCKED: no credentials/API session |
| 13 | Password recovery | Request, resend, verify OTP and set a new password. | `ForgotPasswordModal.tsx`; recovery controller/challenges | PASS: dialog and empty-field validation; mocked recovery suites pass; real delivery BLOCKED |
| 14 | Role-based command shells | Admin/ANO, platoon senior, senior, drill instructor and cadet panels. | `RoleShellView.tsx`; RBAC middleware | PASS: unauthenticated role menu leads to login; BLOCKED: no signed-in walkthrough |
| 15 | Cadet profile/service record/lifecycle | View service data; staff manage status and platoon assignment. | CadetProfile, hierarchy/admin/serviceRecord controllers | BLOCKED: authenticated API required |
| 16 | Hierarchical enrollment review | Senior → Platoon Senior → ANO approval, return or rejection. | Review/Hierarchy views and APIs; User/ReviewRecord/AuditLog | BLOCKED end to end; backend policy tests cover selected rules |
| 17 | Digital cadet ID and verification | Authenticated ID display, public token verification and QR support. | `DigitalIdView.tsx`; digital ID routes; QR library | BLOCKED browser/API; backend security suite passes digital ID controller tests |
| 18 | Attendance sessions and muster | Create session, eligibility preview, manual marks, live stats and closure. | Role shell, attendance controllers; TrainingSession/TrainingAttendance | BLOCKED live; mocked backend attendance suite passes |
| 19 | Face enrollment and face attendance | Browser model inference and descriptor match with single-use challenge. | FaceEnrollment/FaceAttendance modals, `/models`, attendance APIs | NOT TESTED live: no camera permission or participant capture; backend security tests pass |
| 20 | Attendance history and summary | Cadet history, summaries, absent list, roster import and notification ledger. | Attendance screens/controllers | BLOCKED: API/database not running |
| 21 | Leave applications and approvals | Apply, review through hierarchy, cancel, record remarks. | Leave views/controllers; Leave/LeaveReviewRecord models | BLOCKED live |
| 22 | Duty roster | Assign duties and track status. | `DutyRosterView.tsx`, duty routes; Duty model | BLOCKED live |
| 23 | Camp nominations and documents | Create/manage camps, apply, select participants and attach documents. | Camps views/controllers; Camp/CampParticipant/CampDocument | BLOCKED live |
| 24 | Calendar and timeline | Calendar events and personal/unit service timeline. | Calendar/Timeline views and routes; Event/TimelineEvent | BLOCKED live |
| 25 | Certificates and rank progression | Issue/revoke/verify certificates and promote cadets. | Certificate/rank views and APIs; Certificate/RankHistory | BLOCKED live |
| 26 | Notices, media and institutional info administration | Publish notices, manage gallery/rank-holder media and contact details. | Admin/MediaManagement views; Notice/GalleryPhoto/RankHolder/InstitutionalInfo | BLOCKED live |
| 27 | Inquiries, notifications, search, assistant and mobile | Official inquiry threads; email/push preferences; global search; Command Saathi; Flutter companion workflows. | Request/Notification/Search/Assistant routes; Flutter `mobile/lib` | PARTIAL: local UI and automated suites only; service/provider end-to-end blocked |

## Web navigation and pages

- `/`: one-page institutional landing site with anchors for notices, about, seniors, activities, gallery and contact.
- `/verify-id/:token`: token-based public digital-ID verification view.
- Login, registration and recovery are dialogs on the homepage.
- Authenticated role panels are conditional shell views rather than separate URL pages.

## Verification rules

- “PASS” means the stated interaction was actually observed, not that every integration behind the feature passed.
- Route/controller mock tests are reported separately from browser/API/database end-to-end checks.
- No feature is considered end-to-end working solely because a component or route exists.
