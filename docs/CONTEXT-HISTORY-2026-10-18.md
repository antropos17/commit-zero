# Continuation context

Updated: 2026-10-18. Workspace: `X:\ai-github`.

## Resume here

Read this file, check Git status and local service health, then follow the user's next request. Startup commands and architecture are maintained in README.md and ARCHITECTURE.md; API contracts are in API.md.

## Open sections and permanent navigation (2026-10-18, latest)

The user rejected More menus and disclosure arrows: content needs clear, visible
places. This supersedes the collapsed presentation described in the previous entry.
The sidebar now exposes all thirteen destinations in Workspace, Explore and Manage
groups. Mobile uses the same visible links in two columns instead of a section
selector; project channels are visible too. Project section tabs wrap on mobile.
PRs, Before/After source, reviews, forks, timeline text and complete model receipts
are open sections. New task stays below the active section; execution limits remain
visible beneath it. Discover's example, scenario steps, laboratory rule/results
sections, policy changes, saved specialists and ranking methodology no longer use
native details. This changes presentation only; no model job, merge or data migration
was requested or performed. DESIGN.md records the open-content rule.

Verification: final `npm run check` passed lint, 39 Node tests, both compiled DOM/
axe tests, production build and serving smoke. Browser inspection at 1440, 390
and 320 px confirmed visible navigation, inline PR changes/receipts/forks, and no
horizontal page overflow. Discover and a saved laboratory report were also checked
on mobile. Both themes were inspected. Sign in now stays visible in the mobile
header. No real device or Safari verification was performed. Final assets:
`social-DwFQNAxg.js` and `social-BBINFvZG.css`. Screenshots are
`runtime/diagnostics/qa-open-workspace-desktop.png`, `qa-open-workspace-mobile-nav.png`
and `qa-open-workspace-mobile-pr.png`. Diagnostics stayed around 23.4 MB, cache
351.6 MB, with 103 GB free on X:; the existing retention policy remains active.

## Repository versions and simpler workspace (2026-10-18, superseded presentation)

User direction: a familiar GitHub-like workspace for AI models, with versions and
timelines and less explanatory copy. The real project workspace now opens on Code
and has Pull requests, Chat, Versions and Timeline tabs. General retains shared
chat, PRs and activity. Project headers/channel links show vN; New task reveals its
form. Full execution limits and event receipts remain under native details, with
Local model / Syntax checks visible. Sidebar secondary tools moved under More;
the duplicate scenario repository list is hidden in the real workspace. Its
sidebar PR link opens real workspace PRs. Discover uses a plain title and collapses
the simulated example. Existing repositories link directly to Versions/Timeline.

`shared/commons-history.mjs` reconstructs exact snapshots from persisted merged
PR before/after source and unique merge receipts. It verifies contiguous revisions
and matching head content; incomplete evidence returns an error, not invented
history. vN means project revision, not semantic release. Chat/review/fork activity
does not advance it. Versions retain PR, author and merge timestamp links. Source
views are read-only; no migration, database rewrite, new model call or merge was
needed. Safe-timer's earlier real PR remains approved/unmerged, so it shows v0.

The UI is in `commons.jsx` and `commons-panels.jsx`. Deep links accept
`#/commons/<project>?view=versions&version=0` or `?view=activity`. Unknown tabs fall
back to a supported section. General/project messages retain their previous scope,
error recovery and drafts. Tests cover real API merge-to-version reconstruction,
multiple-file history, incomplete receipts, snapshot independence and version/PR
numbering, plus compiled DOM navigation, file switching and accessible disclosures.

Final verification passed: `npm run check` (39 Node tests, two compiled DOM/axe
tests, build and serving), final lint and Impeccable detector. Actual browser
checks covered desktop Code/Versions, timeline-to-PR navigation, direct-version
reload, mobile project switching, both themes and 390/320px without page overflow.
Visible mobile controls measured 44px. Screenshots:
`runtime/diagnostics/qa-versions-desktop.png` and `qa-versions-mobile.png`.
The normal backend stayed running; only the compiled frontend changed. Runtime
data, existing approved PR and scenario history were preserved. Build assets:
`social-BAY8Og3Z.js` and `social-Bkz1es50.css`. Diagnostics remained about 23 MB
with 103 GB free. No external publication or model run was performed in this step.

## Agent commons (2026-10-18)

The main direction is agent collaboration. `#/commons` provides General and
per-project rooms; repository Agent chat tabs open the same conversations.
Discover's main action now opens the commons. The existing local model powers
separately prompted Builder and Reviewer roles. Valid responses create retained
database forks, optional model-selected stars/exact copies, changed source, syntax
receipts and hash-bound reviewed PRs. Operators explicitly merge approved patches
into collaboration copies. The historical scenario remains untouched. See
`COMMONS.md` for the workflow and execution boundary.

Implementation: migration `003_commons.sql`, `server/commons/`, and
`prototype/app/pages/commons.jsx`. Public writes require run ID and commons
revision; mutations/events are transactional. Cancelled jobs reject late output.
A shared lease serializes lab/commons inference including readiness checks.
Interrupted jobs never retry automatically. Bounded histories and raw responses
are retained. Polling supports pause/resume and draft-preserving conflict recovery.

Real job `811bdb98-bcbb-4b65-80b9-f19693aef6b4`, source run
`49092854-f9bd-4b7a-8d12-4ac5ea0e5f70`, completed at commons revision 6. Two actual
local calls (8109 ms Builder, 3666 ms Reviewer) produced 11 events. Builder proposed
clamping negative `limit` to zero in safe-timer's `safeDelta`; Reviewer approved.
PR `1b09e64b-7ad5-4bab-9785-c6b0090b18b8` remains approved and unmerged. This job
created one fork and no star/copy (the model chose not to request them). Star,
copy and merge paths are covered by explicit fixtures. Syntax passed; runtime
execution or measured improvement is not claimed.

Receipt: `runtime/verification/commons-811bdb98-bcbb-4b65-80b9-f19693aef6b4.json`,
SHA-256 `b1e585eccca82160ebcca6e326d6e467fd89d9046c3fb0e3bc46c61c607c1241`.
The scenario exactly matched its pre-migration export after this job. Full closed
database backup: `runtime/backups/commons-before-migration-20261018-225510`, with
per-file hashes. The server was gracefully stopped after checking its exact
console process set, backed up and restarted on normal port 4173.

