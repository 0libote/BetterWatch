# Security

BetterWatch is a development project. Security fixes are made against the
current main branch; there is no long-term support commitment for older tags.

Report suspected vulnerabilities through
[GitHub private vulnerability reporting](https://github.com/0libote/BetterWatch/security/advisories/new).
Include the affected version, reproduction steps, impact, and a redacted
example. Keep credential leaks and exploit details out of public issues.

Do not submit Trakt tokens, client secrets, streaming cookies, or private
viewing history. Revoke exposed credentials through the service that issued
them. The Trakt application secret in an extension is not a confidential
server secret; access and refresh tokens still need to remain private.

Trakt credentials and tokens are stored in local extension storage, outside
Chrome Sync. Optional external integrations are described in the README.
Use `.env.example` to document build configuration and keep real values in
ignored local environment files. Public release builds must not contain
personal credentials.
