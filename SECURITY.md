# Security

Humanizer is designed to be local-first. Provider credentials must not be stored in repository files, application logs, analytics payloads, or plain-text local databases.

Provider credentials are stored through the operating-system credential store: Keychain on macOS, Credential Manager on Windows, and Secret Service on Linux. The desktop frontend can set, replace, delete, query whether a credential exists, and request a verification check. The native layer does not return saved API keys to the interface.

Credential verification is performed by the native layer against each provider's official models endpoint. Humanizer returns only the verification status and HTTP status code to the frontend; provider response bodies and stored secrets are not exposed.

## Reporting

Do not open a public issue for a vulnerability that could expose credentials, private prompts, profile data, or remote execution paths.

Use GitHub's private vulnerability reporting for this repository when available.

Include the affected version or commit, reproduction steps, expected impact, and any known mitigation. Please avoid accessing data that does not belong to you while validating a report.

## Supported versions

Until the first stable release, security fixes target the latest commit on `main`.
