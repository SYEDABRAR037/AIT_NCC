# Biometric Provider Startup Trust — Test Report

**Date:** 2026-11-22
**Scope:** Startup configuration policy, application factory isolation, and test-only mock harness. All tests were guarded/pure; no app server or database was started.

## Results

| Requirement | Evidence | Result |
|---|---|---|
| Production with mock selection | Startup policy with production + mock; separate test adds test markers | PASS — mock rejected directly, conflicting test markers also fail |
| Unknown environment with mock selection | Runtime `staging` plus mock | PASS — unknown runtime rejected |
| Conflicting environment markers | Development plus `RENDER=false`; production plus `VERCEL_ENV=preview` | PASS — non-empty spoofed marker and preview conflict rejected |
| Missing configuration | Provider option enabled without provider selection; blank provider value | PASS — controlled configuration error |
| Explicit test harness | Test mode, pure-mock guard, dedicated harness marker, explicit mock selection/enablement, synthetic allowlist, no hosting markers | PASS — synthetic mock can be created only in this test path |
| Spoofed hosting markers | Test harness combined with `VERCEL`/Render markers | PASS — test-only constructor rejects |
| Production with development/test variables | Production plus pure-test/harness markers (with and without provider selection) | PASS — startup rejects conflicting test markers; application factory and test constructor reject mock |
| No fallback | Unsupported `real` selection and unknown provider | PASS — controlled unsupported error, no mock fallback |
| Factory bypass attempts | Factory called with extra fake environment object while actual process config selects mock | PASS — argument ignored and mock rejected |
| Factory import boundary | Source assertion verifies factory does not import mock module | PASS |
| Startup order | Source assertions verify validator precedes server require and listener | PASS |
| Production TypeScript emit boundary | TypeScript file list excludes `src/__tests__/**/*` and `src/biometrics/mockProvider.ts` | PASS |

## Commands and outcomes

Run from `backend`:

```sh
NODE_ENV=test PURE_MOCK_TEST=true NCC_BIOMETRIC_TEST_HARNESS=true npx ts-node src/__tests__/biometric-provider.test.ts
NODE_ENV=test PURE_MOCK_TEST=true NCC_BIOMETRIC_TEST_HARNESS=true npx ts-node src/__tests__/biometric-provider-startup.test.ts
npm test
npx tsc --noEmit
```

- Focused provider test: **PASS**, five PASS summary groups.
- Startup trust test: **PASS**, five PASS summary groups.
- Existing guarded `npm test`: **PASS**, exit code 0. Isolation (5), database/API safety (12), public routes (7), biometric security (33), Phase 3A security (26), login OTP fallback, recovery response/delivery, password policy and session policy suites passed.
- Backend TypeScript check: **PASS**.
- `npx tsc --noEmit --listFiles` filtered check: **PASS** — no test or mock-provider source in the application TypeScript project.
- `git diff --check`: **PASS**, exit code 0 after documentation was finalized.

During iterative implementation, focused test runs initially failed because a few assertions still expected the previous error ordering (the new production/test-marker conflict check now precedes provider selection). Those expectations were updated to the intended fail-closed policy; the final runs of both focused suites passed. No test was bypassed.

## Limits

- The full production build was not executed because `npm run build` runs `prisma generate`; no Prisma generation was necessary for this code-only check. The no-emit project check and file-list check passed, but no production artifact was built or inspected.
- Tests invoke pure policy functions and assert source ordering. They do not launch an HTTP server or verify hosting control-plane configuration.
- No database was connected, and no migration/schema change was made.
- Application factory has no mock import/path, startup rejects mock, and normal TypeScript emit excludes the mock. Deployment image provenance and production environment settings remain operational controls; environment strings alone cannot attest runtime identity.
- No real provider exists. Unsupported configuration fails closed; no biometric provider is wired to attendance, and the attendance feature flag was not changed.