Important boundary: browser messages are Local operator, separate from observer
accounts. Both roles use the same Qwen model. Account-agent launching stays
disabled. Generated JS is parsed through stdin, never executed. Database-backed
forks are not native Git hosting or an OS sandbox. No paid API calls or external
messages were used. Do not claim autonomous multi-tenant operation or runtime
correctness from parser/model approval.

Browser checks covered real responses, global/project navigation, PR/source
disclosures, both themes, 1440px desktop and 390/320px mobile, 44px controls and no
page overflow. Screenshots: `runtime/diagnostics/qa-commons-*.png`. Storage after
implementation: 103 GB free, diagnostics 23 MB, backups 364 MB. Preserve all dirty
and untracked work; no commit/publication was requested.

Final `npm run check` passed: 38 Node tests, both compiled DOM/axe tests, production
build and serving checks. Commons tests cover actual persisted fork/copy/review/
merge mutations with fixture provenance, untouched scenario, actor spoofing,
unknown scope, concurrent revision conflicts, cancelled late writes, shared model
lease, rejected output retention, and parse-without-execution. DOM coverage also
checks scoped rooms, escaped message text, retained draft/focus on stale writes,
retry and accessibility. Impeccable detector returned no findings. These checks
do not constitute arbitrary-code isolation or production deployment acceptance.

## Repository type filters (2026-10-18)

The repository catalog now combines All / Games / Libraries toggle buttons with
text search. Both the labels and filters use the existing `projectKind` metadata
classification; forked games remain games. Category counts reflect the current
search across types; a live result count reports the displayed subset of the run.
Empty results include Clear filters, which resets both search and type. Unknown
project types remain visible under All. Controls use visible labels, aria-pressed,
and a 44px minimum height. Catalog filters now live in the hash query:
`#/repos?type=library&q=timer` (`type=game` is the other supported type).
Search/type edits replace the current browser-history entry, preserving input
focus, caret and scroll rather than creating an entry per keystroke. Direct links,
reload and Back from a repository restore the filtered view. Unknown types fall
back to All; Clear filters removes both parameters. No server data writes occur.

URL persistence verification: the extended DOM integration verifies exact filtered
results, stable input/focus/scroll, unchanged history length while typing, Back
restoration, unknown-type fallback, encoded search and reset. Final `npm run check`
passed all 34 Node and two DOM/axe tests plus build/serving. Browser verification
confirmed reload, Back, independent header search and focused mobile input at
390px without page overflow. Screenshot: `runtime/diagnostics/qa-catalog-url-mobile.png`.


Verified: `npm run check` passed (34 Node tests, two DOM/axe tests, build/serving).
Actual browser checks confirmed All=7, Games=5 (including the fork), Libraries=2,
combined type/search results, zero results and Clear filters restoring all seven.
At 320px all three buttons remain on one row with 44px height and no page overflow.
Desktop verification used 1280px; viewport was restored. Screenshots are
`runtime/diagnostics/qa-repository-filters-{desktop,mobile}.png`.


## Individual project identities (2026-10-18)

`prototype/app/components/project-mark.jsx` now defines seven original monochrome
project marks and metadata-derived `Game` / `Library` labels. Orbit Lab retains a
related but distinct orbit silhouette and an explicit fork label. Unknown IDs use
initials, with a generic `Project` type unless existing metadata supplies a type.
No stored repository or experiment data was changed.

The shared identity appears in repository catalogs, sidebar, Discover, repository
headings and existing RepoLink consumers. Catalog rows use a separate logo column
with 40px desktop / 32px mobile marks, preserving text wrapping and search. Other
placements use 18–32px marks. DESIGN.md documents the shapes and size rules.

Verification: `npm run check` passed (34 Node tests, two DOM/axe tests, production
build and serving); Impeccable detect returned no findings. Actual IAB checks
covered all seven logos in light/dark desktop catalogs, 390px and 320px mobile
layouts, repository filtering and navigation to the matching project heading.
No page overflow was observed. Viewport overrides were reset; the original dark
theme was restored. Screenshots: `runtime/diagnostics/qa-project-logos-*.png`.
Diagnostics remained bounded at about 23 MB with 107 GB free on X:.


## Category wayfinding marks (2026-10-18)

Original monochrome SVG marks now identify the main navigation, Discover views,
ranking categories, repository/profile/PR tabs and known repository topics.
`prototype/app/components/category-mark.jsx` owns the shared 20-unit geometry;
`prototype/app/app.css` sets 18px UI / 14px metadata sizes. Text labels remain
visible, SVGs are hidden from assistive technology, unknown topics stay text-only,
and native mobile section selection is unchanged. Action/file Octicons and agent
provider identities retain their existing roles. DESIGN.md records this system.

Verified: `npm run check` passed (34 Node tests, two DOM/axe tests, production
build and serving). Actual IAB checks covered 1280px desktop and 390px mobile,
light/dark themes, Discover tabs and ranking filters. No page overflow; mobile
ranking categories share one row with 44px targets. Native viewport was restored.
Impeccable detection returned no findings. Screenshots are retained under
`runtime/diagnostics/qa-category-marks-*.png` with normal diagnostic retention.

## Specialist portfolios and learned routing (2026-10-18)

Current arena protocol is `model-revision-v5`. Exact model-written drafts are
reassessed for per-game strengths, retained independently from global promotion,
and used by a host-implemented empirical selector. See ARCHITECTURE.md and
LANGUAGE-LAB.md for seed separation, context inputs, bounds and provenance.
The selector sees numeric rules, phase and past opponent action frequencies;
unseen numeric rules explicitly fall back to the incumbent flat program.
This is executed program evaluation and learned outcome tables, not weight
training or an additional model. Model revision generation still bans every
known expression before decoding. Previous run hashes remain unchanged.

Verified real local-model run: `6f3a2e68-8931-4525-9ad6-a63fd50e8db5`, completed
from `b0d0000c-36ea-4e75-9cc7-060b5886fbcb`, one improvement round, five games,
18 calls, 18 distinct ASTs, 17 behaviorally novel drafts and one behavioral
duplicate. No flat revision or combined selector passed global promotion.
The installed population and tournament scores remained unchanged.

Strategist 1 retained three earlier model-written programs, all from the parent
run, after fresh paired admission checks (48 matches per program/game, win=2,
draw=1). Earlier holdout outcomes were never used for admission or training:

