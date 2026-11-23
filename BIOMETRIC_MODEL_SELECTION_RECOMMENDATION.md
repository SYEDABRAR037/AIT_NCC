# AIT NCC — Biometric Model Selection Recommendation

**Decision: NO-GO.** Do not select or integrate a face recognition or PAD model at this time.

## Basis

No candidate satisfies the combined gates for exact checkpoint identity, weight-specific license, named training-data provenance and rights, intended institutional biometric use, minor-related restrictions, privacy review, and representative reliability evaluation.

- **AuraFace:** commercial-use language is encouraging, but dataset sources/rights are unnamed and exact artifact clearance is incomplete.
- **OpenCV SFace:** best public weight-license signal of the candidates (Apache-2.0 at model-directory level) and a reported exact digest/revision. Exact training provenance and upstream authorization remain unanswered.
- **FaceX Engine:** promising reported CPU size/performance; exact variant licensing is ambiguous and MS1M-RefineV2 rights are unresolved.
- **MiniFASNet:** code license does not settle checkpoint/data rights; attack performance is not established.
- **InsightFace public models:** official terms say non-commercial research only; institutional use would require a separate license.
- **Existing face-api:** current browser descriptors are client-controlled. Do not treat them as trustworthy enrollment or verification evidence.

## Next steps

1. Obtain institutional authorization to contact maintainers and approve the intended purpose.
2. Send the existing unsent clarification drafts and retain written responses for exact filenames, immutable revisions/hashes, weight terms, dataset names/rights, institutional/minor restrictions, redistribution, conversion, derivatives and attribution.
3. Complete authorized privacy review of purpose, consent/assent/guardian policy, manual alternative, access, retention and deletion.
4. Only if an exact artifact clears these gates, independently verify its hash and conduct an authorized isolated evaluation.
5. Assess recognition with calibrated FAR/FRR and demographic subgroup reporting; assess PAD with attack-specific APCER/BPCER and documented camera conditions. No metrics are asserted here.

React/Express/PostgreSQL/Prisma can technically integrate a private local Python inference service, with Express retaining authorization and data control. This is a future architecture option, not approval to implement.

No migration, download, installation, source change, database access, or feature-flag change is authorized by this recommendation. Preserve manual attendance and keep ENABLE_BIOMETRIC_ATTENDANCE disabled.

See [final clearance review](BIOMETRIC_MODEL_CLEARANCE_FINAL.md), [comparison](BIOMETRIC_MODEL_COMPARISON.md), and existing [clarification drafts](BIOMETRIC_MODEL_CLEARANCE/README.md).
