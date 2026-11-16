# Bug and Fix Log

| ID | Issue | Location | Root cause | Fix implemented | Retest result |
|---|---|---|---|---|---|
| AUD-01 | Nodemailer version matched published production advisories | Frontend/backend lockfiles | Resolved packages were below patched release. | Compatible lockfile updates via `npm audit fix --omit=dev`. | Frontend build/tests and backend build/tests passed. Production audit no longer reports Nodemailer. |
| AUD-02 | Backend dependency graph included vulnerable body-parser, brace-expansion, follow-redirects, multer, proxy-addr and qs versions | `backend/package-lock.json` | Locked transitive versions fell in advisory ranges. | Updated compatible transitive resolutions without a major Prisma change. | Backend build and test command passed. Production audit retained Prisma-related findings only. |
| AUD-03 | Frontend development dependency graph had Vite/source-map-js findings | `frontend/package-lock.json` | Locked versions were within advisories. | Ran compatible `npm audit fix` for frontend. | Full frontend audit reported zero vulnerabilities; build and tests passed afterward. |
| AUD-04 | Initial backend test command could not import Prisma enum exports | Generated `@prisma/client` state | Prisma client had not been generated in the initial local dependency state. | Ran the existing backend build (`prisma generate` + TypeScript compile). | Test command passed on rerun. Fresh-install test command ordering still depends on client generation. |
| AUD-05 | Homepage dynamic sections and gallery fail when API is unavailable | Local runtime | Vite proxy targets API port 5050; backend is absent. Starting API would launch a delivery worker against existing DB/mail configuration. | No application fallback or fake data added. Recorded as a blocked environment/integration check. | Frontend serves 200; API routes are unavailable locally. |

## Existing findings retained for follow-up

- Prisma 6 CLI/config dependency advisories require a major Prisma 7 migration and compatibility review; no force upgrade was performed.
- Bundle size exceeds Vite's 500 kB advisory threshold.
- Repository migration-readiness notes record schema/migration gaps; no migration or database write was attempted.
- Rate limits implemented with process-local stores do not provide deployment-wide enforcement across replicas.

No existing application source behavior was changed during this audit. Pre-existing uncommitted worktree edits were left unstaged and untouched.