| Specialist source | Exact expression | Qualified games and control points |
| --- | --- | --- |
| Parent p0 attempt 3 | `score(pay0,lastSelf)` | Resource Harvest 57 -> 75 |
| Parent p0 attempt 4 | `score(score(pay0,pay2),score(lastSelf,lastOpp))` | Resource Forge 49 -> 50; Resource Echo 42 -> 48 |
| Parent p0 attempt 5 | `score(pay0,counter)` | Resource Nexus 53 -> 56 |

The combined selector scored 325 vs incumbent 326 on global development control,
so it was not installed. Strategists 2 and 3 retained zero qualifying specialists.
An explicit selector trial executed real choices: specialist 1 at round 1,
baseline at round 5, specialist 1 again at round 9. Seven selection events include
the other player's initial baseline choice. The trial is outside tournament
scores. Unknown rules use baseline; fresh transfer found no gain for strategist
1's rejected selector: new games 26 -> 26 (48 matches/version), new opponents
197 -> 197 (120), both new 82 -> 82 (48). Other final rejected flat drafts
regressed. Do not report overall strength improvement.

Verification completed:

- `npm run check`: lint, 34 Node tests, build, two DOM/axe tests, production serving.
- `npm run lab:verify -- 6f3a2e68-8931-4525-9ad6-a63fd50e8db5`: 349 artifacts,
  240 tournament matches + one selector trial, 4,320 final gate comparison
  matches, 1,080 selector-training matches, 2,592 transfer comparisons; expert
  source identity, admission, learned tables and all round choices replayed.
- Receipt: `runtime/verification/lab-6f3a2e68-8931-4525-9ad6-a63fd50e8db5.json`.
  Run hash: `3c0f617796a8807ea13d11bb6b4c2db313164c3306c3533964989a5b789fd93e`.
- Parent v4 replay passed with its previous hash. Impeccable detect returned no
  findings in the changed arena components. Actual IAB checks at 1280x900 and
  390x844 confirmed specialist changes, readable controls and no page overflow.
  Screenshots: `runtime/diagnostics/qa-specialist-results.png` and
  `runtime/diagnostics/qa-specialist-mobile.png`. These are browser viewport
  checks, not physical-device/Safari qualification.
- Diagnostics after execution: 108 GB free on X:, 22.3 MB diagnostic output,
  80.4 MB application database. Existing retention remains enforced.

Next meaningful experiment would improve the context learner's generalization
or sample support; do not relax gates or train on these revealed transfer results
while continuing to call them unseen. Specialist pools and exact source references
are now available to subsequent continuations even after failed promotion.

## Generation-time program exclusion (2026-10-18)

Historical protocol `model-revision-v4` introduced generation-time exclusion.
`arena-decoder.mjs` subtracts
known expression trees from a positive JSON Schema grammar before each local
model call. It uses a prefix trie, not host synthesis or a candidate ranking.
The exclusion set includes active/archived code, inherited history, parent
revision responses, remembered failures and every new parsed draft across all
strategists. Renaming and temperature changes cannot restore excluded code.
The short explanatory failure memory remains bounded separately; expression
exclusions are never evicted. A history budget ends further generation rather
than dropping exclusions. Full constraints and request schemas are persisted.

New revision literals are canonical integers -100..100, enabling exact finite
grammar subtraction. Observations/payoffs remain real; generated operators and
the two-call-layer limit remain unchanged. Behaviorally equivalent but differently
written programs can still be generated and must pass the existing behavior and
performance gates. Training uses all retained games; unseen games/opponents stay
outside prompts and generation constraints. This is program revision, not weight
training. Two real local-model probes with explicit requests to repeat excluded
code produced valid different programs (`runtime/diagnostics/qa-decoder-proof.json`).

Verified run: `b0d0000c-36ea-4e75-9cc7-060b5886fbcb`, completed from
`d265f688-05e3-4057-982b-1ae29f733c47`, one improvement round, same local model
and five retained games. Eighteen constrained calls produced 18 distinct ASTs,
zero forbidden-code emissions, 15 behaviorally novel drafts and three behavioral
duplicates rejected after generation. The exclusion history grew from 14 to 32.
No candidate passed promotion; the installed population remained unchanged.
Best development control per role: 323 vs incumbent 326, 155 vs 311, 135 vs 275.

Agent 2's final rejected code was
`score(remainder(phase, 21), remainder(counter, 3))`. Development control fell
311 -> 56, while unseen transfer was mixed: new games 47 -> 60 (48 matches per
version), new opponents on existing games 155 -> 122 (120), both new 36 -> 62
(48). This is a finite task-specific gain, not an overall strength improvement.
Unseen results never affected generation or selection. Other final rejected
drafts also failed development gates; their separate transfer results are saved.

- Final `npm run check` passed: lint, 32 Node tests, build, two DOM/axe tests and
  production serving. Bundle: `social-CcGudEHD.js`. Positive grammar subtraction
  is tested with an independent Draft-07 validator from the pinned ESLint toolchain.
- Full replay passed 343 artifact hashes, all 18 actual request schemas and
  exclusion lists, source-history validation, 240 tournament matches, all 15
  attempt evaluations (10,800 matches), 2,160 final-decision evaluations (a
  subset of those attempts), and 2,592 transfer matches. Receipt:
  `runtime/verification/lab-b0d0000c-36ea-4e75-9cc7-060b5886fbcb.json`.
  Run hash: `84f02bba90f16548de35359aabaacd9b3b86116df2c8ccc709ea8fc61b84da7d`.
  Verification resolves inherited source IDs before artifact names, avoiding
  name collisions across generations of runs. Parent v3 replay remained valid.
- Browser verified generation-constraint events, v4 transfer report and rejected
  draft disclosure at 390/1280 px without horizontal page overflow. Screenshots:
  `runtime/diagnostics/qa-decoder-results.png` and `qa-decoder-mobile.png`.
  No physical-device or Safari check. The verified report was left open.
- App and the existing model remain running; no paid API/model change, migration,
  commit or publication. Diagnostics ended near 22 MB, 109 GB free; the existing
  7-day/50-MB retention boundary remains in effect. Databases/history preserved.

## Failure memory and distinct revision attempts (2026-10-18, historical v3)

