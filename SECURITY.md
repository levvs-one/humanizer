# Security

Humanizer is designed to be local-first. Provider credentials must not be stored in repository files, application logs, analytics payloads, or plain-text local databases.

When credential support is implemented, secrets belong in the operating-system credential store.

## Reporting

Do not open a public issue for a vulnerability that could expose credentials, private prompts, profile data, or remote execution paths.

Use GitHub's private vulnerability reporting for this repository when available.

Include the affected version or commit, reproduction steps, expected impact, and any known mitigation. Please avoid accessing data that does not belong to you while validating a report.

## Supported versions

Until the first stable release, security fixes target the latest commit on `main`.
