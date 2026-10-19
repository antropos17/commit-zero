# Development workflow

## Start a bounded change

1. Read [current context](CONTEXT.md), then `git status --short`. Preserve existing work.
2. Run `npm run doctor`. It reads environment, dependency versions, disk, Git,
   compiled-build age and aggregate HTTP health. It does not start/stop services,
   open a database, read secrets, call a model or delete files. Offline runtime and
   missing builds are warnings; `--strict` turns warnings into failure.
3. Use `npm run map -- commons` (or `ui`, `lab`, `identity`, `scenario`, `services`,
   `tooling`) to find entry points, existing helpers, owning stores and tests.
4. Express the task as an observable behavior and acceptance example. Reproduce
   a bug before editing. Reuse the indexed implementation before creating another.
5. Implement one coherent change. Use focused checks during iteration; finish
   implementation with `npm run check` and relevant browser verification.

## Feedback commands

| Command | Scope |
| --- | --- |
| `npm run check:fast` | Cached lint, map/document checks, pure scenario/grammar/tooling tests; no databases or build |
| `npm run check:commons` | Collaboration API, revision history, cancellation and merge contracts |
| `npm run check:lab` | Interpreter, grammar exclusion, strategy/rule execution and learning gates with mocked inference |
| `npm run check:identity` | Accounts, agent configurations, OAuth and related service integration |
| `npm run check:scenario` | Deterministic transitions, API, persistence and timeline/protocol |
| `npm run check:services` | Accounts, ranking, gateway failures and actual isolated service processes |
| `npm run check:ui` | Lint, repository checks, build, compiled DOM/axe integration and static serving |
| `npm run check:tooling` | Verification planner, diagnostics input validation and lint guardrails |
| `npm run check` | Full local gate, including every `tests/*.test.mjs`; unchanged required acceptance scope plus repository checks |

Append `-- --plan` to any suite to inspect its exact commands without running them.
Focused suites are explicitly labeled feedback, not full acceptance. Select an area
deliberately: changed-file inference is unreliable in this dirty checkout and can
miss integration dependencies. The full gate remains serial to bound PGlite memory.

The runner stops at the first failing stage, prints its command and elapsed time,
and overwrites `.cache/verification/latest-<suite>.json`. It writes `running` before
execution; interruption cannot leave a previous green report looking current.
Reports include before/after hashes of indexed source, assets, docs and configs;
edits during a run make it fail. Do not edit or run another suite concurrently with
the final gate. These local summaries are disposable and not signed release receipts.
There is one summary per known suite, one lint cache and project-local temporary
output under `.cache/tmp`. Child processes receive TEMP/TMP/TMPDIR explicitly.

## Find and diagnose problems

- `npm run doctor -- --json`: structured health; use `--url http://127.0.0.1:PORT`
  for a configured gateway. Only loopback origins are accepted, redirects refused,
  HTTP reads have a three-second timeout. A running model is optional for checks.
- `npm run check:repo`: broken local Markdown file links, missing map entries and
  an oversized current handoff. It does not validate URL availability or headings.
- `npm run lint`: browser and Node globals are separated. UI cannot statically
  import server internals/Node builtins; shared/domain code avoids transport/UI
  imports. JSX disclosure elements fail against the explicit open-content design.
  These are coding checks, not a security sandbox or complete dependency analysis.
- `npm run diagnostics`: storage measurements and existing limited diagnostic
  retention. Run before/after heavy batches; inspect growth before repeating work.
- `npm run db:status`: raw dependency health. Terminal output from the supervisor
  identifies the failing service. Never reset a store or kill another project's port
  to make a check green.
- A UI change needs a real browser at desktop and narrow widths. DOM tests have no
  layout engine and their axe check disables color contrast. The separate browser
  suite runs in CI; `npm run test:ui` requires matching installed Chromium.
  On Windows, a local Chrome installation can be used without downloading a
  Playwright browser by setting `CZ_BROWSER_EXECUTABLE` to its absolute executable
  path. `CZ_CAPTURE_BROWSER=1` saves catalog desktop/narrow captures under
  `runtime/verification`. The browser suite starts disposable in-memory services
  in Playwright global setup and awaits their shutdown on completion.

Use `npm run dev` for React Fast Refresh while developing. `npm start` serves
compiled `dist` and requires a rebuild after UI changes. They share port 4173:
switch modes only after gracefully stopping this project's supervisor. Use
`npm run preview:qa` for writable browser experiments against disposable in-memory
services and automatic ports; its localhost origin separates normal preview cookies.

## Keep orientation current

[project-map.mjs](../scripts/project-map.mjs) owns the module index and focused test
lists. Update it when moving modules or adding a subsystem. Keep `CONTEXT.md` under
120 lines: current direction, latest verification, preserved data and real limits.
Move dated narrative to linked history, never delete evidence to shorten a handoff.
Canonical contracts belong in ARCHITECTURE/API/domain docs, not repeated logs.

Bug reports should include a reproducible action, expected/actual behavior, route,
run/revision when relevant, and failing check. Supply sanitized output; never attach
credentials or databases. PRs should identify the behavior, validation and remaining
limits. Repository templates provide these fields without adding approval steps.

## Research used for this workflow

For backend/database changes, [backend performance](BACKEND-PERFORMANCE.md) owns
the storage contract, migration safety and `npm run benchmark:backend` procedure.
The benchmark uses a disposable database and one bounded output report.
[Current workflow and history-size measurements](WORKFLOW-MEASUREMENTS.md)
record observed command costs and the limits of those comparisons.

- [Anthropic: effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
  motivates incremental tasks, persistent handoffs and browser verification. Here,
  the existing workspace and required checks provide that structure; no additional
  model, agent framework or autonomous commit policy is introduced.
- [GitHub: best practices for coding tasks](https://docs.github.com/en/copilot/tutorials/cloud-agent/get-the-best-results)
  supports explicit acceptance examples, relevant file pointers and reproducible
  build/test instructions. The project implements these in its map and commands.
- [Birgitta Boeckeler: an autonomous coding-agent case study](https://martinfowler.com/articles/exploring-gen-ai/autonomous-agents-codex-example.html)
  illustrates agents missing reusable code and variation in solution quality. The
  map emphasizes existing entry points; tests remain behavioral acceptance evidence.

These are engineering practices adapted to this repository, not evidence that
AI-written code is universally correct or that development has a guaranteed speedup.
