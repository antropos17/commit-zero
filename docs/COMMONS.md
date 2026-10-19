# Agent commons

`#/commons` is the local collaboration workspace. `#/commons/<project>` opens
a project room; the same room is available under the repository **Agent chat**
tab. General messages are shared across projects of one saved scenario run.
Switching scenario runs opens a different workspace; earlier records remain
accessible through their original run ID.

## Working loop

1. The local operator posts a general/project message or starts a concrete task.
2. Builder reads bounded source and recent general/project messages. One real
   local inference returns a complete changed file, explanations for both chats,
   and optional star/copy decisions.
3. The host validates the response, retains an independent fork, records optional
   stars and exact copies with source hashes, opens a PR and parses the changed
   JavaScript. It never evaluates the generated module or resolves its imports.
4. Reviewer independently reads the original file, proposed file, task and parser
   result in a second inference. Approval is bound to the exact patch hash.
5. The operator can merge an approved patch into the collaboration copy. Stale
   base revisions, failed syntax checks and negative/missing reviews block merge.
   Optional copied files stay in the fork; only the reviewed modified file is
   included in this PR and its merge.

Both roles use the existing `cz-local-coder` model. This is bounded orchestration,
not two independently trained models, background autonomous activity or model
weight training. No scripted dialogue or fake fallback responses are used.
Raw responses, including rejected/incomplete outputs, remain in the job export.
The next explicitly started task sees recent conversation, not unlimited memory.

The UI polls every 2.5 seconds, supports pause/resume, and never automatically
scrolls or moves focus. Failed/stale submissions retain operator drafts. Changes,
current files, forks, syntax checks and inference receipts accompany discussion.

## Enforced boundary

- Migrations 003-005 retain a locked run revision with normalized projects, jobs,
  events and issues. Every
  mutation, event and version increment commits atomically. Public writes require
  run ID and expected commons version. Runner writes require a matching running
  job; cancelled jobs reject late results. Restarted jobs are not retried.
- The source snapshot freezes on first write and retains its scenario revision.
  This domain does not modify the deterministic scenario, rankings or account
  agent configurations. Historical data remains preserved.
- A shared in-process lease serializes commons and language-lab inference,
  including readiness checks. A task uses at most two calls, each with the local
  adapter's four-minute deadline and 1600-token response limit.
- Actors are assigned by the host. Browser messages are **Local operator**, not
  authenticated-account or agent authorship. Model output must match an exact
  typed schema and can modify or add one bounded JavaScript file. File
  names are database keys, never paths for writing generated code to disk.
- `node --input-type=module --check` reads source through stdin, with a four-second
  deadline and bounded diagnostics. It only parses code. Neither a parse pass nor
  model approval establishes runtime correctness or measurable improvement.
- A workspace allows at most 100 jobs and approximately 1900 ordinary events,
  reserving space for completion/cancellation. History is never silently trimmed.
  Messages are limited to 2000 characters, tasks to 1000 and generated files to
  12000. Oversized, malformed or incomplete outputs fail closed.
- Loopback/origin guards and `X-Commit-Zero: local-demo` are development controls,
  not authentication against local processes. Do not expose these endpoints
  publicly. No container/VM isolation, arbitrary-code worker, native Git hosting,
  external communication is claimed. Saved local agents can author proposals through
  the owner-checked task API described in [the release contract](RELEASE.md).

## Versions and timeline

Project workspaces open with Code and provide Tasks, Pull requests, Chat, Versions and
Timeline tabs. General retains the shared conversation and cross-project activity.
The vN label is the persisted project revision, not an invented SemVer release.
Only a successful merge increments it; comments, reviews, forks and rejected
proposals do not create versions. `shared/commons-history.mjs` reconstructs exact
past file maps from retained merge events and each PR's before/after source.
It verifies contiguous base revisions, unique merge receipts and matching current
content, and reports unavailable history instead of inventing missing snapshots.
Historical views are read-only and cannot alter the current project.

Each version links to its numbered PR. Merge timeline entries link back to the
resulting version. Original text and complete inference receipts are visible inline. PR source,
reviews, forks, the task form and execution limits use permanently open sections.
`#/commons/<project>?view=versions&version=0` directly opens a selected version;
`?view=activity` opens the project timeline. No storage migration is needed: the
history is derived from the existing persisted records without modifying them.

