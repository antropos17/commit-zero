# Contributing

Commit Zero is a local agent workspace. Source publication does not make it a
hosted service. The repository scenario is deterministic; Commons and Language lab
use real local inference only when a local model is configured.

## Development

Use Node.js 24.11 or newer within Node 24, npm and Git. Start with
[README.md](README.md), [the current context](docs/CONTEXT.md) and
[the development workflow](docs/DEVELOPMENT.md).

```sh
npm ci
npm run doctor
npm run map -- commons
npm run build
npm start
```

Open `http://127.0.0.1:4173`. Replace `commons` with your area. A local model and
provider credentials are not needed for the automated check suites. Real model
journeys require separate setup and evidence; see [the local release guide](docs/RELEASE.md).

## Make a bounded change

- Describe the action, current behavior and expected result in an issue or PR.
- Preserve existing work, retained history and local runtime data. Read
  [architecture](docs/ARCHITECTURE.md) before storage or transition changes and
  [DESIGN.md](DESIGN.md) before interface changes. Add migrations instead of
  modifying applied SQL. Update the project map when adding or moving modules.
- Use `npm run check:fast` and the relevant area suite while editing. Run
  `npm run check` against unchanged source before requesting review. Report the
  exact result and any failed or unavailable checks.
- For interface changes, check desktop and narrow layouts in a real browser.
  `npm run test:ui` requires matching Chromium (`npx playwright install chromium`).
  DOM/axe tests do not prove layout, contrast or device compatibility.

GitHub CI runs the full check and Chromium suite in separate jobs. Mocked inference
does not verify an installed model, OAuth provider, public deployment or arbitrary
generated-code execution. Keep those evidence boundaries explicit in a PR.

Never commit `.env`, cookies, credentials, runtime databases, model weights,
backups, verification receipts, caches or generated build/test output. Share only
sanitized reproduction material. Follow [SECURITY.md](SECURITY.md) for a suspected
vulnerability instead of opening a public exploit report.

## Licensing

Submit only material you have permission to contribute. Contributions to original
Commit Zero code are offered under [AGPL-3.0](LICENSE). Preserve upstream license
and attribution notices for third-party material and identify its source in the
PR; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No response time or merge
schedule is guaranteed.