The previous arena protocol was `model-revision-v3`. Each strategist receives a bounded
ledger of six distinct failed programs, development scores and two paired training
regressions, with source artifact references. The ledger survives continuation;
v2 parents supply rejected final drafts. Unseen results never enter this memory.
Six revision attempts use different investigative questions, with no code supplied
by the host. Exact expressions and behavior within 1% of the incumbent or remembered
valid failures are rejected before match evaluation. Prompts, memory snapshots,
novelty decisions, lessons and executable checks are saved in the live timeline.
The existing performance and 12% population-diversity gates remain unchanged.
This is model-authored program revision with measured feedback, not weight training
or a guarantee that the model will improve.

Verified continuation: `d265f688-05e3-4057-982b-1ae29f733c47`, completed locally
from `06fbebea-8691-4b3e-8d8d-e93d11547870`, one improvement round, same Qwen
model and five inherited games. Eighteen real calls produced seven drafts that
passed the per-agent novelty gate (2/2/3) and eleven blocked repeats. Two of the
seven copied another active agent and failed population diversity. There were
zero promotions. Exact repeats can still be emitted by the model; the verifier
rejects them rather than treating them as fresh experiments. This run does not
establish that the model understands feedback or has become stronger.

Agent 3's last draft, `score(pay0, phase)`, improved development control from
275 to 293 but had only 5.63% minimum population distance (12% required). Its
unseen results regressed: new games 75 -> 18 (48 matches/version), new opponents
190 -> 168 (120), both new 73 -> 45 (48). All installed policies stayed unchanged.
Unseen tests therefore correctly show identical before/after installed results,
with the rejected draft reported separately.

- `npm run check` passed: lint, 31 Node tests, build, two DOM/axe tests and
  production serving. Current bundle: `social-BS1n8dgU.js`.
- Replay verification passed all 317 artifact hashes, 240 tournament matches,
  all seven attempt evaluations (5,040 matches), 2,160 final-decision evaluation
  matches (a subset of those attempts), and 2,592 transfer matches. It also
  checks novelty decisions, failure-memory sources and unchanged parent history.
  Receipt: `runtime/verification/lab-d265f688-05e3-4057-982b-1ae29f733c47.json`.
  Hash: `d24e3ee9030c53d2678ad24a7cc7665040cb73d12dac0717568da853e079fcb6`.
- Parent v2 replay still passed with its original hash. Browser verified live
  rounds and memory/novelty/hypothesis events, the final v3 transfer report and
  rejected-draft disclosure; 1280/390 px views had no horizontal page overflow.
  Screenshots: `runtime/diagnostics/qa-retry-results.png`,
  `qa-retry-agent3.png`, `qa-retry-mobile.png`. No physical-device/Safari check.
- App was gracefully restarted; app and local model remain running. Diagnostics
  ended at about 22 MB with 111 GB free; existing 7-day/50-MB retention applies.
  No provider/model change, paid API, database migration, commit or publication.

## Model-authored revisions and unseen evaluation (2026-10-18, historical v2)

The previous implementation introduced `model-revision-v2`. Host policy synthesis and candidate
selection have been removed from initial creation and revision; the historical
heap mode and old artifacts retain their original behavior/provenance.
`arena-learning.mjs` derives loss cases from executed training matches with
pre-action observations and explicitly labeled hindsight regret. Each local
model revision contains diagnosis, evidence, hypothesis and executable code.
Three attempts receive measured development feedback. Changed AST, performance
and diversity gates remain mandatory; failures retain the incumbent.

After final policies are frozen, two new numerical games, three behaviorally
novel host-authored test opponents and fresh run-specific seeds are generated.
Three paired scopes isolate new games, new opponents and both together. The
last rejected model proposal is also tested separately if different from the
installed policy. No inference or promotion follows unseen evaluation. Records
include all prompts, outputs, executable checks, code diffs and transfer results.
This is finite evaluation within the same bounded game family, not weight training.

The UI exposes loss-review cases, model hypotheses and before/after transfer
tables in the existing timeline/inspector and evolution report. No new migration,
paid provider, account-agent permission or normal scenario write was added.

- Final implementation check passed: lint, 30 Node tests, build, two DOM/axe
  tests and production serving. Bundle: `social-DZNsQCN-.js`.
- Previous run `0a06b230-d5f2-4128-91d7-a3174f7835f8` still replays successfully;
  hash unchanged: `62669c256d97f2a95f92149e445932ae4c23c7a0371cc52c4cccf14ca4ca178d`.
- First local-model validation: `742d48e0-7546-47d2-8644-af5ee126fb24` completed,
  one improvement round, continuing that parent. Nine actual calls, 240 tournament
  matches, 1,440 final-decision evaluation matches and 2,160 transfer matches,
  zero promotions. All 269 artifacts and paired results replayed successfully.
  Agent 1 produced ill-typed numeric expressions; agents 2/3 authored executable
  but weaker programs. Records are retained. The grammar now infers numeric
  argument requirements from function bodies and excludes boolean-producing
  expressions in numeric slots.
- Final typed-grammar run `06fbebea-8691-4b3e-8d8d-e93d11547870` completed with
  nine actual local model calls and three executable, directly model-authored
  proposals. Zero promotions: all failed development performance gates and
  repeated their expressions across repair attempts. No synthesis events.
  Replay passed 240 tournament matches, 2,160 final-decision evaluation matches,
  2,592 unseen-evaluation matches and 273 artifact hashes. Receipt:
  `runtime/verification/lab-06fbebea-8691-4b3e-8d8d-e93d11547870.json`.
  Run hash: `99ec3b4757bdb1ae6a453ca0fb9818753353c3606bda09d75859bb55acd24dbe`.
  Agent 2 proposed `score(expected, phase)`: development control 311 -> 162;
  unseen games 58 -> 57, unseen opponents 181 -> 176, both new 50 -> 61.
  This is mixed transfer evidence, not an overall improvement. Installed
  policies were preserved. The small model still uses repair feedback poorly.
- Browser verification: actual loss inspector and completed transfer report at
  1280 and 390 px, no page overflow; rejected-draft disclosure works separately
  from installed policy results. Screenshot: `runtime/diagnostics/qa-model-authored-transfer.png`.
  Final server and existing local model were left running. No physical-device
  or Safari validation, commit or remote publication was performed.
- Existing server was gracefully restarted with current code. Model service
  was left running. Diagnostics: 113 GB free, about 13 MB diagnostic output,
  existing 7-day/50-MB disposable-output retention. Databases/backups preserved.

## Strategy learning continuation (2026-10-18)

### Latest: evolving resource arena

#### Visual spectator added

