# Verification and history-size measurements

Recorded 2026-10-19 on Windows, Node 24.11.1, the repository's installed npm
dependencies and local Chrome. Commands ran from `X:\ai-github`; no model call
or normal user database write was part of these measurements.

## Feedback loop

| Command | Observed samples | What it covers |
| --- | --- | --- |
| `npm run check:fast` | One current run: lint 689 ms, repository 95 ms, pure tests 1,334 ms (9/9) | Useful for quick pure-code feedback; excludes databases, build, DOM and serving. Not acceptance. |
| `npm run check:ui` | Current run: lint 863 ms, repository 115 ms, build 501 ms, DOM 32,220 ms (2/2), serving 2,182 ms | The DOM/axe integration dominates this focused suite. It has no real layout engine. |
| `npm run check` | Four milestone receipts: 107.4, 132.6, 122.3 and 137.2 s; the first had 60 Node tests, later runs 64 | Serial PGlite/integration tests and DOM dominate. These runs have different source and test counts, so they do not measure a speedup or regression. |
| `npm run test:ui` with `CZ_BROWSER_EXECUTABLE` | Post-setup runs observed at 14.3, 15.1 and 15.4 s for the then-current 4- or 5-test suite | Real Chrome desktop and narrow layout. Playwright global setup now awaits child-service shutdown; before that change, a successful assertion left the Windows process attached and the command did not exit in the observation window. There is no comparable old completion time, so only reliable termination is established. |

The full gate remains serial to bound embedded database memory. Replacing it
with focused results or parallelizing shared-port suites solely for a shorter
number would lose coverage or isolation. `npm run map -- <area>` and one focused
suite are the intended edit loop; the full gate is run on frozen source.

## Larger retained history

`npm run benchmark:backend` seeded five projects, 1,000 messages and a 1,192,327
byte Commons snapshot in an isolated in-memory PGlite store. Twenty samples
per write path compared the retained legacy monolithic SQL pattern with the
current normalized pattern. The raw receipt is local at
`runtime/verification/backend-benchmark-2026-10-19-mission.json` and
intentionally ignored by Git; its values are reproduced here so the public
document is self-contained.

| Measure | Legacy pattern | Current normalized path |
| --- | ---: | ---: |
| Message write p50 | 42.99 ms | 9.09 ms |
| Message write p95 | 53.31 ms | 13.97 ms |
| SQL parameter bytes, 20 writes | 48,825,423 | 7,212 |

An unchanged read had p50 0.76 ms in 20 samples and a zero-byte response body.
The event page query returned 20 rows through `commons_events_pkey`; this was
a synthetic local EXPLAIN, not an external PostgreSQL load test. These values
verify the prior normalized-storage decision under this fixture. The older
[backend note](BACKEND-PERFORMANCE.md) reports its own run (38.74/7.29 ms p50);
machine load and fixture revision differ, so comparing those timings as a new
optimization would be unsound. Parameter bytes are SQL inputs, not physical
disk or WAL bytes.

The seeded [Commons simulation](SIMULATIONS.md) separately exercised 40 history
messages, 80 events and 27 cursor pages over actual HTTP handlers. Its size is
limited by the normal 180-request/minute API rate limit; the 80-message trial
correctly returned HTTP 429. These fixtures do not establish UI frame time or
production throughput.

`npm run diagnostics` before/after the benchmark showed 84 GB free and no
material growth: `.cache` changed from 917,287,031 to 917,287,061 bytes.
Runtime databases, backups, the local model and verification receipts were
preserved. The next performance target, if measurements warrant it, is the
client's full-snapshot refresh on a changed Commons revision. Event cursor
reads already exist; switching the UI requires a separate correctness design
for cache invalidation, revision changes and reading position.
