# Dot development handoff

Updated: 2026-10-19. Product: Commit Zero.

## Source locations

- **Working source:** `X:\ai-github` on this computer, branch
  `codex/development-foundation`. Continue implementation here so the local
  databases, model installation and verification evidence remain available.
- **Published source:** [antropos17/commit-zero](https://github.com/antropos17/commit-zero),
  branch `main`. This is a second source for code and documentation. Check its
  current commit before assuming it matches the local checkout. It does not
  contain the local databases, credentials, model weights or verification receipts.
- The checkouts have separate Git histories. Do not merge, reset or clean either
  checkout simply to make their commit IDs match. Compare file content and the
  current task before applying any changes across them.

## Read first

1. [Project overview and startup](../README.md)
2. [Repository rules](../AGENTS.md) and [current context](CONTEXT.md)
3. [Development and verification workflow](DEVELOPMENT.md)
4. [Architecture](ARCHITECTURE.md), [API](API.md), and [design](../DESIGN.md)
   when changing their respective areas
5. [Agent workspace](COMMONS.md), [Language lab](LANGUAGE-LAB.md), and
   [release scope](RELEASE.md) for product behavior and boundaries

For direct entry points and tests, run `npm run map -- <area>` with `commons`,
`ui`, `lab`, `identity`, `scenario`, `services` or `tooling`. The public GitHub
repository has the corresponding documents under `docs/`.

## Resume safely

From `X:\ai-github`, run:

```powershell
git status --short --branch
npm run doctor
npm run map -- commons
```

Select the map area for the actual change. Use `npm run check:fast` and its
focused suite during implementation, then `npm run check` with source frozen.
For a UI change, also verify desktop and narrow browser widths; DOM and axe
tests alone do not measure layout. Run `npm run diagnostics` before and after
heavy work. Keep disposable output under `.cache/tmp`.

At this handoff, the gateway at `127.0.0.1:4173` was not healthy and the source
was newer than `dist`; `npm run doctor` otherwise passed Node, dependencies,
disk and Git checks. The installed local model files were found, but inference
readiness was not probed. Inspect processes and ports before starting a single
project supervisor. `npm run dev` serves live source; `npm run build` followed
by `npm start` serves compiled output. The local model uses
`npm run model:start` in a separate terminal when actual inference is needed.

## Development direction and preserved state

Commit Zero is a local agent workspace with projects, issues, chat, tasks,
reviewed pull requests, versions, forks and live history. Commons and Language
lab use actual local model calls when the provider is running. The original
repository scenario and leaderboard are deterministic simulations. A parsed
proposal and a model review do not prove runtime correctness; the operator
decides whether to merge. Keep permanently visible navigation and the existing
restrained design.

Preserve `runtime/database`, `runtime/identity`, `runtime/backups`, `.env`,
`runtime/verification` and the installed model. In particular, Commons run
`49092854-f9bd-4b7a-8d12-4ac5ea0e5f70` has an approved, unmerged Safe Timer
proposal from job `811bdb98-bcbb-4b65-80b9-f19693aef6b4`. The archived
Signal Kit attempts were unsuccessful and must not be presented as a merge.
Source changes and scenario writes follow the contracts in `AGENTS.md` and
`docs/ARCHITECTURE.md`; applied SQL migrations are immutable.

The next feature was not selected at this handoff. Continue with one bounded,
observable improvement from the owner's next request. If none is supplied,
inspect the current product and checks, identify one concrete defect or usability
gap, and make a small verifiable change. Preserve the user's work and state the
exact evidence and remaining limits. Do not infer a request to publish, merge a
product PR, run extra AI agents or change credentials.

## Prompt to give Dot

> Continue development of Commit Zero from `X:\ai-github` on this computer.
> Also use https://github.com/antropos17/commit-zero as a published source.
> Read `AGENTS.md`, `README.md`, `docs/CONTEXT.md` and `docs/DOT-HANDOFF.md`.
> Recheck Git status and run `npm run doctor`, then use `npm run map -- <area>`.
> Preserve local databases, evidence and existing work. Implement one bounded
> improvement, run the required focused and full checks, and report what actual
> model/browser behavior was and was not verified. Keep the source histories
> distinct and ask for a priority only if no concrete task or defect is available.
