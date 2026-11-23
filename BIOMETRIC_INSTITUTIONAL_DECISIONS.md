# AIT NCC — Biometric Institutional Decision Register

**Status:** All decisions below are pending an authorized institutional owner. This register records questions; it does not decide policy, legal compliance, or consent on the institution's behalf.  
**Scope:** BSR-03 consent lifecycle and any later biometric enrollment/attendance use.  
**Current gate:** `ENABLE_BIOMETRIC_ATTENDANCE` remains disabled. No biometric model is cleared.

## Approval record

| Decision | Required authority | Status | Evidence required before implementation |
|---|---|---|---|
| Permitted biometric purposes | Institutional leadership and privacy/legal reviewer | **PENDING** | Signed purpose statement identifying whether enrollment/storage, verification, attendance, and any identification are permitted independently; explicit prohibited uses. |
| Consent language and policy version | Authorized policy owner and privacy/legal reviewer | **PENDING** | Exact reviewed text and translations, version identifier, immutable SHA-256, effective date, approved locale handling, and publication/withdrawal authority. |
| Guardian eligibility and minor consent | Privacy/legal reviewer and authorized cadet welfare/policy authority | **PENDING** | Whether guardian consent is allowed or required; age/competency source and threshold; acceptable relationship/evidence and verification procedure; who verifies; handling where a guardian is unavailable. |
| Cadet assent and objection | Privacy/legal reviewer and cadet welfare/policy authority | **PENDING** | Whether assent is always required in addition to guardian consent; how assent/objection and later withdrawal affect collection, retention, and use. |
| Consent and audit retention | Records/privacy owner and legal reviewer | **PENDING** | Retention periods and legal basis for grant, revocation, evidence references, challenge metadata, enrollment authorization, audit/outbox data, and access logs; purge authority and evidence. |
| Account deletion/anonymization | Data protection/records owner and legal reviewer | **PENDING** | Whether cadet accounts are hard-deleted, soft-deleted, or pseudonymized; how consent history remains attributable only as permitted; impact of FK restrictions and staff actor retention. |
| Backup expiry and restoration | Infrastructure/records owner and privacy/legal reviewer | **PENDING** | Backup retention/expiry, deletion propagation target, restore-time revocation/deletion tombstone process, legal holds, and proof that restored templates are quarantined before access. |
| Manual attendance alternative | Attendance policy owner and cadet welfare/privacy reviewer | **PENDING** | Written confirmation that cadets declining or unable to use biometrics receive an equivalent, accessible manual attendance process and appeal/correction path. |
| Data access and authorized personnel | Security/privacy owner and command authority | **PENDING** | Roles permitted to issue enrollment authorizations, review consent state/evidence, revoke, export, and administer keys; least-privilege matrix, logging, review cadence, and separation of duties. |

## Additional implementation decisions to record

These decisions are technical-operational choices that still require an accountable owner; they are not settled by the schema proposal:

| Decision | Owner to appoint | Status |
|---|---|---|
| Whether recent password/OTP re-authentication is required for granting or renewing consent | Security owner / institutional policy owner | **PENDING** |
| Consent challenge time-to-live and whether challenges are invalidated on logout/session revocation | Security owner | **PENDING** |
| Whether staff can witness consent and, if so, which staff role and what evidence is recorded | Command authority / privacy owner | **PENDING** |
| How policy-version retirement affects already-granted consent and whether a transition window exists | Policy owner / privacy reviewer | **PENDING** |
| Who may approve re-enrollment and what documented reason is required | Command authority | **PENDING** |
| Quarantine retention period and authorized deletion actor for legacy templates | Records/privacy owner | **PENDING** |
| Database trigger ownership, runtime DB privileges, and privileged retention process | Security/database owner | **PENDING** |

## Decision controls

1. Record the approver's name/role, decision date, exact decision, scope, and evidence/reference for each row before implementation approval.
2. Do not accept a blank or pending value as permission. An unapproved purpose or provider type is rejected by the server policy registry and database constraints.
3. If a decision changes, publish a new immutable policy version and review whether fresh consent is required. Do not edit old policy text or historic grants.
4. Guardian consent remains disabled unless an explicit approved policy enables it and the required evidence, assent, and retention controls are in place.
5. These decisions do not clear pretrained-model licensing/provenance, server-side inference, liveness/PAD, or reliability gates. They do not authorize enabling biometric attendance.
