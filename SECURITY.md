# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Email **security@droplet.io** <!-- TODO: confirm address --> with:

- a description of the issue and its impact,
- steps to reproduce (extension version, browser and version),
- any proof-of-concept, if you have one.

We'll acknowledge your report within 3 business days and keep you updated until it's resolved.

## Supported versions

Only the latest version published on the Chrome Web Store and Firefox Add-ons receives fixes.

## Design notes for reviewers

- No access tokens are read or stored; API calls run as first-party requests from the Droplet tab.
- Minimal permissions: `storage`, `sidePanel` (Chrome), and `https://app.droplet.io/*`.
- No remote code; the default extension CSP is unchanged.
- Customer data is never rendered as HTML (`innerHTML` and friends are banned by lint).