The lab now leads with `ArenaTheater`: two seat identities, simultaneous action
tokens, energy cells, signed scores, a directed counter-rule diagram and phase
changes. Completed matches have play/pause, speed, round buttons and a scrubber.
The evolution tables are collapsed below it. Historical runs remain replayable.
Live mode consumes persisted `match-start` and `round` events; it is distinct
from recorded playback. Freeze view is local; resume jumps to current evidence.

`arenaRounds` is the shared deterministic generator. `arena-broadcast.mjs`
commits each featured round before executing the next, pacing at 650ms and
aborting on cancellation. One pairing per game/generation is featured; pairings
rotate. Other tournament/search matches drain the same generator at full speed.
One-second browser polling may skip visual frames; persisted rounds are complete.
No native code, external provider, new migration or scenario data was introduced.

- Real broadcast verification: `c7a1bf53-be3e-49e8-8bb5-9fbc19dcb1f9`, continuing
  the prior arena run. Eight featured matches, 192 streamed rounds, 192 total
  tournament matches and 2,304 paired decision-evaluation matches. All broadcast
  rounds matched their final artifacts and regenerated traces. 224 artifacts,
  444 events; parent unchanged. Receipt:
  `runtime/verification/lab-c7a1bf53-be3e-49e8-8bb5-9fbc19dcb1f9.json`.
  Run hash `8302ef9a39e1547f2b248761a9872a4f8611d0d04ce889c2b4113f2047debca7`.
- Nine model calls, 8,164 prompt / 1,012 completion tokens; 187.719 seconds.
  No policies or new rule proposals passed promotion in this continuation.
  The four retained games and their phase changes supplied the verified visual
  demonstration; do not describe this run as another learning improvement.
- `npm run check` passed: lint, 29 Node tests, build, two DOM/axe integration
  tests and production-serving smoke. Tests cover step-before-next-commit,
  cancellation, replay parity, player energy, phase change, playback, freeze,
  resume and cancelled-stream presentation. Bundle `social-D2uSIUJe.js`.
- Actual in-app browser checks: live rounds advancing, frozen frame stable while
  server continued, resume jumping forward, phase changes, replay at 2x and
  stopping at round 24, manual stepping, 1280/390/320 widths without page overflow.
  The mobile identity circles were corrected to 40x40. Dark theme was inspected;
  physical devices and Safari were not tested. Impeccable detector returned `[]`.
- Proof images: `runtime/diagnostics/qa-visual-arena-live.png`,
  `qa-visual-arena-desktop.png`, and `qa-visual-arena-mobile.png`.
  Latest disk check: 115 GB free on X; diagnostics about 3.8 MB before final
  screenshots. Existing 7-day/50-MB diagnostic retention remains in force.

New UI experiments default to `arena`: three strategist roles and a rule-author
role use the same real local Qwen model. `arena-engine.mjs`, `arena-runner.mjs`
and `arena-search.mjs` add simultaneous affordable actions, energy, alternating
cyclic payoff rules, retained game sets, archived opponents and a 12% behavioral
distance gate. Model-generated rules are compact directed edges, expanded by
the host into exact payoff tables. This is a bounded game family, not arbitrary
new game engines or model-weight training. See `LANGUAGE-LAB.md` for limits.

- Verified run: `5695d027-d9ea-47b4-b087-bf49f1fb58b1`, inheriting only HeapLang
  from `7d6badfd-996b-4b26-8a5b-4a3d83140431`. Parent snapshot hash is unchanged.
  Four model-authored rule sets: Resource Clash, Resource Harvest, Resource Forge,
  Resource Nexus. Three generations: 48 + 72 + 96 = 216 tournament matches.
- Six promotions: one unaided local-model proposal and five host-synthesized,
  model-selected programs. Initial strategies also used disclosed search help.
  Never claim all strategy code was independently authored by the model.
- Replay verification passed: 292 artifact hashes, 334 ordered events, 216
  tournament matches and 2,376 paired evaluation matches for final decisions,
  accepted-model-output correspondence, policy continuity and parent hash.
  Receipt: `runtime/verification/lab-5695d027-d9ea-47b4-b087-bf49f1fb58b1.json`.
  Run hash: `43f1849f23f57bffd65ac3e5e915bf770b868d3a704e37c08e90c2b87652620a`.
- Minimum behavioral distances: 22.70%, 12.71%, 12.49% on common probes.
  This finite regression suite does not guarantee permanent diversity or global
  strategic quality. All phases, probabilities and resource changes are replayable.
- 22 actual model calls, 14,837 prompt / 2,334 completion tokens; 87.392 seconds.
  Failed development runs remain visible. Early direct payoff-matrix generation
  failed antisymmetry; compact counter-edge generation fixed that representation.
  One unbounded recursive strategy generation preceded a local provider exit
  (3221225725); arena output grammar now has two finite call layers. The successful
  run used that bounded grammar. The provider was restarted without reinstalling
  weights, changing credentials or using paid services.
- Arena continuations copy final rules/policies/archive. Heap-to-arena copies
  only the language; arena-to-heap is rejected. Existing transaction, expected
  revision, single-active-run, cancellation and immutable history contracts remain.
  No SQL migration or normal scenario-data changes were made for this feature.
- Final `npm run check` passed: ESLint, 28 Node tests, production build,
  DOM/axe integration and production-serving smoke. Bundle `social-Q8n4SA2M.js`.
  Real in-app browser checks passed at 1280, 390 and 320 px: generation tables,
  expanded rule matrices, replay controls, saved diff inspection, role filtering
  and legacy heap-run rendering. A 320 px artifact-selector overflow was fixed
  and rechecked (page scroll width 305 px at a 320 px viewport).
  Screenshots: `runtime/diagnostics/qa-arena-desktop.png` and
  `runtime/diagnostics/qa-arena-mobile.png`. These are browser emulation checks,
  not physical-device or Safari acceptance. Latest diagnostics: 116 GB free on X,
  diagnostic directory about 3.6 MB before final screenshots; 7-day/50-MB
  diagnostic retention remains active, excluding databases and receipts.

The following subsection describes the earlier heap-only learning work.

The lab now runs bounded automatic loss-analysis/revision/evaluation cycles.
New runs default to two improvement rounds; the UI offers one to three. Continue
creates an immutable child run, inheriting final strategies and two feedback
entries per role. API requests require the completed parent's expected version
and matching provenance. There is no new SQL migration or change to normal
scenario/account data. Details and limits are in `LANGUAGE-LAB.md`.

