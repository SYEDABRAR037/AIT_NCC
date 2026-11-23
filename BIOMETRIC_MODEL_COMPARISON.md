# AIT NCC — Biometric Model Comparison

**As of:** 2026-11-22. No downloads or executions performed.

## Recognition

| Candidate | Architecture / dimensions | License and data evidence | Reported performance / runtime | Result |
|---|---|---|---|---|
| AuraFace glintr100.onnx | ResNet-100, ArcFace-style; verify output dimension against pinned file. | Repo labeled Apache-2.0; card claims commercial intent but does not name training sets. Exact weight and data rights need confirmation. | No independent comparable benchmark located; ONNX CPU is technically possible but model is comparatively large. | NO-GO |
| OpenCV SFace 2021dec ONNX | MobileFaceNet + SFace loss; OpenCV's sample describes a 128-float feature vector. | Model directory says Apache-2.0; training data and upstream weight authorization unresolved. | Zoo reports 0.9940 from its evaluation tooling. Not an independent matched comparison, demographic result, or operational FAR/FRR. CPU DNN supported. | NO-GO |
| FaceX Engine | MobileFaceNet variants; README lists 256D nano, 512D others. | Maintainer claims Apache-2.0 for own weights; release distinguishes separately licensed larger variants. MS1M-RefineV2 rights unresolved. | Maintainer reports LFW 95.62–99.07% and ~3ms CPU; no independent reproduction in this review. | NO-GO |
| InsightFace public packs | ResNet50/WebFace600K for buffalo_l according to model zoo. | Official code MIT; pretrained models non-commercial research only. | Official project provides several benchmark metrics, not AIT evaluation. | NO-GO absent separate license |
| Existing face-api.js | Browser face descriptor path; repository code MIT. | Maintainer says bundled model files MIT, while referring to original model terms; this project has not established exact local model/data lineage. | Browser inference is technically available but descriptors are client-controlled and untrusted. | NO-GO as trusted production path |
| AdaFace / FaceX-Zoo | Research alternatives; exact artifact varies. | Public repos list datasets such as MS1MV2, MS1MV3, WebFace4M, CASIA-WebFace; exact checkpoint grants and data rights unresolved. FaceX-Zoo has third-party license components. | Research metrics are not evidence of permissions or NCC performance. | NO-GO |

### Benchmark interpretation

SFace's figure is OpenCV Zoo's own evaluation result. FaceX's LFW/latency figures are maintainer claims. InsightFace figures are vendor-project results. No common benchmark was established. LFW accuracy is not security-relevant FAR at a calibrated threshold. No demographic disparity, AIT latency/RAM, or representative false-reject data was measured.

## Detection

| Candidate | Evidence | Result |
|---|---|---|
| OpenCV YuNet | Zoo README says files in its model directory are MIT, and reports WIDER Face AP. CPU/OpenCV DNN capable. Detection only; pin exact dated file/hash before future use. [README](https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/README.md) | Potential detection-only candidate, not a complete biometric solution |
| FaceX detector | Maintainer-described FCOS-style MobileNetV2-lite, WIDER FACE trained, compact CPU detector. Exact artifact license/hash not established. | NO-GO pending exact artifact rights |
| face-api detector | Existing browser-capable option; no project-specific validation and no trusted server capture boundary. | Not approved for secure evidence |

## PAD

| Candidate | Method and evidence | Limitations | Result |
|---|---|---|---|
| MiniFASNet V1/V2 | Single-frame crop classifier; repository code Apache-2.0. Checkpoint license, revision, hash, training data and rights unresolved. | No verified APCER/BPCER evidence for print, screen replay, video injection, masks, camera variation and relevant groups. Does not secure trusted camera input. | NO-GO |
| FaceX-bundled MiniFASNet | Third-party component named by FaceX. | Exact checkpoint and upstream rights remain unresolved. | NO-GO |
| Blink/head-turn/nonce | Protocol interaction only, not a PAD model. | Cannot alone defeat injected/replayed streams or establish liveness. | Insufficient |

## Runtime architecture

A private Python inference service could technically sit behind Express, with React calling only Express; Express should retain session, consent, eligibility, audit and encrypted-storage authority. CPU inference is plausible for OpenCV/ONNX and FaceX claims, but self-hosting does not imply legal permission. Do not add a service or dependencies until exact artifact clearance and approvals exist.

## Sources

- [AuraFace card](https://huggingface.co/fal/AuraFace-v1/blob/main/README.md) · [file metadata](https://huggingface.co/fal/AuraFace-v1/blame/main/glintr100.onnx)
- [SFace README](https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/README.md) · [SFace license](https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/LICENSE) · [OpenCV 128-feature sample](https://github.com/opencv/opencv/blob/5.x/samples/dnn/js_face_recognition.html) · [OpenCV benchmark](https://github.com/opencv/opencv_zoo/blob/main/benchmark/README.md)
- [FaceX README](https://github.com/facex-engine/facex/blob/main/README.md) · [release](https://github.com/facex-engine/facex/releases/tag/v1.0.0)
- [MiniFAS repository](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing) · [dataset issue #125](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/issues/125)
- [InsightFace model terms](https://github.com/deepinsight/insightface/blob/master/python-package/docs/model_zoo.md) · [AdaFace](https://github.com/mk-minchul/AdaFace) · [FaceX-Zoo](https://github.com/JDAI-CV/FaceX-Zoo)
- [face-api.js model-license discussion](https://github.com/justadudewhohacks/face-api.js/issues/315)
