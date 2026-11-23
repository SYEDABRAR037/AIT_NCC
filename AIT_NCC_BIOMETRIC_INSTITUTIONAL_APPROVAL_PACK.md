# AIT NCC — Institutional Biometric Approval Pack

**Document status:** Proposal for institutional review. This document is not an approved institutional policy, legal opinion, or authorization to collect or process biometric data.

**Decision requested:** Institutional direction on whether, for what purposes, under what safeguards, and for which people a future optional biometric attendance capability may be designed.

> **No biometric attendance activation is requested at this stage. No production database migration is requested. Manual attendance must remain available.** The biometric attendance feature flag is to remain disabled unless separately approved after all policy, technical, licensing, privacy, and operational gates are met.

## 1. Purpose and proposed workflow

The proposed capability would let an eligible cadet choose to enroll a face template and, only if separately approved, use a face verification step for attendance in an authorized session. The purpose would be verification of a claimed identity for a defined attendance activity. It is not proposed as general-purpose face search, surveillance, or identification of people from arbitrary images. Those uses are not authorized by this proposal.

The intended future workflow is:

1. A cadet completes ordinary registration and account approval without biometric capture or consent fields.
2. If the institution approves a defined biometric purpose, an eligible cadet may open a separate, clearly optional enrollment flow. The system presents the exact approved purpose and immutable policy version.
3. The authenticated cadet requests a short-lived, one-time consent challenge bound by the server to that cadet, the purpose, policy version, and authenticated session. The challenge alone is not consent.
4. The cadet explicitly confirms the displayed consent. The server atomically consumes the challenge and records the grant, its subject, purpose, policy version, and time. Staff cannot submit a boolean or act as the cadet to create that grant.
5. A separately authorized staff member may request a limited, one-time enrollment authorization. Enrollment is allowed only after current consent and eligibility checks. A future approved implementation must use trusted server-side processing; client-submitted descriptors are not trusted evidence.
6. If a cadet withdraws consent, the system records the revocation and removes the template from eligibility in the same transaction. Re-enrollment requires fresh subject consent and a distinct enrollment authorization.
7. If attendance verification is later approved, it must be limited to eligible cadets in the specific authorized session and current purpose scope. Manual attendance remains available.

This is a target design, not a claim that the complete lifecycle is implemented or operational today.

## 2. Why enrollment is optional

Face data is sensitive and participation should not be a condition of ordinary NCC portal access. A cadet may decline, be unable to enroll, or later withdraw. That choice must not deny account registration, login, portal functionality, application review, or the manual attendance route. The institution must decide and document an accessible manual alternative and a correction/appeal process before any future use.

## 3. Ordinary registration and manual attendance

Ordinary registration is intended to continue using the system's existing identity fields, validations, OTP checks, account creation, and approval workflow. It must not require a face capture, descriptor, biometric quality score, or biometric-consent boolean, and must not create a biometric template as a side effect.

Biometric consent withdrawal must not disable login, registration, portal access, or manual attendance. Manual attendance continues under its existing authentication, role, session, leave, and duplicate-record controls. This approval pack requests no change to that workflow and no removal of it.

## 4. Information that a future implementation may process

Subject to approval and model clearance, the minimum contemplated data is:

- A face-derived mathematical template/descriptor used for a narrowly defined verification purpose.
- The cadet subject identifier and template lifecycle state, so a template cannot be applied to another cadet or used after revocation.
- The model name/version and descriptor format, to prevent comparisons across incompatible formats.
- An authenticated-encryption envelope and limited quality/processing metadata needed to validate and operate enrollment.
- Consent challenge and audit metadata: purpose, immutable policy version/hash, grant/revocation times, actor identity, and authorization events.

Raw images or video are not established as a required retained dataset in the proposed design. The implementation should minimize capture and avoid retaining raw capture by default. Any collection, temporary processing, retention, or secondary use of images/video requires explicit technical and institutional review before implementation. No biometric data should be reused for unrelated purposes.

## 5. Consent grant, revocation, and re-enrollment

The proposed consent record is tied to one cadet, one approved purpose, and one exact policy version. The server—not the browser or staff client—sets the provider identity and timestamps. The consent challenge is generated with a cryptographically secure random source, stored as a hash, expires quickly, is single-use, and is consumed atomically. Replays and concurrent submissions must not create multiple active grants.

The subject can revoke current consent through an authenticated subject action. Revocation history is preserved as an auditable event; the current-consent pointer is removed, and any dependent active template is quarantined or deleted atomically. Login and manual attendance do not depend on biometric consent.

