# Backend and database performance

## Decision and evidence

Keep Node.js 24 / Fastify and PostgreSQL-compatible SQL. The measured defect was
write amplification and repeated snapshot transfer, not evidence of an inadequate
runtime. Rewriting orchestration in Go or Rust would retain those database costs
while adding another toolchain. Revisit a native worker only after profiling a
specific CPU-bound task; generated-code isolation remains a separate requirement.

Primary sources reviewed for this change:

- [GitHub database partitioning](https://github.blog/engineering/infrastructure/partitioning-githubs-relational-databases-scale/)
  describes separating database domains as its workload grows. Here the proportionate
  change is separate relations inside the existing workspace database, not sharding.
- [GitHub REST API practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
  recommends ETag conditional reads for polling. Commons and experiment snapshots
  now skip the response body and hydration when their persisted revision matches.
- [GitLab pagination guidelines](https://docs.gitlab.com/development/database/pagination_guidelines/)
  explains keyset pagination and matching indexes. The new commons event endpoint
  reads after a sequence cursor with LIMIT, without OFFSET or a full count.
- [PostgreSQL JSON types](https://www.postgresql.org/docs/current/datatype-json.html)
  explains whole-row locking for JSON updates and recommends manageable documents.
  Independent events and jobs no longer share one growing JSON value with source.

## Storage contract

Migration `004_commons_storage.sql` preserves existing JSON values while splitting
their outer collections into `commons_projects`, `commons_jobs` and
`commons_events`. `commons` keeps small metadata and an integer revision. Array
positions preserve project/job ordering and numbering. Event sequence and IDs have
unique constraints; payload IDs must match relational keys. No old SQL is edited.

Every write still locks the parent run row and checks the expected revision.
Only changed project/job records and appended events are serialized into writes.
Metadata advances in the same transaction. Existing event rewrites, record removal
and identity reordering fail and roll back. The public snapshot/export shape stays
compatible, including source-message references, raw model responses and PR hashes.

Reads hold a shared parent lock for a consistent multi-table snapshot. A single
cached run is keyed by the database revision, validated on every read, cloned before
returning, and published after commit. It has no TTL, per-user cache or Redis service.
An unchanged poll reads one small row and returns before cloning or loading events.
Recovery finds only running jobs through a partial index instead of reading every
historical workspace. Lab history and artifact indexes match their actual ordering,
including deterministic tie-breakers. Existing identity cleanup indexes were adequate;
no redundant identity indexes or global PostgreSQL tuning was added.

## API and client behavior

`GET /api/commons?runId=<uuid>` and `GET /api/lab/runs/<uuid>` return an ETag.
Send the exact value as `If-None-Match` to receive a bodyless 304 when unchanged.
The gateway forwards the validator and ETag. The client keeps its current snapshot,
focus, draft and reading position on 304. Validators include domain, run ID and
revision. Uninitialized commons snapshots always return 200 because scenario changes
can alter their source at revision zero. Exports always return complete data.

`GET /api/commons/events?runId=<uuid>&after=0&limit=50` returns:

```json
{"runId":"<uuid>","version":6,"events":[],"nextAfter":0,"hasMore":false}
```

`after` is an exclusive sequence cursor; `limit` is 1-100. Reuse `nextAfter` for
the next request, retaining the run ID. Events are append-only, so new appends do
not shift already read pages. The server reads at most limit + 1 rows. The primary
key `(run_id, sequence)` supports the range and order. The current UI still reads
full changed snapshots; this cursor API is available for incremental consumers.
Chat initially renders the latest 40 messages and can reveal earlier batches
while preserving its reading anchor. This reduces initial DOM size; it does not
reduce snapshot bytes or replace the event API with a partial cache.

## Repeatable local benchmark

Run `npm run diagnostics`, then `npm run benchmark:backend`, then diagnostics again.
The benchmark creates an in-memory database with 5 seeded projects, large source
fixtures and 1000 messages (1,191,871 JSON bytes). It compares the old four-query
monolithic write pattern to normalized writes, 20 samples each. It never opens
normal runtime databases or invokes a model. Output overwrites the single file
`.cache/verification/latest-backend-benchmark.json`; retain a release result under
`runtime/verification` rather than treating the mutable report as immutable evidence.

Observed on this machine with Node 24.11.1 / PGlite:

| Measurement | Legacy | Normalized |
| --- | ---: | ---: |
| Message write median | 38.74 ms | 7.29 ms |
| Message write p95 | 44.50 ms | 7.96 ms |
| SQL parameter bytes, 20 writes | 48,805,583 | 7,212 |
| SQL statements, 20 writes | 80 | 80 |

The parameter reduction is 99.985%; these are application-to-SQL input bytes,
not physical disk writes, WAL volume or network traffic. An unchanged read had a
0.58 ms median, one statement per request and a zero-byte HTTP body. EXPLAIN ANALYZE
used `commons_events_pkey` for a 20-event cursor page. Timings are synthetic local
measurements, not production throughput or external PostgreSQL qualification.

## Migration safety and verification

Before applying to normal data, stop model work and services, take a cold copy of
workspace and identity stores, verify file hashes, and rehearse the migration on
a separate copy. Compare every legacy commons document after reconstruction and
hash unchanged experiment/run tables. Never copy a live embedded database as if
it were a consistent backup, remove its lock to force access, or rewrite an applied
migration. Restoring data should use a separate directory with compatible migrations
and preserve the failed database for diagnosis.

This change verified 2058 backup files, reconstructed the retained commons document
exactly and retained the tables containing 29 experiments. Normal HTTP responses
matched the raw-database baseline after migration; both conditional endpoints
returned 304 and event pagination returned the expected cursor. PowerShell's JSON
conversion normalizes fractional timestamp formatting, so it is not the hash baseline.
Cold backup: `runtime/backups/storage-before-migration-20261019-004210`.
Rehearsal and live receipts are retained under `runtime/verification`.

The mandatory full gate includes migration/reopen, cache isolation, stale and
concurrent writes, append-only rollback, startup recovery, ETag forwarding, missing
run checks, cursor bounds and full lab exports. No new real inference is required.

## Remaining limits

Project JSON still contains source, forks and PRs. A changed project rewrites that
project's record; an active job update rewrites its own response record. Full changed
snapshots and initial hydration are proportional to retained history. Existing caps
(100 commons jobs, roughly 1900 events, 200 lab runs) remain. Do not advertise an
unbounded store or increase these caps without measuring read/clone cost and splitting
large immutable source artifacts. The benchmark is not a concurrency stress test.

External PostgreSQL locking/load, multi-process scheduling, public authorization,
deployment isolation, restore drills under production conditions and HA remain
unqualified. The existing pool limit of four connections is retained. Broader tuning
needs the actual deployment workload and hardware; a schema cannot be ideal for all
traffic patterns.
