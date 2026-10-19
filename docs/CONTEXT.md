# Current context

Updated: 2026-10-19. Workspace: X:\ai-github.

## Resume

Read this file, run git status --short and npm run doctor, then follow the user's
current request. Use npm run map -- <area> for entry points and focused tests.
[Development](DEVELOPMENT.md), [architecture](ARCHITECTURE.md), [API](API.md) and
[design](../DESIGN.md) own their contracts. Preserve the dirty checkout and history.

## Direction and preferences

The user selected a complete LOCAL application and authorized AGPL-3.0 source
publication at antropos17/commit-zero. The core is an agent workspace: projects, files, issues,
PRs, forks, stars, versions, general/project chats and live attributable history.
Keep the restrained monochrome interface and fixed visible navigation. No More
menus or accordions. UI is English; chat Russian; documentation English. Subagents
and external AI CLIs require a direct user request. Never merge old work implicitly.

## Local product

- Agent workspace uses real local Builder and separate Reviewer calls. Projects
  can be created, forked independently, filtered, archived and exported. New source
  starts explicitly empty until an agent implements it. Retained history remains.
- Issues have comments and open/closed state. Tasks link to issues, chat messages
  and previous PRs. Merging closes a linked issue transactionally. PRs support
  discussion, close/reopen and revision tasks; duplicate retained code is rejected.
- Saved local agents can author proposals through owner-checked profile lookup.
  Configuration/version/instructions are frozen per task. Project scope, local
  provider/model, propose/discuss/star capabilities and duration are enforced.
  Reviewer is host-controlled; merge remains explicit. Instructions are not secrets.
- Source changes modify or add one bounded JavaScript file; parser checks never
  execute it. Existing permissions do not authorize arbitrary host execution.
- Versions reconstruct exact merged source, including files added by a PR. Git
  fast-import exports those versions to ordinary Git. No remote clone/push server.
- ai-git/1 and npm run aigit provide explicit revision-checked Commons operations.
  The older cz-agent/1 scenario query contract remains read-only and compatible.
- General/project timeline filters expose real author and project activity. Polling
  preserves drafts, reading state and focus; navigation does not hide sections.
- Model inset links open scenario profiles or /model/<id> for actual Commons work.
  Profiles/projects separate creation, merged improvements, forks and unmerged PRs;
  contribution rows link to exact changes and versions. Accepted means merged.
  Scenario creation labels its unavailable initial diff. Project timelines expose
  model roles, operator decisions, timestamps and exact PR links; queued updates
  retain reading position. Fresh links reset scroll; Back restores it.
- Layout uses a main work area and supporting column, with permanently open
  sections. Mobile keeps three navigation groups and local code/feed scrolling.
  DESIGN.md owns the composition; cross-page evidence is in
  runtime/verification/compact-pages-2026-10-19.json. Commons caches one run snapshot.
- Language lab uses actual inference and a bounded host interpreter for evolving
  games/strategies, loss feedback, specialists and live spectator replays. It is not
  arbitrary native/JavaScript execution or model-weight training.
- Original repositories, rankings and scenario participants remain a separate
  deterministic simulation. Never attribute that activity to real model execution.

## Storage and operations

- Migrations 004/005 normalize projects, jobs, events and issues. Every mutation
  checks its expected revision inside a transaction. Only changed records are
  written; issues do not rewrite project source. Events remain append-only.
- Commons/lab ETags skip unchanged hydration and response bodies. Event cursor
  pages use a matching index; the current UI still loads full changed snapshots.
- npm run db:snapshot requires stopped embedded stores, takes exclusive locks and
  copies workspace plus identity with SHA-256 manifests. db:verify-snapshot checks
  every file. Snapshots, credentials, databases and receipts are never pruned.
- Applied SQL is immutable. Add migrations; never edit checksummed SQL or remove
  a store lock to force access. Rehearse migration/restore on separate copies.
- [Release](RELEASE.md) owns the complete matrix, limits and recovery procedure;
  [performance](BACKEND-PERFORMANCE.md) owns the earlier synthetic measurements.

## Runtime and evidence

Recheck these observations before acting:

- Compiled gateway 4173, development gateway 4174, dependencies 4185-4187. Services
  start identity before workspace so owned-agent resolution uses its actual port.
  Avoid simultaneous supervisors. npm start serves dist; build after UI edits.
- Latest doctor: gateway 4173 offline; dependencies, disk and build pass. Inference was not re-probed.
- Stores: runtime/database and runtime/identity. Preserve .env, accounts, runs,
  backups and verification receipts. .env is not automatically read.
- Local llama.cpp 8199: cz-local-coder, Qwen2.5-Coder 7B Q4_K_M. Model readiness
  is distinct from HTTP health. No paid keys are required for local proposal work.
- Existing Commons run 49092854-f9bd-4b7a-8d12-4ac5ea0e5f70 retains the approved,
  unmerged safe-timer change from job 811bdb98-bcbb-4b65-80b9-f19693aef6b4.
  Preserve it. 29 earlier lab experiments were verified before this release work.
- Public source: antropos17/commit-zero at cdb9fae (05:54 UTC), CI green; use clean .cache/publication and preserve histories.
  README GIF is a 15.8s condensed walkthrough of retained Sequence Kit work,
  not a continuous live recording. Static fallback included; desktop/mobile and all
  three CI jobs passed. Evidence: runtime/verification/github-readme-gif-2026-10-19.json.
- Signal Kit: four tasks/seven calls, no merge; archived v0. Preserve failed attempts.
  Temporary GIF copies remain after policy-blocked cleanup; see today's history.
- Arbitrary-code execution remains unavailable. OAuth needs the user's app settings.
- Public TLS, shared-write account authorization, external PostgreSQL load/HA and
  remote Git hosting are outside the explicitly selected local release.

- Agent workspace now bounds chat/code/history, separates retained forks, and places
  creation forms beside content. Selected tasks include the PR and live timeline;
  revisions preserve chat sources. Sequence Kit v1 completed six real model calls,
  two rejected PRs and one merge. See [journey evidence and limits](COMMONS.md#local-journey-verification--2026-10-19).

## Verification

Use fast/focused suites while editing. npm run check remains mandatory: lint,
repository integrity, Node tests, build, compiled DOM/axe and HTTP serving.
Only a passed stable-source report in .cache/verification/latest-full.json applies
to the indexed hash. Freeze source during the final gate; keep immutable receipts
under runtime/verification. Mocked tests never count as actual inference.
Browser checks and full Playwright runs are separate evidence. Run diagnostics
before/after heavy batches; keep temporary output under .cache/tmp on this drive.
Retention applies only to disposable qa-* diagnostic files (7 days / 50 MB).

Mission progress, receipts and current actions: [2026-10-19](MISSION-2026-10-19.md).
## Historical context

[Dot continuation](DOT-HANDOFF.md) has both source locations and restart steps.
[Publication/GIF history](CONTEXT-HISTORY-2026-10-19.md) and [earlier history](CONTEXT-HISTORY-2026-10-18.md)
preserve evidence and prior experiments. [Release operations](RELEASE.md) take precedence.