After revocation, staff cannot restore consent by submitting `biometricConsent: true`. A new grant requires a fresh challenge and explicit confirmation by the subject under the current approved policy. Re-enrollment also requires a separate staff authorization and fresh enrollment processing. Policy changes should use a new immutable policy version; old consent text and historical grants should not be silently edited.

## 6. Minors, guardian consent, and cadet assent

No guardian-consent policy is assumed or enabled by this proposal. The default design is subject self-consent only. A future guardian extension would keep separate identities for the cadet (subject), guardian (consent provider), and staff verifier/witness, with restricted evidence references and an auditable verification result. It should not store guardian identity documents in biometric tables by default.

Before any guardian path is implemented, the institution must define whether guardian consent is allowed or required, eligibility and age/competency rules, evidence and verification standards, what happens when a guardian is unavailable, and whether cadet assent or objection is required. Guardian consent must remain disabled unless an explicit institutional policy and additional implementation approval enable it. This document does not determine legal requirements.

## 7. Data access and authorized personnel

The proposed least-privilege approach is:

- A cadet can view their own consent state and submit their own grant or revocation actions.
- Scoped, authorized staff may request an enrollment authorization for a cadet only when the cadet is eligible and has current purpose-specific consent.
- Staff access to consent evidence, template lifecycle actions, exports, and key administration must be separately defined and logged.
- Ordinary application/API responses should not expose raw descriptors, encryption keys, OTPs, or provider secrets.
- Matching must filter to session-eligible, in-scope cadets before any template is decrypted or compared. Out-of-scope cadet identity must not be disclosed.
- Separation of duties, access review frequency, break-glass access, and the exact permitted roles remain institutional decisions.

## 8. Retention, deletion, accounts, and backups

The institution must set retention periods and legal/records basis for consent grants, revocation events, consent evidence references, challenge metadata, enrollment authorization, biometric templates, security/audit records, and access logs. No period is selected here.

Deletion should distinguish the biometric template from the cadet account and attendance history. Revocation should stop use immediately, while the approved retention rule determines whether the encrypted template is deleted immediately or held quarantined for a defined period. Existing templates without verified consent must be quarantined; consent must never be inferred from encrypted metadata, an old staff checkbox, or an enrollment actor. Their eventual deletion or metadata-only disposition needs an approved rule.

Account hard deletion, pseudonymization, and retention of attributable consent history require an institutional decision. The proposed foreign-key restrictions may prevent silent deletion; a deliberate, reviewed deletion/anonymization path is needed. Backups may retain encrypted rows until their expiry. The institution must define backup expiry, legal holds, and a restore process that reapplies revocation/deletion tombstones and quarantine before restored data becomes accessible. The current shared keyring design does not establish per-cadet cryptographic erasure.

## 9. Proposed security architecture

The design retains the existing React/TypeScript, Node.js/Express, PostgreSQL/Prisma architecture. Biometric templates are proposed to use authenticated encryption (AES-256-GCM) with keys kept outside source code and the database, in backend-managed environment/secret configuration. Associated authenticated data should bind ciphertext to the cadet identity and relevant template metadata. Key rotation requires versioned key identifiers and a controlled re-encryption procedure; key backup and access rules require approval.

Database relations, unique constraints, and PostgreSQL checks/triggers are proposed to enforce subject/purpose/template consistency and to prevent an active template from remaining attached to revoked or superseded consent. Some cross-row invariants need carefully tested deferred triggers plus service-layer checks and transaction locking; ordinary foreign keys alone do not enforce them. Grant/revoke/enrollment operations should be atomic, idempotent where appropriate, and concurrency-safe. Legacy templates should default to quarantined and be excluded before decryption or comparison.

These are architectural proposals and require implementation, review, and disposable-database validation. They are not evidence that all controls are already deployed.

## 10. Limitations and unresolved technical gates

- No recognition model or pretrained weights have been cleared for institutional use. Source-code licensing does not establish model-weight licensing or training-data rights.
- Face detection, recognition/embedding, and matching candidates still require exact artifact/revision/hash, license, provenance, redistribution, and institutional-use clarification.
- Liveness/presentation-attack detection has not been selected or verified. A nonce or one-time challenge helps prevent replay of a request but is not proof of liveness.
- Client-generated or client-submitted descriptors are not trusted biometric evidence. Secure server-side capture/inference and validation remain future work.
- The current security review identifies implementation gaps that must be addressed before use, including durable consent lifecycle and fail-closed handling of legacy templates. Consult the detailed security review before implementation approval.
- Proposed PostgreSQL triggers and concurrency behavior have not been implemented or validated against a disposable database. No production migration is requested here.
- No real-world accuracy, accessibility, environmental robustness, demographic performance, or operational suitability is established.
- The biometric attendance feature flag must remain disabled until the institution separately approves activation after all gates are closed.

