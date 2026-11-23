# AIT NCC — Final Biometric Model Clearance Review

**Review date:** 2026-11-22  
**Scope:** Public primary-source review and repository clearance records. No weights were downloaded, installed, hashed locally, or executed. No maintainer was contacted. This is not legal advice or institutional approval.

## Decision

**NO-GO: no recognition/PAD combination is cleared for this deployment.** Each candidate has unresolved artifact-level, training-data-rights, institutional-use, or reliability questions. A repository's software license does not automatically license weights or resolve training-data rights.

| Candidate | Exact artifact evidence | License/provenance finding | Decision |
|---|---|---|---|
| AuraFace v1 | glintr100.onnx, 260,694,151 bytes; Hugging Face LFS metadata reports SHA-256 a7933ea5330113b01c9b60351d8f4c33003f145d8470ac5f0e52ee2effe25c60. Main is mutable; this review did not independently recompute the hash or pin a full immutable commit. | ResNet-100, ArcFace-style. Repo is labeled Apache-2.0 and card claims commercial-use intent, but card describes data only as commercially/publicly available sources without naming them. Weight grant, redistribution and use involving minors require written clarification. | **NO-GO** |
| OpenCV SFace | face_recognition_sface_2021dec.onnx; reported SHA-256 0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79, size 38,696,353; issue #318 identifies revision 48b10fa505aeb51fbd127fc60a5c660040e823b7. | MobileFaceNet + SFace loss. Model directory says Apache-2.0, but exact checkpoint training data and upstream authorization remain unresolved in reviewed maintainer discussions. A maintainer comment is not dataset provenance or institutional approval. | **NO-GO** |
| FaceX Engine | v1.0.0 at short commit edad256 lists edgeface_xs_fp32.bin (7 MB); no exact file SHA-256/revision was established. Larger variants are described as separately licensed in the release. | Maintainer claims Apache-2.0 for own code/weights and names MS1M-RefineV2. Exact variant grant and dataset rights are unresolved. Do not conflate FaceX Engine with JDAI-CV FaceX-Zoo. | **NO-GO** |
| MiniFASNet / Silent-Face-Anti-Spoofing | Candidate names 2.7_80x80_MiniFASNetV2.pth and 4_0_0_80x80_MiniFASNetV1SE.pth; immutable revisions and hashes not established. | Repository code license is Apache-2.0; exact weight grant and training datasets/rights are not established. Public issue #125 asks about datasets. Robustness to required attacks is unverified. | **NO-GO** |
| FaceX bundled MiniFASNet | Exact third-party checkpoint identity not established. | FaceX's summary does not establish upstream weight/data rights or PAD reliability. | **NO-GO** |
| InsightFace public pretrained packs | Example packs include buffalo_l; exact hashes are not needed to decide current license gate. | Official documentation says pretrained model packs are for non-commercial research only. Institutional use requires a separate license and does not meet the current free-use constraint. | **NO-GO** |

## Maintenance and vulnerability evidence

The official repositories and issue trackers remain publicly accessible and show ongoing issue activity at review time, but activity alone does not establish supported maintenance commitments or a security response SLA. MiniFASNet has a public issue asking about training data and an issue history with reports/questions about maintenance and device-specific results. FaceX Engine is a recent project/release; its short public history is not evidence of long-term maintenance. OpenCV Zoo and AuraFace have active public repository/discussion surfaces, but no project-specific security assessment was performed.

No candidate-specific CVE or exploitable model vulnerability was established in this evidence review. This is not a vulnerability-free finding: no dependency audit, model parser fuzzing, adversarial robustness test, or security advisory search scoped to a pinned artifact was performed.

## Technical evidence and limits

AuraFace's card describes a ResNet-100 ArcFace-style model and generic commercial/public data. It does not name datasets. [Model card](https://huggingface.co/fal/AuraFace-v1/blob/main/README.md) · [LFS metadata](https://huggingface.co/fal/AuraFace-v1/blame/main/glintr100.onnx)

OpenCV's SFace README describes MobileFaceNet models trained with SFace loss and reports 0.9940 accuracy from its own tools/eval. This is repository-reported, not an independent comparison or an NCC operating-point FAR/FRR result. [SFace README](https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/README.md) · [issue #313](https://github.com/opencv/opencv_zoo/issues/313) · [issue #318](https://github.com/opencv/opencv_zoo/issues/318)

FaceX README lists MobileFaceNet variants with 256- or 512-dimensional outputs, LFW figures of 95.62%, 96.85%, 98.25%, and 99.07%, and claims fast CPU inference. These are maintainer-published claims, not independent reproduction. Its v1 release states larger variants are separately licensed. [README](https://github.com/facex-engine/facex/blob/main/README.md) · [v1.0.0 release](https://github.com/facex-engine/facex/releases/tag/v1.0.0)

MiniFASNet is a compact image-crop PAD classifier. A single-frame score does not secure capture against camera injection or prove physical presence. No independently established APCER/BPCER evidence for this system's threat model was found. [Repository](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing) · [dataset question #125](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/issues/125)

YuNet is an MIT-licensed lightweight detector with reported WIDER Face AP results; it is detection only, not recognition or PAD. Its exact dated ONNX file still must be pinned and verified. [YuNet README](https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/README.md)

The current application uses face-api.js/browser descriptor paths. Its code is MIT; the maintainer said bundled model files are MIT while pointing to original model-license terms. This does not settle dataset rights. Browser-submitted descriptors remain untrusted. [face-api.js](https://github.com/justadudewhohacks/face-api.js) · [model license discussion](https://github.com/justadudewhohacks/face-api.js/issues/315)

InsightFace separately documents MIT code but non-commercial research-only pretrained models. [Model terms](https://github.com/deepinsight/insightface/blob/master/python-package/docs/model_zoo.md)

Published metrics are not directly comparable across these different protocols, datasets, thresholds, preprocessing and hardware. No independent matched evaluation, AIT latency/RAM measurement, demographic analysis, calibrated FAR/FRR, or PAD APCER/BPCER was performed. Do not infer reliability from LFW accuracy.

## Maintainer contact

Existing messages in BIOMETRIC_MODEL_CLEARANCE/ are drafts only and remain unsent. No maintainer response or approval exists. The drafts identify official contact routes and ask about exact artifact identity, weight license, dataset names/rights, institutional/minor use, self-hosting, redistribution, conversions/derivatives, attribution and restrictions. Send only after authorization.

## Final Phase 2 outcome

**NO-GO for all recognition and PAD candidates.** No model was selected, downloaded, installed, or run. Continue only after written artifact-specific clearance, privacy review, institutional purpose approval, and an authorized representative evaluation plan. Keep ENABLE_BIOMETRIC_ATTENDANCE disabled.
