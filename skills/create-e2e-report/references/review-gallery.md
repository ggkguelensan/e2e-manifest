# MR/PR gallery

Read for an MR/PR gallery; defines authorization, upload and verification.

## Authorization and preservation

An MR/PR URL alone is not authorization to modify it. Prepare the gallery and validate evidence first; update the target description only when the user has requested that update. A comment requires a request to post a comment; prepare its exact body first. Existing authorization remains valid and does not need to be requested again.

Read the current MR/PR description before editing. Replace or create only a clearly owned E2E report section and preserve every unrelated section. Do not change MR/PR state, reviewers, labels or target branch.

## Upload

Upload PNGs through an authenticated upload mechanism supported by the target Git hosting service. Use the existing connector or CLI when it supports file upload. If upload is unavailable, preserve the prepared gallery locally and report the missing capability; do not silently publish to another host. Never use local paths, base64 images or temporary external hosting.

For every returned URL:

- download it through authenticated access to the target host;
- verify successful response and PNG signature;
- verify the URL belongs to the intended project;
- stop without updating the MR/PR if any upload is missing or invalid.

## Gallery

Group evidence by scenario and then device. Within a device, render steps vertically in user order. Avoid narrow table cells for mobile screenshots.

Each step contains:

- ordinal and user action;
- explicit observable expectation;
- one image for that expectation;
- descriptive `alt` text.

Use collapsible sections for long flows, but keep the primary scenario open. Size mobile screenshots to a readable CSS width without rewriting the image.

After updating the description, fetch it again and verify the number and order of image links against the evidence manifest. Recheck that all links still return valid PNGs.

## Publication transaction

Record the intended host, repository, MR/PR number and owned section in local report metadata. Read the latest description again immediately before updating; merge only the owned section into that latest body. If it changed incompatibly, stop rather than overwrite other edits. Use structured API arguments or a literal body file; never interpolate report text into shell code.

Before retrying an uncertain write, fetch the description/comments and check whether the intended report was already published. Do not duplicate comments or uploads blindly. Record the resulting URL and artifact mapping locally. If upload is unavailable, a text-only report is allowed only if it still satisfies the requested output; otherwise retain the prepared report and explain the limitation.

For design comparisons, preserve the finding IDs, statuses and original/reference pairing from the comparison data. No new pass/fail decision is made by the publication step.
