# MR/PR gallery

## Authorization and preservation

An MR/PR URL alone is not authorization to modify it. Prepare the gallery and validate evidence first; update the target description only when the user has requested that update. Existing authorization remains valid and does not need to be requested again.

Read the current MR/PR description before editing. Replace or create only a clearly owned Playwright flow section and preserve every unrelated section. Do not change MR/PR state, reviewers, labels or target branch.

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
