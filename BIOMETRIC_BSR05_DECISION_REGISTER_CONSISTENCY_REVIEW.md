# BSR-05 Decision Register Consistency Review

**Review type:** Read-only consistency analysis. This is not an approval or implementation authorization.

**Safety:** The operational-decision register was not edited. No source code, Prisma schema, SQL, migrations, database, container, or feature flag was changed or accessed. Biometric attendance remains disabled; manual attendance remains independent.

## Finding: stale Decision 5 summary sentence

In `BIOMETRIC_BSR05_P0_3_OPERATIONAL_DECISIONS.md`, line 55 currently says:

> “Maximum/minimum duration and past-start handling remain unresolved and must not be inferred from challenge TTL.”

This sentence conflicts with Decision 5 at line 28 and the current readiness summary at line 77:

- A strictly positive interval is approved: `attendanceWindowEndAt > attendanceWindowStartAt`. This settles the minimum-duration validity rule; it does not set a positive minimum duration beyond end-after-start.
- A late start is approved only when current time is at or after the scheduled start and strictly before the scheduled end. Past-start handling is therefore settled.
- The maximum attendance-window duration is explicitly **DEFERRED / UNDECIDED**.

The approved strict `[start,end)` interval and no-grace rule in Decision 2 at line 25 remain consistent with this: the start boundary is included, the end boundary is excluded, and no attempt is allowed at or after the scheduled end.

## Other consistency checks

1. **Readiness status:** The line 77 summary says the maximum duration remains deferred and lists the remaining technical policy and audit details. This agrees with Decision 5 and the unresolved list at lines 68–73. No readiness status should be raised.
2. **Decision 4:** The table marks the two-person recovery rule `APPROVED`, while the user’s checkpoint describes it as “Recorded.” These descriptions are compatible: the approval is recorded in the register. Identity assurance, designated-principal provisioning, and emergency recovery remain technical gaps in unresolved item 2 and the readiness summary.
3. **Decisions 6–7:** The register distinguishes approved numeric values and high-level choices from unresolved scope, hard retained-row cap, subject cleanup/cadence, additional timeouts, recovery identity verification, and policy-audit details. The readiness summary preserves those blockers. No conflicting approval status was found.
4. **Policy activation audit:** Decision 7B approves two-person proposal/approval and controlled audited activation; lines 63 and 73 leave exact event fields and retention undecided. These statements are compatible: the control rule is approved, while its schema and retention are not.
5. **Decision 5 evidence wording:** Line 28 says “Items 5A, 5B and remaining items 2–4 are approved.” Its meaning is consistent with the following sentence that defers only maximum duration, but “remaining items 2–4” is ambiguous because those numbers are not labeled as Decision 5 subitems. A wording clarification may improve traceability without changing the status.
6. **Technical recommendation report:** `BIOMETRIC_BSR05_REMAINING_DECISIONS_TECHNICAL_REVIEW.md` correctly identifies the stale sentence and labels its proposals as recommendations rather than approvals. Its separate list of project-owner approvals, including maximum duration, agrees with the register’s readiness gate.

No other contradictory approval or readiness statement was identified in the two reviewed documents. The stale sentence is the only substantive status conflict; the Decision 5 evidence phrase is a clarity issue, not a different approval.

## Proposed minimal text correction

Replace only the conflicting sentence fragment in the register’s attendance-window governance paragraph with:

> “The positive interval and late-start rule are approved: require `attendanceWindowEndAt > attendanceWindowStartAt`, and allow a late start only when current time is at or after the scheduled start and strictly before the scheduled end. The maximum attendance-window duration remains **DEFERRED / UNDECIDED** and must not be inferred from challenge TTL.”

Keep the surrounding statements about `Asia/Kolkata`, the strict half-open interval, no grace period, and indefinite integrity-event retention unchanged.

### Optional clarity-only wording

If the project owner wants to remove the subitem-number ambiguity without changing status, replace the Decision 5 evidence-status sentence beginning “Items 5A, 5B and remaining items 2–4” with:

> “**PARTIALLY APPROVED.** Decision 5’s scheduling authority, positive interval, late-start rule, `ADMIN_ANO` role mapping, and active-window correction controls are approved by explicit user approval on 23 November 2026. Maximum duration remains **DEFERRED / UNDECIDED**.”

This is a wording clarification only; it does not approve maximum duration or change any other decision status.

## Status after proposed correction

- Decision 5 remains **PARTIALLY APPROVED**.
- Positive interval, late-start rule, `ADMIN_ANO` authority, manual-attendance role separation, and active-window correction controls remain approved.
- Maximum duration remains **DEFERRED / UNDECIDED** and remains an activation blocker.
- Decisions 6–7 remain at their existing approved/partial/undecided substatuses.
- P0.3 SQL remains **BLOCKED**; no database or migration work is authorized.

