# Local language laboratory

## Specialist portfolios (arena v5)

Each strategist can retain up to six original model-written programs that win
more paired matches in particular active games without a training regression.
Both current proposals and parent-run drafts are re-executed; previous unseen
evaluation scores never enter this selection. Sources and measured strengths
remain in saved artifacts even if the combined portfolio is not promoted.

An explicitly host-implemented empirical selector learns which saved program
to use from separate executed matches. It reads the numeric rules, current
phase and already observed opponent action frequencies. It cannot read opponent
code or future moves. Sparse histories back off to game-level results; unseen
rules use the incumbent flat policy. This learns an outcome table, not model
weights. Global promotion still requires a control improvement, no training
regression and at least 12% behavioral distance from other agents.

The live arena shows the selected specialist and reason. The timeline records
admission, selector evaluation and every change of selected program. Explicit
selector trials also show uninstalled portfolios and are excluded from tournament
scores and promotion. The evolution report lists saved specialties and whether
the selector was installed. Inspect a routing artifact to read exact programs,
source references and paired game results. Final unseen tests compare the actual
installed population; rejected proposals are labeled separately.

`npm run lab:verify -- <id>` independently rebuilds admission and training,
checks original model transcript identity, reproduces selections and matches,
and verifies the saved specialist pool. All previous run formats remain readable.

`#/lab` runs real local inference and executes the resulting bounded programs.
It does not advance the existing repository scenario. Five separately prompted
roles share one Qwen2.5-Coder 7B Instruct model: a language author, two game authors
and two strategists. The verifier and referee are deterministic host code, not
additional models. There are no preloaded generated artifacts or runtime fixture
fallbacks. A failed model response remains visible as a failure.

## Start on Windows

```powershell
npm run model:setup
npm run model:start
```

Keep the second command running. In another terminal, run `npm run build` and
`npm start`, then open `http://127.0.0.1:4173/#/lab` and select **Start local
experiment**. Setup needs Internet access once; inference uses loopback HTTP and
does not require a commercial provider account, API key or credits. Computation
uses your own GPU, RAM and electricity. Stop the model terminal when finished to
release its memory. This is not an installed background service.

Setup downloads the official llama.cpp b11719 Windows Vulkan runtime and official
Qwen Q4_K_M weights into ignored `runtime/local-model`. The model is
4,683,073,536 bytes; reserve approximately 5 GB for runtime assets. Both downloads
are pinned and SHA-256 checked. Interrupted downloads can resume. The starter
checks the model hash again before launch; download URLs and digests are in
`scripts/setup-local-model.ps1` and `runtime/local-model/provenance.json`.

- Runtime: <https://github.com/ggml-org/llama.cpp/releases/tag/b11719>
- Weights: <https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/tree/13fb94bfda8c8cf22497dc57b78f391a9acb426a>
- Weight SHA-256: `509287f78cb4d4cf6b3843734733b914b2c158e43e22a7f4bf5e963800894d3c`

The provider binds to `127.0.0.1:8199`, with a locally generated access token in
ignored `runtime/local-model/server-token`. It is a local process credential, not
a paid API key, and is never sent to the browser. The UI is disabled and CORS is
restricted. `LOCAL_MODEL_URL` accepts only a loopback HTTP origin; a replacement
server must expose the same alias and use this local token. No provider tool,
shell, file access or native code execution is enabled.

## What the agents create

The author defines a named expression DSL with 3–8 functions. Bodies combine a
fixed numeric/boolean host calculus. Client programs use the generated functions
through JSON expression arrays. At least one function must compose operations;
game predicates and strategy scores must call the generated language.
Structured decoding uses canonical positional parameter names `a` through `d`,
lexically scoped function bodies and operator arities. It selects boolean-returning
roots for game predicates and numeric-returning roots for strategy scores. The
host supplies measured function examples to downstream roles so they can inspect
actual semantics instead of trusting potentially misleading generated names.
After an invalid game response, a verifier tool can enumerate up to 2,048 calls
in that generated language, exhaustively validate their finite game domain and
offer at most eight semantically distinct legal predicates. On repair attempts,
the model selects one of these verified programs. The synthesis event and candidate
artifact explicitly identify `host_synthesis` assistance. This is real program
search, not independently authored LLM code or a preloaded game fallback. A
language with no found valid candidates can still fail its experiment.

