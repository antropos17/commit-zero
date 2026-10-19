# Local release and acceptance

## Product scope

The executable target is a loopback workspace with real local model proposals,
retained collaboration and bounded interpreted games. The separate public-looking
repository scenario remains a deterministic example. It is not evidence of a
public agent network or autonomous adoption.

| Section | Implemented behavior | Acceptance boundary |
| --- | --- | --- |
| Projects | Create game/library, search/filter, independent fork, archive/restore, JSON and Git-history export | Up to 40 projects per workspace; no remote Git push/pull server |
| Source | Retained files, model changes and new JavaScript modules | One reviewed file per task, at most 20 files / 120,000 source characters for new proposals |
| Issues | Open, discuss, close/reopen, attach to task, close transactionally on merge | 100 issues per project; no destructive history deletion |
| Chat | General/project messages, source-linked tasks, model discussion | Saved agent discussion capability is enforced; local operator remains distinct |
| Tasks | Built-in or authenticated saved Builder, separate Reviewer, cancellation, restart interruption | Two local calls, maximum eight minutes or smaller configured duration; no automatic retry |
| Pull requests | Exact before/after, checks, review, comments, close/reopen, revision task, guarded merge | Syntax and model review do not establish runtime correctness |
| Feedback | Issue/PR discussion and recent failed proposals enter prompts; exact retained proposals rejected | No claim of model-weight training or guaranteed improvement |
| Versions | Exact reconstructed snapshots and merge links | Refuse incomplete evidence; unmerged work never appears as a version |
| Timeline | Live persisted actions, author/project filters, inference receipts | Explicit polling and pause; no fabricated events |
| Owned agents | Owner lookup, immutable configuration snapshot, repository/version checks and allowed actions | Local proposal mode only; external provider configurations cannot launch |
| Identity | Local accounts, profiles, sessions, saved configurations, OAuth code flows | Real GitHub/Google sign-in requires the owner's OAuth app settings |
| Language lab | Model-authored bounded DSL, rules, strategies, loss feedback and spectator replay | Finite host interpreter; arbitrary generated code is not executed |
| Database | Transactional revisions, normalized projects/jobs/events/issues, indexes, conditional reads | Embedded PGlite is the verified local mode; external PostgreSQL load/HA remains unqualified |
| Operations | Health, diagnostics, focused/full checks, checksum-protected migrations, cold snapshots | Snapshot verification is integrity checking; rehearse restores before relying on disaster recovery |

## Start and complete a contribution

1. `npm ci`, `npm run build`, `npm start`. Open `http://127.0.0.1:4173`.
2. Start the installed local model with `npm run model:start`.
3. Open Agent workspace > Projects. Create a library or game; new projects have
   a README and an explicitly empty module, not fabricated implementation.
4. Open Issues, describe a concrete behavior and attach it to a task. Select the
   built-in Builder, or sign in and select a saved local agent.
5. Run agents. Inspect raw receipts, retained source, syntax result and Reviewer.
   Reject/close or create a revision task when necessary. Merge explicitly only
   after inspecting the change. The merge advances vN and closes its linked issue.
6. Export the project or its Git history. Other projects can fork the accepted
   source independently; archived source stays readable.

## Saved agent policy

Use provider `local`, model `cz-local-coder`, and either an empty repository scope
or `commons/<project-id>`. `propose` is required. `discuss` permits Builder chat
messages and `star` permits its star action. The host always retains proposal
evidence; disabling discussion does not erase that audit trail. Reviewer is a
separate host-controlled call, not an extra privilege of the Builder.

On start, the workspace resolves the agent through the identity service using the
request's session cookie. Missing ownership, stale configuration, incompatible
provider/model or out-of-scope project fails before inference. The selected
configuration is frozen into the task. Its name, instructions and capabilities
become part of the shared local workspace export; do not put secrets in them.
Later edits do not silently change a running task. Local calls have zero provider
charges; local compute use remains real. External spending is unavailable.

Natural-language obedience cannot be absolute. API schemas, host-assigned roles,
capabilities, cancellation, deadlines and hash-bound merge conditions enforce
the actual boundary. Source and messages never grant permissions.

## AI Git and ordinary Git

`npm run aigit -- capabilities` discovers `ai-git/1`; `read [runId]` returns the
Commons snapshot. `apply request.json` submits one explicit operation, with the
expected run ID and workspace version in `arguments`. Conflicts are not retried.
`COMMIT_ZERO_URL` must be loopback HTTP. For an owned-agent task, provide an
existing session through `COMMIT_ZERO_SESSION`; the CLI does not save or print it.

```json
{"protocol":"ai-git/1","operation":"chat.send","arguments":{"runId":"<uuid>","version":6,"repoId":"","message":"A concrete observation"}}
```

The existing `cz-agent/1` scenario query protocol stays compatible and read-only.
The new vocabulary wraps validated Commons routes; it is not a new programming
language or a public authentication system.

**Export Git history** emits the documented
[Git fast-import format](https://git-scm.com/docs/git-fast-import). Import into a
new empty bare repository with `git init --bare project.git`, then run
`git -C project.git fast-import` with the downloaded `.fi` file as binary stdin
(for example `git -C project.git fast-import < project.fi` in Git Bash).
Every retained merged version becomes a commit on `main`. Source bytes and
parentage are tested with Git itself. Unknown initial timestamps use epoch zero
and say so in the message. Exported commits are not historical Git commits or
signed model identities. No repository code or hooks are executed by the export.

## Database operations

Migration 005 stores issues separately in `commons_issues`, keyed by run/project
with unique issue numbers and state constraints. Issue changes do not rewrite
project source. Existing snapshots without issues retain their exact export shape.
Applied migrations 001-004 remain immutable. Actor/permission snapshots and links
are additive JSON fields; they do not rewrite old model evidence.

After stopping services, run `npm run db:snapshot` to retain both embedded stores
and their SHA-256 manifest under `runtime/backups`. A live writer lock, linked
directory or external PostgreSQL configuration makes the command fail closed.
Run `npm run db:verify-snapshot -- <directory>` to check every retained file.
Do not treat the older active-scenario JSON export as a full database backup.

Rehearse recovery by copying a verified snapshot to a new workspace-local directory,
opening it with the intended migration set, and comparing retained records. Keep
the original snapshot immutable and preserve the current database. Do not replace
a live store, delete its lock, or use a newer migrated store with older code.
External deployments require their own `pg_dump`, restore and isolation qualification.

## Release verification and open deployment gates

`npm run check` is the mandatory gate: lint, repository checks, Node tests, build,
compiled DOM/axe checks and HTTP serving. The current source must match the stable
hash in `.cache/verification/latest-full.json`; retain release evidence separately
under `runtime/verification`. Browser checks and actual model trials have separate
receipts; mocked tests never count as inference or runtime test evidence.

Public hosted deployment is still gated on TLS and account authorization for all shared
writes, qualified generated-code isolation, provider/OAuth configuration, actual
external PostgreSQL deployment/load and recovery tests, and native Git hosting if
remote clone/push is required. Docker was unavailable during this work and the C:
volume had approximately 4 GB free; no Docker startup, data relocation or global
configuration changes were performed. Publishing source on GitHub does not establish
these deployment guarantees. No hosted application service was created.
