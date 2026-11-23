# AIT NCC — Development Prototype Consent Plan

**Status:** Synthetic-only design. Demo consent is a software fixture, not valid legal consent or institutional authorization. Do not enroll real cadets or collect real biometric data.

## Boundaries

- Enable only when NODE_ENV=development and an explicit prototype-only switch is active; refuse in production.
- Permit only synthetic identities from a fixture allowlist or dedicated synthetic marker. Do not infer synthetic status solely from an email suffix.
- Do not open a camera, receive real face samples, create BiometricTemplate records, or invoke recognition/PAD.
- Mark all state/results DEMO_ONLY and keep it outside production consent checks.
- Login, registration and manual attendance never depend on this state.

Current User schema has no explicit synthetic marker. Until one is safely designed, keep consent state-machine tests in pure unit fixtures; do not expose dev routes against arbitrary users.

## Demo purpose and policy

Use test-only purpose keys DEMO_FACE_ENROLLMENT and DEMO_ATTENDANCE_VERIFICATION, with a fictional policy fixture carrying a fixed demo version/hash. These are not institutional purposes or published policy. Never present the demo text as an approved notice.

## Development-only API flow

1. POST /api/dev/biometric/consent/challenge: authenticated synthetic subject requests server-generated unpredictable challenge. Bind to subject from auth principal, purpose, demo policy version/hash and durable auth session. Persist digest, expiry and unused state.
2. POST /api/dev/biometric/consent/grant: subject explicitly confirms the displayed demo terms. Ignore/reject client-supplied subject, provider, timestamp, purpose mismatch, policy hash mismatch or boolean authority. Derive actor/time server-side; atomically consume challenge and append grant plus event.
3. POST /api/dev/biometric/consent/revoke: subject revokes own active demo grant; append immutable event. Do not alter account status or manual attendance.
4. POST /api/dev/biometric/enrollment-authorizations: synthetic staff fixture requests one-use INITIAL or REENROLL authorization scoped to subject, current demo grant and purpose. Staff cannot grant consent.
5. POST /api/dev/biometric/enrollment-authorizations/:id/consume: atomically consume once. This authorizes only a mock enrollment exercise; no image/template is created.
6. GET /api/dev/biometric/consent/status and /history: subject sees own demo state; test administrator may inspect only allowlisted synthetic fixtures.

Do not mount routes in production. If route absence cannot be guaranteed, expose the state machine only through unit tests, not application HTTP endpoints.

## Logical state and transitions

For pure mock tests, use injected in-memory adapter; short test constants (example challenge 2 minutes, authorization 5 minutes) are demo values, not policy. It is process-local and must not be used for multi-instance or live attendance authorization.

Logical records: DemoChallenge (digest, subject, auth session, purpose, policy version/hash, expiry, consumed); DemoConsentGrant (subject, purpose, version/hash, grant time/state); append-only DemoConsentEvent (GRANTED/REVOKED, grant, actor fixture, time, idempotency key hash); DemoEnrollmentAuthorization (subject, grant, issuer, INITIAL/REENROLL, expiry, consumed). These are not Prisma changes.

- Grant requires same subject/session/purpose/policy, unused unexpired challenge, explicit confirmation and server-derived actor/time. Wrong binding must not consume rightful challenge.
- Revoke serializes by subject+purpose, appends event, marks grant revoked and invalidates pending demo authorizations. History is preserved.
- New enrollment authorization requires current demo grant. Re-enrollment requires a fresh subject challenge/grant after revocation and distinct staff authorization.
- Challenge and authorization consumption are single-use; expiry equality is expired; concurrent consumption has one winner.
- Consent withdrawal never blocks portal access or manual attendance.

For future persistence testing, use only a separately created, verified disposable PostgreSQL database after separate authorization; adopt the reviewed consent architecture rather than an ad hoc production model. No existing DB is permitted.

## Audit/data minimization

Synthetic fixture ID, purpose, event kind, fixture actor ID, correlation ID, outcome and server time only. Never log tokens/digests, images, embeddings, passwords, cookies or provider keys. UI and API must say demo only; no record is evidence that a person consented for real collection.

## Required negative tests

Real/unknown account; production environment; mock without explicit switch; staff grant attempt; client-chosen subject/provider/time; wrong purpose/policy; expiry; replay; cross-subject; concurrent duplicate grant; revoked grant used for authorization; re-enrollment without fresh grant; expired/replayed authorization; revoke-consume race; manual attendance after revoke; restart clears mock state; production cannot select mock; no template or attendance write.

## Gate distinction

Unsigned institutional documents do not prevent ordinary prototype development with synthetic identities and no biometric data. They do prevent treating this demo as actual consent, using real cadet data, selecting operational purposes or implementing institutional retention/guardian rules. Persistent production consent still requires approved schema, separate migration authorization and disposable PostgreSQL validation.
