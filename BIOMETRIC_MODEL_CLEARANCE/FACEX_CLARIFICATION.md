# FaceX recognition weights — maintainer clarification draft

**Status:** Draft only. Do not send without review.

**Candidate:** FaceX recognition weights; exact variant/artifact to be specified by maintainer before evaluation.  
**Owner/contact channels:** FaceX [GitHub issues](https://github.com/facex-engine/facex/issues), [releases](https://github.com/facex-engine/facex/releases), or maintainer contact listed in the repository: `bauratynov@gmail.com`.  
**Current evidence:** The repository states its own code and recognition weights are Apache-2.0 and describes MobileFaceNet/ArcFace recognition training on MS1M-RefineV2. The first public release [v1.0.0 at commit `edad256`](https://github.com/facex-engine/facex/releases/tag/v1.0.0) lists `edgeface_xs_fp32.bin` (7 MB); the current README describes additional model variants. The release does not provide enough artifact-level detail here to associate every described variant with one immutable revision and checksum. The repository’s bundled MiniFASNet is third-party and must be assessed separately.

## Message draft

**Subject:** FaceX recognition checkpoint, training-data rights, and institutional-use clarification

Hello FaceX maintainer,

We are considering FaceX for a CPU-hosted local face-verification service in an NCC cadet management system. The intended use is 1:1 verification for attendance on institution-controlled hardware, with no third-party inference API. Cadets may include individuals under 18. We have not downloaded or integrated FaceX weights.

The repository describes Apache-2.0 licensing for the engine and certain recognition weights, and identifies MS1M-RefineV2 as training data. We need to confirm terms for the exact checkpoint and distinguish source-code licensing from pretrained-weight and training-data rights.

Could you please identify the recommended recognition artifact and clarify:

1. What exact filename/variant, immutable release or commit, model version, file size, and SHA-256 identify the checkpoint you recommend for local CPU inference?
2. Is this exact weight file covered by Apache-2.0? Does that license permit institutional/nonprofit biometric verification and attendance use?
3. Is the model self-hostable? May we redistribute the exact weights inside a deployment package or application, or is a separate license required? Please specify any fees or restrictions.
4. Which named training datasets and versions were used for this exact checkpoint? Please clarify the MS1M-RefineV2 source/derivation, data collection basis, and rights that support commercial/institutional downstream use.
5. May we convert, quantize, fine-tune, or otherwise create derivative weights? May converted or derivative artifacts be redistributed, and what attribution/NOTICE is required?
6. Are there restrictions on biometric identification, authentication, attendance, public-sector/institutional use, or use involving cadets/minors?
7. Does the grant differ between `nano`, `tiny`, `standard`, `xs`, or other release/model variants? Which are publicly licensed versus separately licensed?
8. Please identify the separate MiniFASNet artifacts in FaceX, their exact upstream revisions/checksums, license, training-data provenance, and whether that component has additional restrictions.

We would appreciate written answers or authoritative links that can be retained in a model compliance record. We will not deploy any variant before the license, provenance, privacy, and performance reviews are complete.

Thank you,

AIT NCC project team

## Reply record

- Contacted by / date: Not contacted
- Maintainer response: Pending
- Evidence URL or attachment: Pending
- Reviewer / date: Pending
- Decision: Not cleared