## 11. Decisions requested from the institution

Each decision below is open. “Considerations” are prompts for review, not policy recommendations or claims about legal requirements. Record the exact scope and any conditions. A blank or pending decision does not authorize processing.

### D1 — Permitted biometric purposes

**Question requiring approval:** Which purposes, if any, may be permitted independently: optional template enrollment/storage, one-to-one identity verification, attendance recording, or other use? Which uses are expressly prohibited?

**Why it matters:** Consent, data collection, model selection, access, and retention must be limited to approved purposes. A technical enum or feature flag does not itself authorize a purpose.

**Considerations:** Decide each purpose separately; define session and population scope; explicitly consider whether general identification, search, surveillance, or secondary use is out of scope.

**Authorized reviewer’s decision / conditions:** ______________________________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D2 — Consent language and immutable policy version

**Question requiring approval:** What exact consent text, purpose description, policy version, and immutable policy hash should be presented to a cadet?

**Why it matters:** The system must record what the subject actually saw and accepted; later edits must not rewrite historical grants.

**Considerations:** Explain data collected, purpose, optional nature, consequences of declining, withdrawal route, retention, access, sharing, limitations, and manual alternative in understandable language. Obtain appropriate privacy/legal review.

**Authorized reviewer’s decision / approved text reference and version:** ___________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D3 — Guardian eligibility and minor-consent policy

**Question requiring approval:** Is guardian consent permitted or required for any cadets, and what eligibility, evidence, verification, and exception rules apply?

**Why it matters:** The default design supports subject self-consent only. A guardian route changes who may provide consent and requires separate identity, evidence, and authorization controls.

**Considerations:** Define age/competency source and threshold, acceptable relationship evidence, verifier role, evidence system, unavailable-guardian handling, and whether a guardian can revoke. Keep the extension disabled until separately implemented and approved.

**Authorized reviewer’s decision / policy reference:** ___________________________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D4 — Cadet assent and objection

**Question requiring approval:** Is cadet assent required in addition to any guardian consent, and how does an assent refusal or objection affect collection and use?

**Why it matters:** The system needs a clear rule for conflicting subject and guardian choices and for recording the subject’s own position.

**Considerations:** Define assent wording, age/competency applicability, objection and withdrawal handling, and whether a guardian grant can ever override a cadet objection.

**Authorized reviewer’s decision / policy reference:** ___________________________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D5 — Consent, evidence, and audit retention

**Question requiring approval:** How long must grants, revocations, policy snapshots/references, guardian evidence references, challenge metadata, authorization events, audit logs, and access logs be retained, and who may authorize purge?

**Why it matters:** Retention affects privacy, auditability, database relations, deletion, and backup handling.

**Considerations:** Set a period and rationale for each data category; distinguish biometric templates from metadata-only evidence; address legal holds and documented purge evidence.

**Authorized reviewer’s decision / periods and responsible owner:** _______________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D6 — Account deletion and anonymization

**Question requiring approval:** When a cadet account is deleted or anonymized, what happens to templates, consent history, audit records, and references to the cadet or staff actors?

**Why it matters:** Referential integrity may restrict hard deletion, while retaining identifiers may preserve personal data. The system needs a deliberate, testable lifecycle.

**Considerations:** Choose among hard deletion, pseudonymous subject tombstone, or approved anonymization by record type; define treatment of attendance history and legal holds. Do not infer that one strategy is legally required.

**Authorized reviewer’s decision / lifecycle rule:** ______________________________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D7 — Backup expiry and restoration

**Question requiring approval:** What backup expiry schedule, deletion propagation target, legal-hold process, and restore-time revocation/deletion reconciliation are required?

**Why it matters:** A deleted or revoked template may still exist in a backup; restoration must not make it usable again.

**Considerations:** Define backup retention, tombstone source and replay order, quarantine-before-service-access checks, restore evidence, and accountable owner.

**Authorized reviewer’s decision / schedule and controls:** ______________________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D8 — Manual attendance alternative

**Question requiring approval:** What equivalent, accessible manual attendance process and correction/appeal route will be available to cadets who decline, cannot use, or withdraw from biometric processing?

**Why it matters:** Optional enrollment is meaningful only if the non-biometric path remains available and operationally defined.

**Considerations:** Identify responsible roles, accessibility accommodations, evidence and correction steps, timelines, and how staff avoid penalizing nonparticipants.

**Authorized reviewer’s decision / process reference:** __________________________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D9 — Data access and authorized personnel

