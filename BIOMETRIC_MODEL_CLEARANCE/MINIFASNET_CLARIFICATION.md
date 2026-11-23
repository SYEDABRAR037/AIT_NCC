# Silent-Face-Anti-Spoofing / MiniFASNet — maintainer clarification draft

**Status:** Draft only. Do not send without review.

**Candidate artifacts:** `2.7_80x80_MiniFASNetV2.pth` and `4_0_0_80x80_MiniFASNetV1SE.pth`  
**Owner/contact channels:** [MinivisionAI repository](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing), its [issues](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/issues), and the open [dataset-provenance question #125](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/issues/125).  
**License evidence:** The repository has an Apache-2.0 license file. This does not alone prove that each pretrained weight or its training data is licensed on those terms.  
**Current gaps:** No immutable weight revisions or verified checksums were established for the two checkpoints. The public issue asking about their training data did not provide a clear dataset answer in the material reviewed.

## Message draft

**Subject:** MiniFASNet checkpoint licensing, training data, and institutional PAD-use clarification

Hello MinivisionAI maintainers,

We are evaluating the Silent-Face-Anti-Spoofing MiniFASNet checkpoints for a local presentation-attack detection (PAD) component in an NCC cadet management system. The service would run on institution-controlled CPU hardware, with no third-party inference API. It may serve cadets under 18. We have not downloaded or integrated the checkpoints.

The repository contains an Apache-2.0 license. We understand that source-code licensing, exact pretrained-weight licensing, and training-data rights can differ. Could you please clarify the following for each checkpoint separately?

- `2.7_80x80_MiniFASNetV2.pth`
- `4_0_0_80x80_MiniFASNetV1SE.pth`

1. What immutable release/commit, file size, and SHA-256 identify each official checkpoint? Are there official converted ONNX artifacts, and if so, what are their exact identifiers and hashes?
2. Does Apache-2.0 apply to the exact pretrained weights themselves, including downstream copies? Does it permit institutional/nonprofit PAD use in an attendance system?
3. May we self-host and redistribute these exact weights in our application/deployment package? Are separate permissions, fees, attribution, or NOTICE text required?
4. May we convert, quantize, fine-tune, or otherwise produce derivative weights? Can those derivative files be redistributed, and under what notices/terms?
5. Which named datasets, versions, and source material trained each checkpoint? What were the bona-fide and attack classes, and what rights/permissions cover those data and downstream weight use?
6. Are there restrictions on biometric identification, attendance, institutional/public-sector use, or use involving cadets/minors?
7. What evaluation evidence is available for print attacks, display/video replay, masks, varied cameras, lighting, skin tones, and real-world operating thresholds? Please distinguish published test results from internal results.
8. Does a single-frame MiniFASNet score represent PAD only, or is any additional protocol required? We will not treat a nonce or user action as proof of liveness.

Written answers or authoritative documentation would help us assess the exact checkpoints. We will not enable biometric attendance unless both rights and independent performance validation are satisfactory.

Thank you,

AIT NCC project team

## Reply record

- Contacted by / date: Not contacted
- Maintainer response: Pending
- Evidence URL or attachment: Pending
- Reviewer / date: Pending
- Decision: Not cleared