This first experiment supplies the expression encoding, interpreter, finite
heap-removal game engine and evaluation contracts. The model creates the language
abstractions, game predicates and strategy programs inside that domain. It does
not invent an unrestricted compiler, novel general-purpose syntax, graphics
engine or native executable. The two tasks specify normal and misere play;
the model chooses each game's initial heap, legal moves and name.

Validation checks all heaps 1–64 and both turns for legal, non-deadlocking games
and numeric strategy scores. Evaluation has explicit depth, numeric and fuel
limits, no recursion, `eval`, IO or host object access. The engine limits removal
to 1–8 stones and strictly decreases the heap. A finite conformance pass proves
only these contracts, not novelty, interesting gameplay or optimal strategies.

The tournament executes 64 matches: two games, 16 opening heaps per game and both
starting seats. Each strategy scores legal moves; ties choose the smallest move.
The highest score selects the move. Wins come from engine state, not model claims.
The artifact inspector replays each saved move and displays exact source. Reusing
one model may produce similar or identical strategies; identical policies are
explicitly reported. This is not evidence of independent model populations.

## Loss analysis and strategy evolution

New experiments default to two improvement rounds (three tournaments, 192 games).
The UI offers one to three rounds. API clients may explicitly use zero for a
baseline-only experiment. The runner stops at the selected round budget; it is
not an unattended endless process. **Continue improving these strategies**
creates a child experiment with the final policies, unchanged language/games,
and bounded feedback memory from the completed parent. Parent status, version
and provenance must match; the old run remains immutable. No migration is needed
for these append-only JSON artifacts in the existing experiment tables.

Each round freezes both opponents, saves full loss traces, and supplies each role
with its own bounded sample of losses, measured mistakes, losing positions and
function examples. Backward induction computes which moves preserve a forced
win for each heap/turn, including misere terminal rules. Forced losses are not
mistakes. The model writes an analysis and a complete revised strategy; its
explanation is an unverified interpretation, never evidence of improvement.

If a valid unaided proposal fails the gate and training errors remain, a bounded
program-search tool enumerates up to 3,000 expressions per game from the generated
numeric functions. Its objective uses only heaps 1–32 and both turns. It offers
up to three ranked candidates per game. The local model selects exact candidates
and explains its choice. Search results are `host_synthesis`, and the resulting
candidate is `host_synthesis_selected_by_model`, not unaided model authorship.
The search contains no hard-coded winning policy or fallback game. It can fail
to find an improvement. Syntax-valid regressions and unsuccessful model attempts
remain visible rather than replacing the previous strategy.

Promotion requires all of the following:

- Different executable policies and strictly fewer mistakes on control heaps 33–64.
- No increase in mistakes on training heaps 1–32.
- At least as many wins against the same two frozen previous-generation strategies,
  across both games, heaps 33–48 and both starting seats (128 matches per version).

Tournament openings rotate through 16 positions inside heaps 1–32, so loss traces
cannot leak control positions into subsequent prompts. Control positions are
reused across generations, and promotion reveals a selection signal; this is a
regression suite, not an independent held-out generalization benchmark. Strategies
adapt through code and persisted feedback; model weights are never trained.

The timeline shows loss reviews, raw attempts, model interpretations, search
assistance, evaluation, before/after policies, promotion or retention, checkpoints,
and all executed tournament matches. Filters select a role and changes/matches/all
without deleting records. The progress table compares both strategies' control
mistakes per generation. Match scores alone can remain 32:32 even when both improve.
Every evaluation artifact retains complete paired match traces, hashes and frozen
opponents. Replay verification checks the lineage hash, generations, losses and
promotion decisions using the same interpreter (not an independent solver).

