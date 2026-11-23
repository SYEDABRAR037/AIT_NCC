# Biometric model clearance tracker

**Status date:** 2026-11-22  
**Policy:** No weights are approved for integration or biometric attendance. A repository license is not treated as proof of training-data rights, exact artifact rights, privacy compliance, or field reliability.

| Candidate | Exact artifact | Revision / SHA-256 | License evidence | Dataset provenance | Maintainer response | Institutional privacy review | Final decision |
|---|---|---|---|---|---|---|---|
| AuraFace v1 | `glintr100.onnx` (recognition weights only; other repo ONNX files excluded from this determination) | Hugging Face `main` is mutable; exact model-file revision/hash not established. Pin and independently hash before evaluation. | Model repo labeled Apache-2.0; model card states commercial use. Exact weight license scope and redistribution terms require confirmation. | Card says commercial dataset from various sources; dataset names and detailed rights not supplied. | Not contacted; pending. Draft: [AuraFace](AURAFACE_CLARIFICATION.md). | Not reviewed; pending institutional privacy/legal review, including cadets/minors. | **Not cleared** |
| OpenCV SFace | `face_recognition_sface_2021dec.onnx` | Reported SHA-256 `0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79`; verify against immutable Git/LFS revision before evaluation. | SFace directory contains Apache-2.0 license; maintainer comment says license should be clear enough, but exact checkpoint scope/upstream authorization remains to document. | Exact training datasets for the 2021dec export are not established in reviewed maintainer responses. | Not contacted; public issue #318 exists but provenance questions remain pending. Draft: [SFace](SFACE_CLARIFICATION.md). | Not reviewed; pending institutional privacy/legal review, including cadets/minors. | **Not cleared** |
| FaceX | Candidate recognition artifact/variant not fixed. First release `v1.0.0` lists `edgeface_xs_fp32.bin`; current repository describes multiple variants. | Release `v1.0.0`, commit `edad256`; artifact SHA-256 not established. Confirm which artifact is available and the license that applies to that exact variant. | Maintainer states Apache-2.0 for project code and own weights; release text distinguishes variants and says larger weights are licensed. Confirm exact grant and redistribution. | Repository describes training on MS1M-RefineV2; exact derivative lineage, data rights, and per-checkpoint provenance need clarification. | Not contacted; pending. Official listed channel includes `bauratynov@gmail.com`; draft: [FaceX](FACEX_CLARIFICATION.md). | Not reviewed; pending institutional privacy/legal review, including cadets/minors. | **Not cleared** |
| Silent-Face-Anti-Spoofing / MiniFASNet | `2.7_80x80_MiniFASNetV2.pth`; `4_0_0_80x80_MiniFASNetV1SE.pth` | Exact immutable revisions and SHA-256 values not established. Do not accept mirrors/conversions without provenance and hash verification. | Repository code license is Apache-2.0; exact pretrained-weight scope not independently established. | Dataset provenance question is open; exact named datasets/versions and data rights not established. | Not contacted; pending. Public issue #125 asks about training datasets. Draft: [MiniFASNet](MINIFASNET_CLARIFICATION.md). | Not reviewed; pending institutional privacy/legal review, including cadets/minors. | **Not cleared** |

## Decision gates before changing a status

1. Record the exact artifact filename, immutable revision, and independently verified SHA-256.
2. Retain authoritative evidence that the license covers the pretrained weights—not only source code—and permits the intended institutional use.
3. Obtain named training-data provenance and a rights explanation for the exact checkpoint.
4. Confirm self-hosting, redistribution, conversion, derivative, and attribution conditions in writing where repository evidence is ambiguous.
5. Complete institutional privacy/legal review for biometric identification/attendance and use involving minors.
6. Complete technical evaluation on representative consenting participants, with documented PAD attack testing and recognition error metrics.
7. Keep automatic biometric attendance disabled until all gates are approved.

## Source links

- AuraFace [model card](https://huggingface.co/fal/AuraFace-v1/blob/main/README.md) · [repository files](https://huggingface.co/fal/AuraFace-v1/tree/main) · [discussions](https://huggingface.co/fal/AuraFace-v1/discussions)
- SFace [README](https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/README.md) · [license](https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/LICENSE) · [issue #318](https://github.com/opencv/opencv_zoo/issues/318)
- FaceX [repository](https://github.com/facex-engine/facex) · [v1.0.0 release](https://github.com/facex-engine/facex/releases/tag/v1.0.0) · [issues](https://github.com/facex-engine/facex/issues)
- MiniFASNet [repository](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing) · [Apache-2.0 license](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/blob/master/LICENSE) · [dataset question #125](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/issues/125)