Tasks lists persisted jobs in their original order, with stable run-wide numbers,
the original instruction, provider provenance, recorded response count and linked
PR. Execution status is separate from patch acceptance: completed calls can leave
changes requested or an approved, unmerged PR. Failure, cancellation and restart
reasons come from their retained terminal events. A task timeline joins by job ID,
including its General messages, and excludes unrelated chat or other jobs.
Chat messages link back to their task. Starting a task opens its saved row; polling
updates it without clearing the draft. `?view=tasks` opens the task list.
This is a read projection of existing records, with no migration or model calls.

## Tasks from discussion

**Create task** on a chat message attaches it to the permanent task form without
starting inference or overwriting the instruction draft. **Remove source** detaches
it. **Run agents** remains the explicit start action. Source text, actor, channel
and time appear inline in the task, its timeline and resulting PR; the original
message links to tasks created from it. Existing jobs without a source stay valid.

The optional `sourceMessageId` references an immutable message in the same run,
from General or the target project's chat. The backend validates type and scope
inside the job transaction, rejecting missing, non-message and other-project
references without writes. Clients cannot supply replacement text or authorship.
Both model prompts receive the exact retained message (up to the existing 2000
character message limit), separately from the six recent-message excerpts. It is
untrusted context, never authority to alter model roles or execution capabilities.
The optional field is additive to the existing JSON document; no SQL schema or
applied migration is changed. API tests use an explicitly mocked model.

## Projects, issues and owned agents

[The release contract](RELEASE.md) describes project creation/fork/archive, normalized
issues, comments, PR close/reopen, revision tasks, owned-agent restrictions, Git
export and the AI Git CLI. Issue and previous-PR context is included in both role
prompts. Exact already-retained proposals are rejected; source references never
grant capabilities. Merging closes a linked issue in the same transaction.

## API

| Method | Path | Input / result |
| --- | --- | --- |
| GET | `/api/commons?runId=<uuid>` | Snapshot/export; no initialization write |
| GET | `/api/commons/events?runId=<uuid>&after=0&limit=50` | Sequence cursor; limit 1-100; events, nextAfter, hasMore |
| GET | `/api/commons/provider` | Local model readiness and commons worker state |
| POST | `/api/commons/messages` | `{runId, version, repoId, message}`; empty repoId means General |
| POST | `/api/commons/jobs` | `{runId, version, repoId, task, sourceMessageId?}`; 202 starts bounded work |
| POST | `/api/commons/stop` | `{runId, version, jobId}`; retains completed actions |
| POST | `/api/commons/merge` | `{runId, version, repoId, prId}`; exact approved patch only |

Run `npm run model:start`, then use **Run agents**. No paid API key is
required. An unavailable provider produces a failure, not fabricated work.

Snapshots support exact ETag / If-None-Match conditional polling. A matching
persisted revision returns bodyless 304. Storage uses separate project, job and
event relations after migration 004, preserving the export contract. See
[backend performance](BACKEND-PERFORMANCE.md) for the schema and benchmark.

## Local journey verification — 2026-10-19

The isolated `sequence-kit` project completed chat → sourced task → retained fork
→ JavaScript proposal → separate review → explicit operator merge into v1.
Three tasks made six actual `cz-local-coder` calls (Qwen2.5-Coder 7B). The first
two PRs remain changes-requested; the third was approved and merged. Operator
clarification requested explicit equality handling after the reviewer made false
claims about Set/NaN semantics. This demonstrates a functioning collaboration
loop, not reliable autonomous correctness or an improvement in algorithm quality.
The final proposal still contains an unused variable and an obsolete comment.

Selected tasks expose the PR and decision without leaving the task, with a scoped
timeline alongside. Revision creation preserves the original chat message/issue;
task URLs survive reload. Desktop and mobile browser checks are recorded at
`runtime/verification/agent-journey-browser-2026-10-19.json`.

`runtime/verification/agent-journey-live-2026-10-19.json` retains the actual model
responses, events and checks: rejected-review and stale-version merges returned
409 without writes; fork/PR/merged source and review/check hashes matched; v0/v1
reconstructed; Git export returned the implementation. The existing Safe Timer
project and approved unmerged PR were unchanged. Full source-gate evidence is
separate: `runtime/verification/agent-journey-full-2026-10-19.json`.
No generated JavaScript was executed. Syntax parsing and model review do not
establish runtime correctness; the UI continues to say Runtime untested.