- `server/lab/learning.mjs` computes exact bounded-game mistake feedback, freezes
  both opponents per generation, validates candidates and promotes only measured
  improvements. `strategy-search.mjs` optionally supplies explicitly attributed
  host-synthesized programs selected by the local model. No model-weight training.
- The first unaided learning runs produced unchanged or weaker policies. Those
  attempts remain in history. Do not claim the 7B model independently derived the
  final strong programs. Assistance and model interpretations are labeled.
- Final verified run: `7d6badfd-996b-4b26-8a5b-4a3d83140431`, from the original
  HeapLang parent `fdab1575-2bbf-49da-9db4-1f209cd9809e`. Three generations,
  192 tournament matches, 1,536 paired evaluation matches, seven model calls,
  7,033 prompt / 1,743 completion tokens, 58.524 seconds. Control mistakes:
  `[98,98] -> [0,0] -> [0,0]`. Two promotions; later regressions rejected.
  Final scores 32:32; identical final policies, so no final policy diversity claim.
- `npm run lab:verify -- 7d6badfd-996b-4b26-8a5b-4a3d83140431` passed, checking
  229 artifact hashes, 250 ordered events, every generation, all saved evaluation
  matches and promotion decisions, loss feedback and parent hash. Receipt:
  `runtime/verification/lab-7d6badfd-996b-4b26-8a5b-4a3d83140431.json`.
  Run hash: `c2946a3ab6763b8ce320e42234ca402d4a183ad711f39114a0c8799881cf5de9`.
- A preceding successful development run `75910655-66b1-4056-a963-f42dface868b`
  also replayed: 192 tournament / 1,792 evaluation matches, mistakes
  `[98,98] -> [98,0] -> [0,0]`. Its legacy lineage hash encoded driver timestamps
  as empty objects; the verifier explicitly supports that historical encoding.
  New lineage uses `json-iso-dates-v1`, preserving ISO timestamps in the hash.
- A single atomic `/api/lab/runs/:id/export` read serves all artifacts for replay;
  this avoids exhausting unchanged local rate limits. Replay compares canonical
  JSON, correctly treating persisted -0 as 0. Large inspector sources show an
  explicit 10,000-character preview and a complete-artifact download link.
- Final `npm run check` passed: lint, 24 Node tests, build, one DOM/axe suite,
  and production-serving smoke. Final bundle: `social-DQ3Rxvja.js`. The
  Impeccable detector reported no findings for the changed laboratory surface.
- Browser verification: desktop 1280px, mobile 390px and 320px, light/dark.
  No page overflow; mobile selectors and action buttons are at least 44px high.
  Checked role/event filters (192 match events), inline policy diffs, artifact
  provenance/preview/download link, and replay through the final move. Proof:
  `runtime/diagnostics/qa-learning-result.png` and `qa-learning-mobile.png`.
  These are desktop browser viewport checks, not physical-device testing.
- The regular scenario still has run `49092854-f9bd-4b7a-8d12-4ac5ea0e5f70`,
  step/version 10. Diagnostic output remains below 4 MB; databases, backups and
  model assets are retained. Local runtime files are ignored by Git.
- Model and app remain local processes; no continuous unattended service is
  installed. Budgets: three attempts per stage, 51 calls, 20 minutes, 200 retained
  runs. Control positions are reused, not an independent generalization benchmark.

## Local language experiment implementation (2026-10-18)

The user requested real local agents creating a language, games and competing
strategies without API credits. See `LANGUAGE-LAB.md` for setup and exact limits.

- `#/lab` uses five separately prompted roles on one Qwen2.5-Coder 7B model through
  pinned llama.cpp b11719 Vulkan. About 4.8 GB of ignored project-local runtime
  assets are installed. No commercial provider calls, subagents or external AI
  CLIs were used. This local model is the explicitly requested product experiment.
- The DSL consists of generated composed functions over a fixed host calculus;
  games use a finite heap-removal engine. Real inference and execution do not
  imply an unrestricted compiler, graphics engine or arbitrary-game generator.
- Workspace migration `002_experiments.sql` adds separate run/event/artifact
  tables. Accepted and rejected responses, prompts, schemas, seeds, timing,
  token counts, canonical SHA-256 values and match replays are inspectable.
- The provider uses a locally generated credential in ignored runtime storage.
  Browser clients do not receive it. Actual unauthenticated inference returned
  HTTP 401. Setup validates official download hashes; startup rechecks weights.
- Full closed-store backup before migration:
  `runtime/backups/before-lab-20261018-182937`, with per-file SHA-256 receipt.
  Scenario export: `runtime/backups/2026-10-18T14-29-05-309Z.json`.
  The normal scenario compared unchanged after migration: run
  `49092854-f9bd-4b7a-8d12-4ac5ea0e5f70`, step/version 10.
- Initial failed runs remain visible, including encoding/unsupported-operation
  failures and a provider schema parser error. The provider adapter uses the
  verified llama.cpp `response_format: {type: "json_object", schema}` contract.
  No failed history or model-generated code was rewritten to manufacture success.

Older sections describe the original simulation and pre-laboratory boundary.
The account-owned agent launcher is still unavailable; Language lab is a separate
local-operator experiment. OAuth still requires the user's own applications.

### Verified local experiment

Completed run: `fdab1575-2bbf-49da-9db4-1f209cd9809e`, opened at
`http://127.0.0.1:4173/#/lab/fdab1575-2bbf-49da-9db4-1f209cd9809e`.
The local model generated HeapLang, Last Remover Wins, LastRemoverLoses and two
strategy programs. Seven inference calls used 4,283 prompt and 721 completion
tokens; the successful run took 18,033 ms. Two game repairs used the explicitly
recorded host synthesis tool. All 64 matches executed; scores were 32:32. The
record contains 90 events and 79 hash-verified artifacts.

Quality limit: both game predicates evaluate to true, leaving the host's 1–8
removal range unchanged. Both strategy programs differ syntactically but choose
one stone on every recorded turn. This demonstrates real generation, validation,
assisted repair and execution, not novel gameplay or strong/different tactics.
The UI displays that limitation. Twelve earlier failures across development
revisions remain in history; these are not a controlled model reliability study.

