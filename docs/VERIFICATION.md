# Verification receipt — 2026-10-18

Executed locally:

- ESLint on the server, task scripts, tests and maintained frontend modules.
- Five Node tests: pure lifecycle, merge gate, frame-time fix, transactional API,
  and persistent database close/reopen with concurrent-open refusal.
- One compiled-interface DOM integration test: load, save, offline recovery,
  complete cycle, memory/source links, route focus, escaped search and axe markup checks.
- Vite production build with copied local logos and standalone game previews.
- Production static-serving smoke check: HTML, bundled assets, previews and API;
  configuration and server-source paths are forbidden or not found.
- Full dependency audit: zero reported vulnerabilities.
- Running development server: HTTP 200 on the homepage and provider SVG;
  `/api/health` reported `pglite`, schema 1 and simulation mode.
- Current-run JSON export written with a SHA-256 receipt under `runtime/backups`.
- Impeccable source detector, Design Taste source scan and manual source triage.

Not executed: a separate PostgreSQL server, Docker, real provider calls, hosted CI,
Playwright/browser pixel checks, remote deployment or GitHub publication. See
UI-AUDIT.md for the browser policy blocker and the limits of JSDOM verification.

Storage checks around the batch: approximately 13.1 GB free on C: and 136.4 GB on X:.
Project npm cache approximately 306 MB, embedded database approximately 41 MB.
The existing Docker diagnostic directory remained 32,913,475 bytes; Docker was not
started. No unrelated caches, service settings, volumes or user files were removed.

The diagnostic retention command is explicit, not a background daemon. Verification
receipts, databases and backups are outside its deletion boundary.

## Subsequent visual refinement

After the user's visual feedback, `npm run check` passed again: ESLint, five Node
tests, the production build, the compiled DOM integration test and static-serving
checks. The in-app browser was available for this pass. Desktop, intermediate and
mobile screenshots, narrow overflow, preview launch, Escape and focus restoration
were checked manually. See UI-AUDIT.md for scope and local screenshot locations.

`npm run test:ui` was attempted and stopped before executing the test because
`chromium_headless_shell-1248` is not installed. It is not reported as a passing
browser suite. No database migration or scenario change was made in this pass.

## Typography and stable-update correction

`npm run check` passes with additional compiled DOM regression assertions for
stable event/source nodes, text selection, code scroll, details, focus, route
scroll restoration and fresh-run scroll reset. The bundled UI is about 46.6 kB
JavaScript / 16.6 kB gzip, plus approximately 38 kB of local WOFF2 fonts.

In-app browser: 1440/390px render inspection, loaded Arimo, no mobile document
overflow, no computed CSS motion, code scroll retained through refresh, immediate
preview and Escape/focus restoration. Impeccable scan returned `[]`; dependency
audit reported zero vulnerabilities. The standalone Playwright executable is
still absent; no new claim of a passing full browser suite is made.

## Light/dark GitHub-style appearance

The full check command passes with theme control, persistence, cross-tab event,
pre-paint bootstrap and blocked-storage assertions in the compiled DOM test.
Static serving now checks the restored SVG mark and shared preview theme assets.

Rendered in-app checks: 1440px light/dark home, saved dark theme after reload,
dark PR discussion, both diff themes, repository list and source view, 390px
light/dark home and dark preview.
Computed foreground/background checks passed after fixing the dark diff gutter
markers. There is no document overflow on the 390px home; the theme control is
44px tall. The standalone Playwright suite remains unavailable as documented.

## Final typography refinement (2026-10-18)

`npm run check` passes after the final implementation: ESLint, five Node tests,
production build, compiled DOM integration and production static-serving smoke.
The existing DOM checks cover full simulation flow, recovery, route navigation,
accessible markup, theme persistence and stable source/event/focus/scroll nodes.
The production smoke includes both preloaded font assets. Full dependency audit
reports zero vulnerabilities after replacing the font packages.

Build: approximately 47.6 kB JS / 17.0 kB gzip, 41.0 kB CSS / 8.9 kB gzip, and
59.9 kB of local normal variable WOFF2 subsets. No external font request is
required. Browser inspection and the deliberate Impeccable warning disposition
are recorded in UI-AUDIT.md. Storage remains around 133 GB free on X:, 316 MB
project cache and 40.6 MB user database; tests use isolated databases. Runtime
and secrets are outside the commit. No hosted CI or publication was performed.

## Requested design-skill application (2026-10-18)

Impeccable + Design Taste Frontend + Animate were applied within the existing
application brief. See UI-AUDIT.md for findings, fixes, raw scanner disposition,
the explicit no-motion decision and verification boundaries.

The check command passes with added compiled DOM assertions for intentional
mobile navigation submission, pending-choice retention, skip-link route
preservation, named code regions, selected-file semantics and readable diff
change labels. These augment the existing full scenario, error recovery, theme
and stable-update checks. Browser verification uses emulated viewports and
keyboard actions, not a physical touch device or screen reader.

## React and independent services (2026-10-18)

The final check command passes: ESLint, ten Node tests, production build, the
compiled React DOM integration test and production static-serving smoke. The
service tests exercise real loopback HTTP between four independently started
processes, auth validation/session revocation, profile/bookmark persistence in
the service store, ranking evidence, cache isolation and unavailable dependencies.
The existing disk persistence test still checks close/reopen and writer exclusion.

Measured on the seeded scenario: a cold workspace read uses 13 queries, a warm
revision-cache read uses one; the contribution read model is 565 bytes compared
with 6855 bytes for full state. These are bounded test observations, not a general
throughput benchmark. Conditional upserts avoid rewriting unchanged rows.

React bundle is approximately 285 kB / 87 kB gzip, CSS 48 kB / 10 kB gzip. Mona
Sans is preloaded locally; the Cyrillic subset is available on demand. Full npm
audit reports zero vulnerabilities. No applied workspace SQL migration changed.

Native browser checks used a disposable in-memory cluster and separate hostname.
They cover account creation/edit/reload/logout/login, bookmarks, the complete
scenario, playable previews, native-dialog Escape/focus, ranking categories,
mobile layout and focused text contrast. A separate development-only Vite probe
confirmed stable reading state and normal Fast Refresh on component updates.
See UI-AUDIT.md for exact observations and limits. Playwright CI flows are
prepared but no local Playwright/physical-device certification is claimed.

A retained current-run JSON export and SHA-256 receipt were created before the
runtime switch. The original run ID/step is preserved, and the normal identity
store is separate from QA. Runtime data, credentials, backups and receipts remain
outside Git. Disk checks show approximately 130 GB free on X:, a 350 MB project
cache, a 40.6 MB workspace database and a 40.0 MB identity database. Diagnostic
outputs remain small and under the explicit retention boundary. Docker/WSL and
external PostgreSQL were not started; no cloud deployment or remote publication
was performed.