## Evidence and limits

Each accepted or rejected model attempt saves its prompt, raw response, usage,
timing and finish reason. New attempts also save the decoding schema and run-derived
seed. The provider uses the [llama.cpp schema-constrained JSON contract](https://github.com/ggml-org/llama.cpp/blob/b11719/tools/server/README.md#post-v1chatcompletions).
Artifacts include language, games, strategies and every
match replay. SHA-256 uses UTF-8 `JSON.stringify` with recursively lexicographically
sorted object keys, unchanged array order, and no whitespace. This survives JSONB
key reordering; it is an integrity check, not a digital signature or authenticity
proof against an operator with database write access.

Workspace migration `002_experiments.sql` adds separate run, event and artifact
tables. Event sequence, run revision, artifact and status commit atomically.
Reads lock the run while collecting a consistent snapshot. Only one experiment
can run at once. Cancellation compares the expected revision. Restarted active
runs become `interrupted`; artifacts remain. Restart does not resume inference.

Budgets: at most three attempts per stage, 51 model calls, 1,600 generated tokens
per response, a 240-second request timeout and 20-minute run deadline. At 200
retained runs, creation is refused; no experiment history is auto-deleted. The
timeline polls once per second while visible, reports current activity and filters
by role; it records completed responses, not an unbounded token stream.

The application remains loopback-only. Experiment controls are local operator
controls; they are not connected to account-owned agents, public hosting, real Git
repositories or the contribution leaderboard. Deployment/multi-user authorization
and arbitrary-code sandboxing need separate work.

`npm run diagnostics` measures model storage without deleting it. The model log
retains a bounded 64 KiB text tail; diagnostic retention remains seven days/50 MB
for eligible `qa-*` files. Databases, backups and model assets are excluded.
Scenario JSON export is not an experiment export: preserve the full workspace
database for experiment recovery, after stopping the application.

`npm run lab:verify -- <run-uuid>` reads a completed local-model run, checks every
artifact hash and event sequence, reexecutes every generation and promotion evaluation and compares every
move and score. It writes a retained receipt to `runtime/verification`. This is a
replay check using the same interpreter, not an independent implementation or a
statistical evaluation of model capability.

## First verified run

Run `fdab1575-2bbf-49da-9db4-1f209cd9809e` completed locally on 2026-10-18 using
Qwen2.5-Coder 7B Q4_K_M on an RTX 4060 Laptop GPU. It generated HeapLang, two
normal/misere heap games and two strategy programs. The 64 executed matches
finished 32:32, with 90 recorded events and 79 hash-checked artifacts. Seven model
calls used 4,283 prompt and 721 completion tokens in 18.033 seconds. Both games
used verifier synthesis assistance on their second attempt.

Both legal predicates are constant true, so they retain the host's 1–8 removal
range. The strategies are syntactically different but all matches used one-stone
moves. This run establishes execution and evidence persistence, not novelty or
tactical quality. Earlier development failures are retained. Replay verification
matched every move and remained identical after restarting the application.

## API

All routes pass through the same-origin gateway and existing loopback/write-origin
policy. Run IDs are UUIDs. Test doubles use `test_fixture` provenance and never
install artifacts in the normal workspace.

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/lab` | Local readiness and retained run catalogue |
| POST | `/api/lab/runs` | `{ mode: "heap" or "arena", learningRounds: 0..3 }` (rounds default 2), optional `sourceRunId` with matching `sourceVersion`; 202 with new run. Omitted mode inherits the parent or defaults to heap. |
| GET | `/api/lab/runs/:id` | Consistent run, events and artifact metadata |
| GET | `/api/lab/runs/:id/export` | Atomic snapshot with every artifact for replay/export |
| GET | `/api/lab/runs/:id/artifacts/:name` | Exact JSON artifact and SHA-256 |
| POST | `/api/lab/runs/:id/cancel` | `{ "version": N }`; stale revision returns 409 |

Offline providers return 503 before creating a run. Concurrent starts return 409.
The browser never receives the provider credential. Model output is untrusted
data, rendered as text and interpreted only by the bounded calculus.


## Verified learning run

Run `7d6badfd-996b-4b26-8a5b-4a3d83140431` completed on 2026-10-18 with
192 tournament matches and 1,536 paired evaluation matches. Both roles reduced
control mistakes from 98 to zero in the first improvement round; the second
round rejected regressions. Final scores remained 32:32 because both policies
were equally strong and identical. The promoted programs were synthesized by
the host search tool and selected by the local model, not independently invented
by the 7B model. Seven calls consumed 7,033 prompt and 1,743 completion tokens
in 58.524 seconds. The replay receipt checks 229 artifacts and 250 ordered events.
This is evidence for these two finite games, not unrestricted agent learning.

New lineage records use `json-iso-dates-v1`: canonical JSON of the parent API
snapshot, including ISO timestamps. Earlier development records without this
marker hashed database driver Date objects as empty objects; the verifier
preserves that historical encoding rather than rewriting saved evidence.

## Evolving resource arena

The UI defaults new experiments to `arena`. This separate bounded game family
preserves old heap runs. Three strategist roles and one rule author share the
local model through distinct prompts. Programs use the generated expression
language; the host interpreter, resource mechanics, sampling and validation are
conventional application code. No model weights are trained.

The model chooses three action names, two sets of cyclic counter edges and
magnitudes, action costs, energy cap, recharge and phase duration. The host
expands those edges into zero-sum payoff tables. Identical actions tie. Both
players simultaneously select affordable actions for 24 rounds without seeing
the opponent's current choice. Programs score actions using energy, phase,
previous actions and observed frequencies. Model-selected softmax temperature
and 5% uniform exploration determine legal-action probabilities. Seeds and
both programs are saved for exact replay.

Two initial games are generated. Before each improvement round the model
proposes another, up to five active games. Numerical fingerprints reject cosmetic
duplicates. Old games remain active; up to six prior policies are archived as
opponents. Arena continuations inherit rules, policies and that archive. A heap
parent contributes only its language. Expected parent revision, provenance and
immutable history contracts remain enforced.

Each tournament plays all three pairs, both seats, seeds 21–24, and every active
game. Opponents are then frozen for paired evaluations. Models receive actual
loss traces and their previous policy. Promotion requires strictly more control
points on seeds 1001–1004, no training regression on seeds 11–12, and minimum
behavioral distance of 0.12 from other active policies. Wins earn two points,
draws one. Reused control seeds form a regression suite, not independent evidence
of generalization. Sequential promotions check already-updated cohort members.

Distance is mean total variation between action-probability vectors on 24 common
probe states per game. Cosmetic differences and random outcomes do not count.
These finite tests cannot guarantee permanent diversity, optimal play, or the
absence of a shared weakness. Rules that collapse cohort diversity are rejected.

New arena runs use protocol `model-revision-v4`. There is no host policy search
or candidate menu, including initial policy generation. The model has at most
six attempts per revision. It returns a lesson, an approach, a diagnosis, an
evidence citation, a hypothesis and its own executable strategy. A bounded ledger
retains six distinct failed expressions per strategist, their development scores,
two paired training regressions and source artifacts. Continuations inherit this
ledger; older runs contribute their rejected final proposals. Unseen results are
excluded. Prompts lead with the ledger and change the investigative question on
each attempt; the host never supplies a replacement strategy. Identical expression
trees and behavior within 1% of the incumbent or a valid remembered failure are
rejected before evaluating matches, even if names or temperature differ. Invalid
or non-improving drafts receive cumulative feedback; exhausted attempts retain
the incumbent. This enforces novelty, not model understanding or improvement.
In addition, each call receives a positive grammar with known expressions removed
by prefix-trie subtraction. It excludes all active/archived strategies, inherited
expression history, parent drafts and every parsed draft in the current run,
across roles. This exclusion history is never evicted; its budget stops generation
rather than permitting repeats. New literals are integers -100..100, while runtime
observations remain real. The finite numeric domain makes exact exclusion possible
without relying on unsupported negation. See the upstream
[llama.cpp grammar constraints](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md#json-schemas--gbnf).
`arena-grammar-*` artifacts record the actual per-attempt schema and forbidden
sources. This prevents source repetition, not every semantic equivalence; common
behavioral probes and promotion gates remain necessary.
Inherited policies retain their historical authorship. Older arena records and
the separate heap experiment keep their original search provenance.

Loss reports replay training losses across up to three distinct games, selecting
two high-regret rounds per game. They save pre-action observations, legal actions,
policy scores/probabilities, energy and immediate counterfactual payoffs against
the already revealed opponent action. These hindsight values are diagnostic,
not observations available during play or proof of long-term causal benefit.
The model receives a compact, rounded subset (two games, one round each); exact
reports and actual prompts remain available. Textual diagnosis is a model claim;
replayed performance determines acceptance.

After every revision and tournament is complete, a freeze event fixes the final
policies. Only then does the host create two numerically novel rule sets, three
new test policies and fresh seeds derived from the run ID. Test opponents must
be at least 1% behaviorally distinct from retained policies and each other on
the common probes. These are disclosed evaluation fixtures, never strategy
candidates, and no inference or promotion follows their results in this run.
Paired tests separately cover new games, new opponents and both new together.
They compare starting code to installed code, and separately to the last valid
rejected model proposal if different. All inputs, scores and match hashes are
saved in `arena-holdout-suite.json` and `arena-transfer-p*.json`.
This is a finite within-family transfer test, not unrestricted generalization or
a permanent secret test set; records are inspectable after execution.

The arena grammar remains finite with two call layers. Numeric parameter
requirements are derived from primitive arithmetic/comparison uses in function
bodies, excluding boolean literals/calls from those argument slots. This constrains
types, not the chosen scoring expression. Interpreter depth, fuel
and numeric limits apply. Runs allow 0–3 improvement rounds, 60 calls and 20 minutes.

The live timeline includes rules, transcripts, loss evidence, model revisions,
policy diffs and replays. The replay inspector shows simultaneous
actions, energy, phase, probability and score. `npm run lab:verify -- <id>`
checks artifact hashes, reruns tournaments and promotion decisions, remeasures
diversity, checks policy continuity and verifies the parent snapshot. Receipts
are saved under `runtime/verification/`. Evaluation artifacts store full-match
hashes instead of duplicate traces; verification regenerates those matches.

## Watching the visual arena

The arena leads the laboratory page. **Follow live** shows the latest received
server round of a featured match, including both simultaneous moves, probability,
energy after costs/recharge, signed score and the current directed counter rules.
Phase changes update the rule diagram; match changes update the whole rule set.
One match per game/generation runs with 650ms between executed rounds. Pairings
rotate; the rest of the tournament uses the same interpreter at full speed.
Polling updates once a second, so the visual display can skip intermediate
frames without dropping persisted round evidence.

**Freeze view** holds a local snapshot while the server continues; **Resume live**
jumps to current evidence. Between matches, the current model/verifier activity
is shown. Offline and terminated runs are labeled rather than presented as live.
**Recordings** provides every completed match, play/pause, 0.5×/1×/2× speed,
previous/next round, direct round selection and a scrubber. Playback is a view
of a real trace, not new model inference; it stops at the final round and does
not advance while the tab is hidden. Tables and rule details remain in the
collapsed evolution report below the visual arena. Normal timeline filters
group per-round broadcast events with matches instead of analysis.
