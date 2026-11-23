# AuraFace v1 — maintainer clarification draft

**Status:** Draft only. Do not send without review.

**Candidate:** AuraFace v1 face-recognition model, `glintr100.onnx`  
**Owner/contact channel:** fal model maintainers through the [Hugging Face model discussion page](https://huggingface.co/fal/AuraFace-v1/discussions) or the linked [fal author announcement](https://huggingface.co/blog/isidentical/auraface).  
**Model source:** [AuraFace v1 repository/model card](https://huggingface.co/fal/AuraFace-v1)  
**Current evidence:** Repository is labeled Apache-2.0. The card describes a ResNet-100/ArcFace-style recognizer and states training used a commercial dataset from various sources, without naming those sources. The repo also contains separate detector/attribute ONNX artifacts; this request concerns `glintr100.onnx` only. The `main` branch is mutable, and this package has not downloaded or hashed the file.

## Message draft

**Subject:** Request for AuraFace v1 weight and training-data clarification for local institutional evaluation

Hello AuraFace maintainers,

We are evaluating AuraFace v1 for a locally hosted face-verification workflow in an NCC cadet management system. Processing would run on institution-controlled hardware, with no third-party inference API. The system may serve cadets under 18. We have not downloaded or integrated the model.

We understand that the model repository is labeled Apache-2.0 and that its model card describes commercial use. We also understand that the card describes the training data only generally as a commercial dataset comprising face images from various sources. We need to distinguish the license for the source code or repository from the license and provenance of the exact pretrained weights.

Could you please clarify the following specifically for `glintr100.onnx`?

1. What immutable repository revision, model release, and SHA-256 identify the exact recommended `glintr100.onnx` artifact?
2. Does Apache-2.0 apply to this exact pretrained weight file itself? Does it permit institutional/nonprofit deployment for biometric face verification and attendance, with inference performed locally?
3. May an institution self-host and redistribute this exact file as part of its application or deployment package? Are there additional fees, permissions, or terms?
4. May the weights be converted to other inference formats, quantized, fine-tuned, or otherwise modified? May converted or derivative weights be distributed, and what notices are required?
5. Which named datasets, dataset versions, and source collections were used? What evidence establishes the rights and permissions applicable to training and downstream institutional biometric use? Were images and identities collected with consent or other applicable authorization?
6. What attribution, NOTICE, model-card, or other obligations apply to inference, conversion, fine-tuning, and redistribution?
7. Are there restrictions on biometric identification, authentication, attendance, institutional use, or use involving cadets/minors? Are any jurisdictions or use cases excluded?
8. Are the recognition weights legally separable from the detector and other files in the repository? Please identify any bundled file that has different rights or restrictions.

Written answers or links to authoritative documentation for this exact artifact would help us complete our compliance review. We will not deploy the model until licensing, privacy, and technical review are complete.

Thank you,

AIT NCC project team

## Reply record

- Contacted by / date: Not contacted
- Maintainer response: Pending
- Evidence URL or attachment: Pending
- Reviewer / date: Pending
- Decision: Not cleared