**Question requiring approval:** Which roles may initiate enrollment authorization, inspect consent/evidence status, revoke or quarantine templates, process deletion, export records, and access or administer encryption keys?

**Why it matters:** Access scope determines authorization rules, separation of duties, audit requirements, and privacy exposure.

**Considerations:** Use least privilege and assignment scope; separate routine attendance from template/key access; specify approval and review cadence, break-glass access, and audit review ownership.

**Authorized reviewer’s decision / role matrix reference:** _______________________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D10 — Re-authentication and challenge/session rules

**Question requiring approval:** Is recent password/OTP re-authentication required for grant, renewal, or revocation, and what challenge lifetime/session invalidation rules are acceptable?

**Why it matters:** These choices affect the risk of a stolen authenticated session being used to grant consent and the usability of the flow.

**Considerations:** Keep challenges short-lived, single-use, subject/session/purpose/policy-bound, and atomically consumed; decide whether logout or session revocation invalidates outstanding challenges.

**Authorized reviewer’s decision / security standard:** __________________________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D11 — Staff witness and enrollment/re-enrollment authority

**Question requiring approval:** May staff witness consent, and which scoped staff roles may authorize initial enrollment or re-enrollment?

**Why it matters:** Staff must not create or restore subject consent. Any witness or enrollment role must be distinct, bounded, and auditable.

**Considerations:** Decide whether witnessing is permitted at all; specify role, evidence, conflict-of-interest controls, authorization expiry, and re-enrollment criteria after revocation.

**Authorized reviewer’s decision / role and conditions:** ________________________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D12 — Policy-version retirement

**Question requiring approval:** What happens to existing grants when a consent policy version is retired or its purpose changes? Is a transition period allowed, or is fresh consent required before further processing?

**Why it matters:** The system must not silently treat acceptance of old language as acceptance of a materially changed purpose.

**Considerations:** Define material-change criteria, re-consent trigger, effective date, and handling of templates while consent is stale.

**Authorized reviewer’s decision / transition rule:** _____________________________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D13 — Quarantine and legacy-template disposition

**Question requiring approval:** How long may legacy templates without verified consent remain quarantined, who may authorize deletion, and what metadata-only evidence should remain?

**Why it matters:** Legacy templates cannot be treated as consented or used for matching. A defined disposition avoids indefinite retention or unauthorized activation.

**Considerations:** Keep matching disabled for quarantined records; never infer consent from metadata; define a deadline, deletion evidence, and treatment of backup copies.

**Authorized reviewer’s decision / disposition schedule:** ________________________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D14 — Database enforcement and privileged operations

**Question requiring approval:** Which database role owns consent-integrity triggers and retention operations, and what runtime privileges are acceptable?

**Why it matters:** Cross-table invariants require more than ordinary foreign keys; trigger ownership and privileged maintenance must not create a bypass around application controls.

**Considerations:** Review trigger security/search paths, deployment separation, runtime least privilege, maintenance logging, and disposable-database validation before any production migration.

**Authorized reviewer’s decision / database control reference:** __________________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

### D15 — Future biometric activation gate

**Question requiring approval:** What authority and evidence are required for any later request to activate biometric attendance, and must approval be purpose-, cohort-, or time-limited?

**Why it matters:** Approval of a policy or schema proposal must not automatically activate processing. Model clearance, secure implementation, testing, privacy review, and operational readiness remain separate gates.

**Considerations:** Require a separate written activation decision after model/weight licensing and provenance, PAD/liveness, server-side processing, consent, security tests, accessibility/manual alternative, and incident response are reviewed. This question does not request activation now.

**Authorized reviewer’s decision / required gate evidence:** ______________________________________

**Reviewer name and designation:** ______________________________  **Approval date:** ______________

## 12. Approval record and boundary

This pack records proposed questions only. A signature on this document should not be interpreted as approval of a production migration, model, deployment, or biometric attendance activation unless the authorized reviewer expressly records that distinct decision and its scope in the appropriate institutional process.

**Institutional authority / office:** ___________________________________________________________

**Authorized reviewer name and designation:** _________________________________________________

**Review date:** ____________________  **Reference / minutes / approval ID:** _____________________

**Overall disposition (select one):**  ☐ Return for revision  ☐ Approve specified policy decisions only  ☐ Other: __________________

**Conditions / scope limitations:** ____________________________________________________________

**Signature:** ______________________________________________  **Date:** _______________________

> This document does not record an approval, does not establish legal compliance, does not authorize collection or processing, does not request a production database migration, and does not request activation of biometric attendance. Manual attendance must remain available.