`npm run lab:verify -- fdab1575-2bbf-49da-9db4-1f209cd9809e` reexecuted every match,
checked artifact hashes/event ordering and produced the same run hash before and
after an application restart:
`d1ee0dff10e3028b5ce3a71ae89d4c4bf4f443e69a86c852afa597bf82269160`.
Retained receipt: `runtime/verification/lab-fdab1575-2bbf-49da-9db4-1f209cd9809e.json`.

The final mandatory `npm run check` passed lint, 20 Node tests, build, DOM/axe and
production-serving smoke. Actual in-app browser checks covered live updates,
role filtering, source inspection, next/previous moves, keyboard replay to the
last turn, dark/light themes, and 1280/390/320 widths without document overflow.
Mobile replay buttons measured 44 px high. No physical-device or other-browser
qualification is claimed. Screenshots: `runtime/diagnostics/qa-lab-desktop.png`,
`qa-lab-mobile-light.png`, and `qa-lab-result.png`.

At handoff the compiled site and separate model process are running locally.
Recheck availability before continuing; these are terminal processes, not durable
installed services. Latest diagnostics: about 119 GB free on X:, 4.81 GB model
runtime, 3.2 MB diagnostics, 350 MB cache, 243 MB preserved backups. No publication,
new account credentials, global configuration changes or Docker/WSL startup.

## Latest timeline and identity implementation (2026-10-18)

The user requested a visual live timeline, less duplication, GitHub/Google sign-in,
a stronger backend and an agent-oriented protocol. They explicitly confirmed that
OAuth applications do not exist yet: prepare local startup and configuration.
No credentials were requested in chat, no paid model calls were made, and no
subagents or external AI CLIs were used.

- `#/timeline` and `#/agent/:id/timeline` show persisted event authors, actions,
  projects, evidence links, step and recorded time. Shared compact feeds replace
  duplicated overview/profile activity. Discover links to the timeline.
- Filters cover actor, project and action. Live reads poll every three seconds
  while visible/unpaused. New events queue while reading below the feed start;
  an explicit button applies them. Historical pagination pins its run. Event IDs
  use persisted run/sequence, and newer snapshots refresh workspace counts.
- GitHub/Google OAuth authorization-code flows, PKCE, state/browser binding,
  one-use callbacks, provider identity persistence and session creation are
  implemented. Migration `003_oauth.sql` preserves local accounts. Gateway
  redirects, separate cookies and callback referrer policy are forwarded.
- No provider is configured. Buttons truthfully report that. `docs/OAUTH.md`
  documents exact callbacks and `node --env-file=.env server/index.mjs` startup.
  Real provider sign-in remains unverified; tests use a mocked HTTPS transport.
- `cz-agent/1` exposes capability/schema discovery and strict revision-checked
  read operations for timelines, repositories and changes. `npm run agent -- ...`
  is its local CLI. See `docs/AGENT-PROTOCOL.md`. This is not a Git binary, runner,
  write protocol or proof that models obey instructions.
- Existing agent configuration launch remains blocked. Scenario authorship is
  explicitly simulated. Model execution, untrusted-code isolation, Git hosting,
  authenticated agent mutations and public deployment remain outside acceptance.

Verification: the mandatory full check passed 15 Node tests, lint, production
build, DOM/axe integration and serving smoke. Browser verification used isolated
memory-only services on `localhost`: cross-tab events, synchronized counters,
pause/resume, combined filters, agent scope, disabled OAuth configuration, and
four routes at 320/390/768/1280px without document overflow. Screenshots cover
both themes. No physical phone or additional engine qualification is claimed.
Evidence uses `runtime/diagnostics/qa-timeline-*` and `qa-oauth-mobile.png`.

Before migration 003, both offline embedded stores were copied to
`runtime/backups/before-oauth-20261018-180542` with per-file hashes. The supervisor
Ctrl+C sessions exited 1 and left stale lock directories; all related processes
were verified absent before copying and normal startup recovered the locks.
Do not describe that as a verified graceful shutdown. The saved scenario matches
`runtime/backups/2026-10-18T14-05-14-353Z.json` after excluding the newly exposed
event sequence field: run `49092854-f9bd-4b7a-8d12-4ac5ea0e5f70`, step/revision 10.
Earlier step-0 handoff values below are historical. The normal compiled server
uses port 4173; always recheck it before reuse. Work remains uncommitted on
`codex/development-foundation`, including the preceding concept/spacing edits.

Latest storage observation: approximately 126 GB free on X:, 350 MB cache,
162 MB retained backups, and less than 5 MB disposable diagnostics. The documented
seven-day/50 MB diagnostic retention remains enforced only when its command runs.

## Latest concept implementation (2026-10-18)

Follow-up spacing audit and repair: all six findings in `docs/SPACING-AUDIT.md`
are fixed in the existing uncommitted working tree. Main no longer vertically
centers short pages; PageHeading owns spacing and action placement; Environment
has a 24px section break; sampled mobile controls meet 44px geometry; repository
filter colors use theme tokens; sidebar separation is 32px. `npm run check`
passed again (12 Node tests, build, DOM/axe integration, serving smoke, lint).
Live browser verification covered 15 routes at six widths from 320 to 1440px,
90 geometry samples without document overflow, plus selected screenshots in
both themes. Evidence is `runtime/diagnostics/qa-spacing-fixed-*`. No physical
device or additional browser engine qualification is claimed.

The user asked for an ambitious agent community concept after researching similar
sites. The implemented slice is described in `docs/CONCEPT.md`. These changes are
currently uncommitted on `codex/development-foundation`; the implementation commit
listed below is the earlier baseline, not this slice's revision.

- Default entry is Discover (`#/discover`): a contribution chain beside source,
  project/contribution/knowledge views, search, and project-scoped agent setup.
  `#/home` retains the original source-first overview and scenario controls.
- Your agents (`#/my-agents`) supports real authenticated create/list/edit of
  private configurations. Identity migration `002_agent_configurations.sql` adds
  owner-scoped persistence and revision-checked edits. Names, missions,
  instructions, provider/model labels, scope, requested actions, and limits save
  through the API. No applied SQL was edited.
- Every configuration remains `configuration_only`. The launch API refuses with
  HTTP 409. Provider execution, sandbox enforcement, spending, public agent
  participation, and a real agent-to-agent loop are still unimplemented.
- The fixed policy returned by the API states the required future execution
  contract; budget/capability preferences are not active runner enforcement.
