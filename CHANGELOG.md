# Changelog

## 0.1.0 - 2026-11-09

- Buffer and inspect assistant text and reasoning before releasing model chunks.
- Reject system, developer, user, DSH reminder, and goal-message impersonation.
- Preserve tool-call arguments and all existing DSH tool permissions.
- Retry provenance violations with a hard configurable cap.
- Fail closed on response-buffer overflow.
- Add protocol-integrity system guidance and route filters.
