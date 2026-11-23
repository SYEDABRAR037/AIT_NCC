# AIT NCC biometric model clearance package

This folder contains unsent maintainer clarification drafts and a tracker for four candidate model families. These documents are preparation only: **no emails were sent, no issues were opened, and no model weights were downloaded**.

## Clearance status

No candidate is cleared for biometric attendance. The Phase 2.2 investigation found that public licenses and technical demonstrations do not, on their own, establish rights for exact pretrained artifacts, training data, institutional biometric verification, or deployment involving cadets (including possible minors). The existing system must continue to use manual attendance while these questions and institutional privacy review remain open.

The workspace did not contain `BIOMETRIC_IMPLEMENTATION_PROGRESS.md` when this package was prepared. Current source was inspected directly, and Phase 2.2 findings in the project conversation were used as prior research context. No source, database, or Prisma schema was changed.

## Drafts and tracker

- [AuraFace v1 clarification](AURAFACE_CLARIFICATION.md)
- [OpenCV SFace clarification](SFACE_CLARIFICATION.md)
- [FaceX clarification](FACEX_CLARIFICATION.md)
- [Silent-Face-Anti-Spoofing / MiniFASNet clarification](MINIFASNET_CLARIFICATION.md)
- [Clearance tracker](CLEARANCE_TRACKER.md)

## Handling maintainer replies

1. Send each draft only after reviewing it and choosing an authorized institutional contact identity.
2. Save the complete reply and any referenced legal/model documents without editing the original message.
3. Verify the precise model filename, immutable revision, and SHA-256 independently before evaluating or integrating an artifact.
4. Have institutional privacy/legal reviewers assess biometric identification, attendance, consent, retention, and use involving minors.
5. Record the evidence and reviewer decision in `CLEARANCE_TRACKER.md`.
6. Do not integrate weights or enable automatic attendance until every required clearance and technical validation gate is documented.

## Source links

- AuraFace model card/repository: <https://huggingface.co/fal/AuraFace-v1>
- AuraFace author announcement: <https://huggingface.co/blog/isidentical/auraface>
- OpenCV SFace model README: <https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/README.md>
- OpenCV SFace weights file: <https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx>
- OpenCV SFace clarification issue: <https://github.com/opencv/opencv_zoo/issues/318>
- OpenCV Zoo issues: <https://github.com/opencv/opencv_zoo/issues>
- FaceX repository: <https://github.com/facex-engine/facex>
- FaceX first public release: <https://github.com/facex-engine/facex/releases/tag/v1.0.0>
- FaceX issues: <https://github.com/facex-engine/facex/issues>
- Silent-Face-Anti-Spoofing repository: <https://github.com/minivision-ai/Silent-Face-Anti-Spoofing>
- Silent-Face-Anti-Spoofing license: <https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/blob/master/LICENSE>
- MiniFASNet dataset provenance question: <https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/issues/125>
- Silent-Face-Anti-Spoofing issues: <https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/issues>

