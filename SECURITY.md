# Security Policy

## Supported versions

Security fixes are accepted against the default branch of this repository (`main`). Published plugin versions inherit those fixes on the next release or marketplace refresh.

## Reporting a vulnerability

Do **not** open a public GitHub issue for security reports that include exploit details, credentials, or private user data.

Report vulnerabilities privately by emailing the maintainers through the contact methods listed on the [GitHub repository](https://github.com/Aqua-123/pstack-for-codex), or by opening a private [GitHub Security Advisory](https://github.com/Aqua-123/pstack-for-codex/security/advisories/new) when that feature is available.

Please include:

- a clear description of the issue and its impact
- steps to reproduce, or a proof of concept when safe to share
- affected plugin version or commit SHA when known

We will acknowledge receipt when possible and coordinate disclosure after a fix is available.

## Scope notes

This repository is a Codex plugin of skills, hooks, and local helper scripts. It does not ship a network service. Reports about third-party tools invoked by user-directed workflows (for example `git`, `gh`, or Bun) should be filed with those projects unless the vulnerability is in this repository's wrapping code or instructions.
