# OpenCV SFace — maintainer clarification draft

**Status:** Draft only. Do not send without review.

**Candidate:** `face_recognition_sface_2021dec.onnx`  
**Model owner/contact channels:** [OpenCV Zoo issue tracker](https://github.com/opencv/opencv_zoo/issues) and original SFace project [issue tracker](https://github.com/zhongyy/SFace/issues). Existing public discussion: [OpenCV Zoo issue #318](https://github.com/opencv/opencv_zoo/issues/318).  
**Model README/license:** [SFace README](https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/README.md), [model-directory Apache-2.0 license](https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/LICENSE).  
**Artifact evidence:** OpenCV Zoo issue #318 identifies `face_recognition_sface_2021dec.onnx` with SHA-256 `0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79`. Confirm this digest against the selected immutable revision before use.  
**Current gap:** SFace README identifies MobileFaceNet instances trained with SFace loss but does not identify the training dataset for this exact exported checkpoint. A maintainer commented that Apache-2.0 should be clear enough, but the dataset/provenance questions remain unresolved in the reviewed discussion.

## Message draft

**Subject:** Exact SFace 2021dec weights: dataset provenance and institutional biometric-use clarification

Hello OpenCV Zoo and SFace maintainers,

We are evaluating the following exact OpenCV Zoo artifact for a local NCC cadet-management system:

- File: `models/face_recognition_sface/face_recognition_sface_2021dec.onnx`
- Reported SHA-256: `0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79`
- Intended use: local 1:1 face verification for an attendance workflow on institution-controlled hardware; no third-party inference API
- Population: cadets, potentially including individuals under 18

We see the Apache-2.0 license in the SFace model directory. We understand that licensing the OpenCV source code, licensing the pretrained weight file, and having rights to the training data are separate questions. Could an authorized maintainer or original contributor clarify:

1. Is the Apache-2.0 license intended to apply to this exact pretrained ONNX weight file, including the reported SHA-256 above? What immutable Git/LFS revision or release and checksum should we record?
2. Does that grant allow institutional/nonprofit biometric verification and attendance, including local self-hosting and inference?
3. May the file be redistributed inside an application or deployment package? Does redistribution require additional permission, fees, attribution, NOTICE, or other conditions?
4. Are conversion (for example, ONNX to another runtime), quantization, fine-tuning, or other derivatives allowed? May those derivatives be redistributed, and what notices are required?
5. Which exact named datasets, versions, and training configuration produced the 2021dec checkpoint and each quantized variant? Were any derived from datasets with non-commercial/research-only restrictions?
6. Did OpenCV obtain authorization from the original SFace authors to distribute these exact weights under Apache-2.0? Is there documentation or a contribution record establishing that authorization?
7. Are there restrictions on biometric identification, authentication, attendance, institutional deployment, or use involving cadets/minors?
8. Does the SFace directory license apply to the ONNX weights themselves, or only to accompanying code/documentation? Please identify any exceptions.

Written clarification from someone authorized to address the model’s provenance and distribution would help our review. We have not downloaded or integrated these weights and will not enable biometric attendance pending clearance.

Thank you,

AIT NCC project team

## Reply record

- Contacted by / date: Not contacted
- Maintainer response: Pending
- Evidence URL or attachment: Pending
- Reviewer / date: Pending
- Decision: Not cleared