- `npm run check` passed lint, 12 Node tests, build, the compiled React DOM/axe
  integration flow, and production serving smoke checks. New tests cover owner
  isolation, invalid capabilities/limits, stale revisions, launch refusal,
  scenario preservation, and embedded DB close/reopen persistence.
- Actual browser verification covered desktop and 390px Discover in both themes,
  signup-to-agent setup, saving and reloading an agent configuration, and launch
  refusal. QA used disposable memory-only services and a separate hostname.
  No independent subagent review was performed; the user did not authorize one.
- The normal server was stopped through Ctrl+C after verifying its console held
  only this project's process tree. Both complete closed PGlite stores were copied
  into `runtime/backups/concept-before-agent-migration-20261018-171537`, with a
  per-file SHA-256 receipt, before restarting on port 4173 and applying migration
  002. The previous workspace run and revision were preserved. All three domain
  services are healthy after restart.
- Disposable screenshots are under `runtime/diagnostics/qa-concept-*`. The
  diagnostic command reported approximately 126 GB free, 1.7 MB diagnostics,
  350 MB cache, and 81 MB retained backups after the migration.

An optional user question is pending about execution location for the next stage:
server-hosted isolated agents versus agents running on their owners' computers.
Do not treat an unanswered question as approval for provisioning or paid calls.

- Branch: `codex/development-foundation`.
- Latest implementation commit: `0272594` (`feat: migrate workspace to React with accounts and independent services`). This handoff is a later documentation-only change.
- The working tree was clean before this handoff. No remote publication or hosted CI was performed.
- The compiled site was running at `http://127.0.0.1:4173/#/leaderboard`. At handoff, `/api/health` reported all three domain services healthy. Recheck availability; a previous process ID or tool session is not a durable service guarantee.

## Product intent and user preferences

Commit Zero is a GitHub-like workspace where AI agents have profiles, repositories, stars, pull requests, reviews, and reusable project knowledge. The long-term idea is an isolated environment in which agents collaborate and build on each other's projects.

The user wants a very simple, predictable GitHub-like interface, visible source code, the original Commit Zero logo, strong contrast, and black/white themes. They repeatedly rejected decorative UI, generic AI styling, unusual typography, and abrupt movement or navigation resets ("teleports"). The current UI is English; communicate with the user in Russian and write technical documentation in English. Use the project-scoped Impeccable, Design Taste Frontend, and Animate skills when applicable. Preserve the restrained application style; a skill does not authorize a marketing-page redesign or extra animation. Subagents and external AI CLIs require the user's request.

## Delivered implementation

- All active pages and preview controls now use React. Historical static designs remain source-only and are not shipped. The old string-rendering runtime and morphdom were removed.
- English navigation covers overview, repositories/source/issues, pull requests/diffs/checks, agent profiles/memory, search, environment, history, leaderboard, and observer accounts.
- The separate leaderboard has overall/code/collaboration categories, filtering, sorting, tied ranks, and an explicit scoring explanation. Scores derive from saved scenario contributions; they are not Arena ratings or Elo.
- Registration, login, logout, profile editing, and saved repositories use real local persistence. Observer accounts are distinct from simulated agent identities.
- Four independent Node processes run the gateway, workspace, identity, and ranking services. Workspace and identity own separate PostgreSQL-compatible PGlite stores. Optional external PostgreSQL configuration is documented.
- A revision cache and conditional upserts reduce repeated storage work; the ranking service consumes a lean contribution read model.
- Stable React identity, guarded route effects, saved route scroll, and Fast Refresh-compatible module boundaries preserve reading state during updates. No decorative workspace animation was added. Playable canvas previews remain available.

## Verified evidence and limits

At implementation commit `0272594`, `npm run check` passed ESLint, ten Node tests, the production build, one compiled React DOM integration test, and production-serving smoke checks. The Node suite includes actual independent service processes communicating over loopback HTTP. npm audit reported zero vulnerabilities at verification time.

Actual in-app browser checks covered both themes, mobile layout, focused text contrast, signup/profile/session/bookmark flows, the complete ten-step scenario, game dialogs and keyboard return focus, and refresh stability. A development-only probe confirmed normal Fast Refresh and retained reading state on component edits. QA accounts and scenario writes used disposable in-memory services with a separate hostname; the normal saved run was preserved.

Measured on the seeded test case: 13 queries for a cold workspace read versus one for a warm revision-cache read; contribution payload 565 bytes versus 6855 bytes for full state. These are scoped observations, not throughput benchmarks.

Playwright flows are prepared but were not run locally because the matching Chromium executable was unavailable. No physical-device, hosted CI, production deployment, or real-model execution acceptance is claimed. See VERIFICATION.md and UI-AUDIT.md for details.

Current agents still follow a deterministic simulation. Real model APIs, Git hosting, arbitrary-code execution workers, and a qualified isolation environment are not connected. The four local services are a development architecture, not a distributed production deployment. Connecting real agents requires a separately scoped task and actual provider/execution verification.

## Preserve when continuing

- Normal stores: `runtime/database` and `runtime/identity`. Preserve existing `.env`, accounts, saved runs, and applied SQL migrations. Actual `.env` is not automatically loaded.
- Preserved workspace run: `a78810d3-5f5c-40ae-97d6-7bfa56e650ac`, step 0, revision 0 at verification. Revalidate rather than assuming it has not changed since handoff.
- Retained JSON export and SHA-256 receipt: `runtime/backups/2026-10-18T12-26-26-423Z.json`. This is a scenario export, not a full database backup or automatic restore path.
- Compiled gateway uses 4173; development gateway uses 4174. Domain service ports are 4185–4187. Port 4175 was occupied by another project's service; leave unrelated processes alone. Stop this project's server gracefully before switching between compiled and development modes.
- Temporary QA and HMR servers were stopped. Docker/WSL were not started. Runtime data, screenshots, caches, and backups stay outside Git.
- Latest disk observation: about 130 GB free on X:, 350 MB project cache, 40.6 MB workspace DB, 40.0 MB identity DB. `npm run diagnostics` applies the documented seven-day/50 MB boundary only to eligible disposable diagnostics; it is not a background cleanup daemon.
- Final screenshots: `runtime/diagnostics/qa-react-leaderboard-dark.png`, `qa-react-leaderboard-light.png`, and `qa-react-login-mobile.png`. These are disposable evidence and may expire under retention.

After implementation changes, run the required `npm run check` and relevant browser checks. Documentation-only handoff changes require content/diff verification, not another full application test run.
