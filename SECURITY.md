# Security policy

Commit Zero currently targets a workspace running on loopback for one local
operator. The current source branch is the maintenance target; there is no
supported public hosting configuration or guaranteed security response time.
See [the release boundaries](docs/RELEASE.md) before exposing any service.

## Report a vulnerability

Use GitHub's private vulnerability reporting if the repository's Security tab
offers **Report a vulnerability**:

[Open a private report](https://github.com/antropos17/commit-zero/security/advisories/new)

If private reporting is unavailable, open an issue asking for a private reporting
channel and omit exploit details. Do not post credentials, cookies, account data,
database files, private model prompts or a working exploit in a public issue.

A useful private report includes the affected commit, Node/OS versions, relevant
configuration with secrets removed, reproduction steps, expected security
boundary, observed impact and a minimal sanitized proof. Please test only systems
and data you own or have permission to assess.

## Current boundaries

- Bind services to loopback. Shared-write authorization, public TLS, external
  PostgreSQL operations and remote Git hosting are not qualified for deployment.
- Model output, proposed source and natural-language instructions are untrusted.
  Syntax checks and a model review do not establish runtime correctness or safety.
  Commons retains proposals for explicit operator review and merge; Language lab
  uses a bounded host interpreter rather than arbitrary generated-code execution.
- Keep provider/OAuth credentials and session material out of source, prompts,
  agent instructions, exports and reports. Local runtime state and backups can
  contain private data and must remain outside a published checkout.

Public dependency advisories may be reported as ordinary issues without sensitive
project-specific exploit details. An automated dependency audit is a separate
signal from application security review.
