# NCC Account Recovery Audit Report

**Audit date:** 16 November 2026

**Repository branch:** `codex/ncc-release-candidate-20261028`

**Scope:** Existing recovery implementation, repository deployment targets, local preview/API availability, isolated recovery tests, and local mail-provider readiness.

## Executive result

The recovery code is present and its isolated tests cover the core request → OTP → password reset → normal login flow. The requested end-to-end live audit could not be completed because the deployment targets documented in the repository are unavailable: `https://ncc-aitpune.netlify.app/` displays Netlify's “Site not found” page, and `https://ait-ncc.onrender.com/api/health` returns HTTP 404. The local frontend renders, but there is no API listening at `localhost:5050`, so its recovery form cannot reach a backend.

Real OTP delivery was not verified. Local SMTP authentication returned false, and `RECOVERY_RELAY_SECRET` is not configured locally. No OTP was sent and no production/cadet account was changed.

## Existing implementation overview

- The frontend recovery flow is in `frontend/src/components/auth/ForgotPasswordModal.tsx` and is opened from the login modal.
- Recovery requires both the registered email and regimental number. The code is sent by email; phone/SMS recovery is not implemented in this flow.
- Backend routes are mounted in `backend/src/routes/auth.routes.ts`: request OTP, resend OTP, verify OTP, and reset password.
- `RecoveryChallenge` in Prisma stores the user link, lookup hash, bcrypt OTP hash, expiry, attempts, resend count, delivery state, verification time, and used time. The active flow uses this model; `PasswordReset` is a legacy model.
- OTPs are generated with Node's cryptographic random generator, expire after 60 seconds, allow at most five verification attempts, and are invalidated on resend/use. Resend has a 45-second cooldown and a five-send cap.
- Recovery responses are generic for matched and unmatched identifiers. The backend applies IP limits and per-account/pair controls; some throttling uses process-local memory and will not coordinate across multiple replicas.
- Successful reset uses bcrypt cost 12, updates only the password hash, invalidates active sessions and pending login OTPs, marks other recovery challenges used, and writes an audit event. It does not change user role or account status, and normal login remains required.
- The reset token is a signed JWT with a 10-minute expiry and is returned to the frontend after OTP verification. It is held in component memory; refreshing the page loses the in-progress recovery state, so recovery cannot currently resume after refresh.
- Mail delivery uses the recovery mail adapter, which tries the configured HTTPS relay and then direct SMTP. The relay endpoint is part of the Netlify Functions source.

## Live and local checks

| Check | Result | Evidence |
|---|---|---|
| Documented frontend deployment | FAIL | Browser rendered Netlify “Site not found” at `ncc-aitpune.netlify.app`. |
| Documented backend health endpoint | FAIL | HTTPS request to `ait-ncc.onrender.com/api/health` returned HTTP 404. |
| Local frontend page | PASS | `http://localhost:3000/` renders the NCC site and recovery dialog. |
| Local recovery API | FAIL | No listener at `http://localhost:5050`; the frontend reports the recovery service is unreachable. |
| Local SMTP provider authentication | FAIL | Provider verification returned `connected=false`; no credentials or provider error details were recorded in this report. |
| Local recovery relay secret | FAIL | `RECOVERY_RELAY_SECRET` is absent from the local environment. |
| Production deployment configuration | NOT TESTED | No deployment dashboard/credentials were available in the workspace; no production environment variables or database were inspected. |
| Production database compatibility | NOT TESTED | No production connection or migration was attempted. Prisma schema validation and isolated tests are not a production database check. |

## Recovery test results

All result cells below use only the requested status values. The automated checks use a synthetic account and mocked database/mail adapters, and must not be interpreted as a live email or production test.

| Test | Initial Result | Fix Applied | Final Live Result |
|---|---|---|---|
| Forgot Password page | FAIL | NOT TESTED | BLOCKED |
| Registered email recovery | BLOCKED | NOT TESTED | BLOCKED |
| OTP delivery | FAIL | NOT TESTED | BLOCKED |
| OTP verification | PASS | PASS | BLOCKED |
| Expired OTP | PASS | PASS | BLOCKED |
| Password reset | PASS | PASS | BLOCKED |
| New password login | PASS | PASS | BLOCKED |
| Old password rejection | PASS | PASS | BLOCKED |
| Rate limiting | PASS | PASS | BLOCKED |
| Mobile responsiveness | NOT TESTED | NOT TESTED | BLOCKED |

Additional isolated scenarios passing in `backend/src/__tests__/recovery-delivery.test.ts` include unknown-account generic responses, provider failure behavior, resend cooldown/rotation, incorrect OTP rejection, and session revocation. Invalid email format and all five application roles were not exercised against a running service. The recovery query does not filter by role; it uses the same registered email/regimental-number proof for user records and does not update role/status.

## Issue found and change made

**Missing password-change notification:** the existing successful reset path revoked sessions and recorded an audit entry, but did not enqueue a user notification. The reset transaction now creates a mandatory `SECURITY` notification for the account. It uses the existing notification delivery worker/provider setup, and is created atomically with the password update. The isolated recovery test asserts that it is queued. Actual email delivery of this notification remains unverified because the local SMTP provider authentication failed and the live service is unavailable.

Files changed for this audit:

- `backend/src/controllers/recovery.controller.ts`
- `backend/src/__tests__/recovery-delivery.test.ts`
- `ACCOUNT_RECOVERY_AUDIT_REPORT.md`

## Build and test verification

- Backend TypeScript build: PASS.
- Frontend TypeScript/Vite production build: PASS (existing large-bundle advisory remains).
- Isolated recovery delivery, response-characterization, and password-policy tests: PASS.
- Full configured backend suite: PASS.
- Prisma schema validation: PASS.

## Deployment and remaining requirements

No live deployment was performed because the documented frontend currently has no deployed site and the documented API target returns 404. No production migration or account mutation was attempted. Completing live verification requires a working frontend URL, a working API deployment, provider credentials configured in the deployment environment, and a dedicated test account controlled by the owner. Once available, the full live flow, actual message receipt, OTP expiry/reuse/rate-limit cases, role checks, refresh behavior, and new/old password login must be rerun.
