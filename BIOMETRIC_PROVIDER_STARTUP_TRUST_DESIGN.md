# Biometric Provider Startup Trust Design

**Status:** Design completed before implementation
**Scope:** Fail-closed provider selection and test-only mock isolation. The provider remains disconnected from attendance.

## Threat model

The relevant threat is accidental or malicious selection of the deterministic mock in a backend process that can handle real users. A mock `SIMULATED_MATCH` or `SIMULATED_PASS` must never become a real verification or attendance decision.

Threat actors and failure sources include:

- A deployment setting `NODE_ENV=development` or `test` by mistake.
- An operator copying test-only environment variables into a deployment.
- A custom host that does not set any well-known hosting marker.
- Conflicting markers, such as a hosted runtime combined with `NODE_ENV=development`.
- A future caller bypassing the provider factory or supplying a fake environment object.
- Provider configuration omissions, typos, unknown names, and provider initialization failures.

Trust boundary: `process.env`, `NODE_ENV`, and common host markers are configuration signals, not attestations of locality or deployment identity. They can help reject inconsistent configurations but cannot prove a host is safe when the operator or process environment is controlled by an attacker. No application-only check can solve a fully misconfigured or compromised deployment control plane.

## Existing runtime facts

- `backend/src/start.ts` loads dotenv before requiring `server.ts`.
- `backend/src/server.ts` validates general runtime configuration before listening. It does not currently validate biometric provider configuration.
- The Docker runner sets `NODE_ENV=production`; `render.yaml` describes a hosted Docker service. These are useful deny signals, not a complete deployment identity system.
- `NODE_ENV` is used across backend services for cookie behavior and test notification behavior. It is not currently a signed or independently attested environment identity.
- The provider factory currently imports and returns the mock provider, and the TypeScript project includes `src/**/*`; this means test-only code is within the normal compilation graph unless explicitly excluded.
- There is no real recognition or PAD provider. Attendance remains separately disabled and the provider is not used by any application route.

## Recommended trust mechanism

Use structural separation as the primary control, with environment validation as a secondary guard:

1. **Application startup never permits `mock`.** Startup validation runs before the HTTP listener starts. If a provider selection is supplied, it must be recognized and supported; `mock` is always rejected in the application runtime, regardless of `NODE_ENV` or any test marker. There is currently no real provider, so any real/unknown provider selection also fails startup rather than falling back.
2. **Default remains biometric-provider-disabled.** When no provider-related configuration is present, startup records/uses the disabled state; no provider is constructed and no attendance behavior changes. Partial configuration without a provider selection is invalid and fails startup.
3. **Factory has no mock path.** The application provider factory does not import the mock module and does not accept caller-supplied environment/config objects. Unknown, missing, unsupported, or mock selections fail closed. Provider exceptions never trigger fallback.
4. **Mock is test-harness-only.** The mock constructor is invoked directly only from the dedicated pure unit-test harness. It requires `NODE_ENV=test`, the existing `PURE_MOCK_TEST=true` guard, a separate explicit `NCC_BIOMETRIC_TEST_HARNESS=true` marker, explicit mock selection/enablement and synthetic allowlist; any recognized hosting marker rejects the harness. The marker is not treated as proof of locality: production startup ignores it and still rejects mock selection.
5. **Do not ship test code as an application artifact.** Exclude `src/__tests__` and the mock implementation from the normal production TypeScript emit. Focused tests continue to run directly with the existing `ts-node` test harness. This keeps test-only construction out of the application build graph.
6. **Deployment-level control remains required.** Protect production deployment settings and image provenance through the hosting/build controls. A custom environment with all trustworthy deployment signals removed or falsified cannot be distinguished from local mode by this repository alone. The app-side design still denies mock in its production application factory and startup validation.

This meets the functional requirement that mock behavior needs an explicit test-only harness, while not trusting an arbitrary environment variable as proof that an application deployment is local. The production application has no mock-selection path even when test variables are present.

## Environment classification policy

| Observed configuration | Application startup result |
|---|---|
| No biometric provider settings | Provider remains disabled; startup continues. |
| Provider-related settings are partial but provider is missing | Fail startup with a sanitized configuration error. |
| `BIOMETRIC_PROVIDER=mock` in production, development, test, unknown, or hosted runtime | Fail startup; mock is reserved for unit harness only. |
| Production plus pure-test or dedicated harness markers, even without provider selection | Fail startup as conflicting runtime configuration. |
| Unknown or unsupported provider name | Fail startup; no fallback. |
| Recognized hosted marker plus development/test runtime marker | Fail startup when provider settings are present (conflicting environment signals). |
| Test harness explicitly enabled and no hosted marker | Pure test harness may construct mock for synthetic unit assertions; application factory/startup still reject `mock`. |
| Hosted marker set to a non-empty value, including strings such as `false` | Treat as a host/deployment signal; it cannot authorize mock use. |

The runtime validator should accept only known `NODE_ENV` values when provider configuration is attempted. Unknown runtime classification must never enable mock selection. Provider-related test harness values must never be accepted by application startup.

## Startup and failure behavior

- Validate biometric provider settings during `server.ts` initialization before `app.listen`.
- If invalid, throw a sanitized error code that names the configuration category only; do not echo environment values or secrets.
- With no provider configuration, leave the current app unchanged and biometric provider disabled.
- If a future real provider fails to initialize, fail startup or expose only a controlled unavailable state according to an explicitly reviewed design; never construct a mock as fallback.
- The current provider factory must reject mock unconditionally and must not accept overrides that weaken startup policy.

## Test plan

Use pure tests importing the database isolation guard first. Do not create a Prisma client or start Express. Cover:

1. Production + mock selection is rejected.
2. Unknown runtime + mock selection is rejected.
3. Development/test runtime combined with hosted markers is rejected by startup validation.
4. Partial/missing provider configuration is rejected when any provider option is present.
5. The explicit test harness can create a mock only with all dedicated test settings.
6. Hosted markers spoofed into the test process prevent test-harness construction; a production marker cannot be overridden by test variables.
7. Production with development/test variables and any recognized hosting marker is rejected.
8. No provider exception or unsupported selection falls back to mock.
9. Factory arguments or alternate configuration cannot bypass policy; factory rejects mock in every environment.
10. Static/build configuration excludes test-only mock and tests from application output.

## Limitations and deployment-dependent items

- A bare process environment cannot establish whether a machine is “local.” The decisive application guarantee is that normal startup/factory has no route to select the mock and the mock source is excluded from normal production emit.
- Docker `ENV NODE_ENV=production` is a default that a deployment operator can override. Hosting configuration and artifact provenance must be controlled outside this code change.
- This repository has no authenticated deployment-identity service or signed environment attestation; adding one would require infrastructure-specific design and is not necessary while the mock is structurally test-only and attendance is disabled.
- No real provider is implemented. Any request to configure one must fail until a separately reviewed implementation exists.

## Planned implementation boundary

Safe source-only changes: add a startup validator, call it before HTTP listen, make the factory reject mock without importing its module, gate direct mock construction behind a dedicated guarded test harness, add hostile environment tests, and exclude test/mock modules from production TypeScript output. No schema/database changes, model installation, route integration, feature flag change, or deployment change is required.
