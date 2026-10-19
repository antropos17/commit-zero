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

After adding the eighth browser journey, one shared disposable cluster returned
HTTP 429 on the final bookmark action in two full runs (7/8 passed). The same
test passed alone. Splitting the suite into two serial fresh-cluster groups
passed 8/8 while keeping the 180/minute application limit. That first grouped
run took about 50 seconds versus 20–27 seconds for the two failed shared-cluster
runs, with different outcomes and source. This is a reliability correction,
not a speedup measurement; further timing claims need comparable repeated runs.

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

## Chat rendering window

Before changing chat rendering, `npm run benchmark:ui -- --history 1000 --samples 5`
ran at 06:16 UTC. The same command ran after the change at 06:19 UTC. Each batch
used one warmup and five fresh browser contexts on this Windows host, Node
24.11.1, Chrome 155.0.8059.80 and a 1440x900 viewport. The real disposable service
cluster supplied the shell; a read-only routed Commons snapshot contained 1,000
explicitly simulated messages. No retained store or model was used. Both batches
received the same 926,125-byte snapshot.

| Measure | Render all messages | Initial latest-40 window |
| --- | ---: | ---: |
| Initial rendered messages | 1,000 | 40 |
| DOM elements | 8,224 | 547 |
| Ready time p50, five samples | 228.25 ms | 212.72 ms |
| Ready time p95, five samples | 232.81 ms | 225.42 ms |

The reproducible result is smaller initial DOM work. These small timing batches
do not establish a general startup speedup; bootstrap and local scheduling still
dominate. Response bytes are unchanged. Raw local receipts are
`runtime/verification/commons-ui-{before,after}-2026-10-19.json`; they include
individual samples, source hashes and the exact Commons module SHA-256. The
mutable command output is `.cache/verification/latest-ui-benchmark.json`.

The [React layout-effect reference](https://react.dev/reference/react/useLayoutEffect)
was checked on 2026-10-19. It supports restoring the prepend anchor before paint
and warns against broad layout effects. The implementation uses one height delta
only after an explicit earlier-message action; ordinary polling retains the
existing effect. The expected benefit is stable reading position, verified by
the held-out browser fixture rather than inferred from the documentation.

A separate 147-message Chrome fixture tests behavior rather than tuning timings:
new messages follow at the bottom, earlier batches retain the reading anchor,
appends do not remove the first visible message, and all 149 messages become
inspectable after two test appends. The oldest message can still source a task.
It also checks narrow layout and axe. The production API and export remain full
snapshots; cursor-driven network reads need a separate consistency design.

After the batches, diagnostics reported 79 GB free and `.cache` 918,822,556 bytes.
Retained database (81,371,331 bytes), identity (40,165,571), backups (606,429,778)
and model (4,807,159,778) sizes were unchanged from the earlier mission checks.
