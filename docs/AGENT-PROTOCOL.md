# Agent protocol v1

`cz-agent/1` is a machine-readable HTTP/JSON query contract for the saved workspace.
It makes allowed operations, schemas, revision conflicts and provenance explicit.
It is not a new Git implementation, binary transport, real Git repository API or
agent runner. This version is read-only and all returned project activity is
simulation-derived.

## Discover and query

- `GET /api/agent/v1`: capabilities, boundaries and query/schema endpoints.
- `GET /api/agent/v1/schema`: the exact validated request JSON Schema.
- `GET /api/state`: current `runId` and `version`.
- `POST /api/agent/v1/query`: a strict request envelope. Supply the current
  version as `revision` and a fresh UUID `requestId`.

```json
{
  "protocol": "cz-agent/1",
  "requestId": "b7ee9874-4d78-4e3e-bff9-7e726dc4313b",
  "runId": "replace-with-current-run-uuid",
  "revision": 0,
  "operation": "timeline.read",
  "arguments": { "actor": "claude", "limit": 20 }
}
```

| Operation | Arguments | Result |
| --- | --- | --- |
| `timeline.read` | Optional `actor`, `repo`, `before`, `limit` (1–100) | Filtered timeline with pagination |
| `repository.read` | Required `repository` ID, e.g. `vector-kit` | Repository metadata and source snapshot |
| `change.read` | Required positive integer `number` | Saved pull request |

Responses echo the protocol, request ID, run ID, revision, `provenance: simulation`
and `result`. A stale run/revision returns 409; reread the state before retrying.
A missing repository/change returns 404. Unknown operations/fields or invalid
arguments return 400. The existing local operator header is required for POST:
`X-Commit-Zero: local-demo`. It is an origin safeguard, not agent authentication.

## CLI

```sh
npm run agent -- capabilities
npm run agent -- timeline claude
npm run agent -- repository vector-kit
npm run agent -- change 7
```

Use an actual change number from the current run. The CLI defaults to
`http://127.0.0.1:4173`; `COMMIT_ZERO_URL` can select another local HTTP origin.
It fetches the current revision before queries, rejects non-local endpoints and
redirects, prints structured results, and reports conflicts instead of silently
retrying. It executes no repository commands or source text.

## Commons mutation vocabulary

`GET /api/commons/protocol` describes the separate `ai-git/1` local operator
vocabulary. `npm run aigit -- capabilities`, `read`, and `apply request.json`
operate on real retained Commons data with explicit revision checks. The older
scenario query contract above is unchanged. See [release operations](RELEASE.md)
for usage, authentication boundaries and ordinary Git history export.

## Execution boundary

Saved agent configurations contain instructions, scope and requested limits.
Configurations are saved without launching. Commons can run owned local proposal
tasks; arbitrary-code launch remains refused. See [release operations](RELEASE.md). Instructions alone
cannot guarantee that a model follows policy. A future executor must validate
every proposed operation against server-owned permissions, isolate code, enforce
network/resource/budget limits, pin expected revisions, and retain attributable
results. Repository text and agent messages are untrusted input to that executor.

Prefer a documented operation schema over a bespoke binary or reverse-engineered
Git format at this stage: it is inspectable, testable, and compatible with ordinary
agent tool calls. When real Git is connected, retain normal commits/branches/PRs
and add structured intent and verification records around them. Binary encoding
should follow a measured transport need rather than replace the readable contract.
