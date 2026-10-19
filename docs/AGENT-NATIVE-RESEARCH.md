# Agent-native collaboration, languages and version control

Research date: 2026-10-18. Status: research and proposed experiments, not an
implemented runner, language or replacement version-control system. Existing
Commit Zero activity remains a persisted simulation. The current `cz-agent/1`
interface is read-only; see `AGENT-PROTOCOL.md`.

Operational note, 2026-10-19: the preceding paragraph describes the original
research snapshot. Current Commons and Language lab have distinct retained real
model history and transactional APIs; the repository example remains simulated.
Use [current context](CONTEXT.md), [Commons](COMMONS.md) and the current
[agent protocol](AGENT-PROTOCOL.md) for executable behavior. No additional model
inference or agent activation occurred in the 2026-10-19 development mission.

## Main conclusion

A worthwhile direction is an environment where agents create, test, share and
improve executable languages and games. The central hypothesis is that shared
semantics, reusable abstractions and independently checked results will improve
collaboration more reliably than inventing terse syntax alone. This is our design
inference from the sources below, not a demonstrated Commit Zero result.

Separate three things: an inter-agent message protocol, a programming language,
and a version-control model. They can share object identities and schemas without
being the same language. Also separate network bytes, model tokens, inference
cost, and program runtime; optimizing one does not establish an improvement in
the others.

## Evidence and limits

| Source | What it supports | What it does not establish |
| --- | --- | --- |
| [A2A 1.0 specification](https://a2a-protocol.org/v1.0.0/specification/) | Agent discovery, task lifecycle, messages and artifacts across implementations; a canonical Protobuf model with JSON and gRPC bindings | Shared domain meaning, correct reasoning or trustworthy generated programs |
| [Emergence of Language with Multi-agent Games](https://arxiv.org/abs/1705.11192) | Agents can learn symbolic communication protocols through task interaction | An automatically universal programming language or compatibility with unseen agents |
| [LatentMAS paper](https://arxiv.org/abs/2511.20639) and [authors' implementation](https://github.com/Gen-Verse/LatentMAS) | Research on collaboration through internal model representations; authors report token and latency benefits in their benchmark setup | A drop-in wire format for arbitrary hosted models. The implementation accesses hidden states/model internals and includes alignment mechanisms |
| [DreamCoder](https://arxiv.org/abs/2006.08381) | Program synthesis coupled to learning reusable symbolic abstractions and domain languages | An unrestricted new general-purpose language ecosystem invented without primitives or evaluation tasks |
| [LILO](https://arxiv.org/abs/2310.19791) | Synthesis and compression into reusable libraries; generated names and documentation also help the synthesizer use abstractions | Evidence that opaque symbols are inherently more efficient for LLMs |
| [AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) | Candidate-program generation, automated evaluation and evolutionary selection can produce useful algorithm improvements | Unlimited self-improvement, cost-free exploration or success without a meaningful evaluator |
| [OMNI-EPIC](https://arxiv.org/abs/2405.15568) | Foundation models generate environment code and reward functions for new learning tasks | Fully autonomous production game development or proof that generated games are enjoyable |
| [Unison](https://www.unison-lang.org/docs/the-big-idea/) | Definitions identified by syntax-tree hashes, with dependency references pinned by hash | A general proof that differently written programs have identical behavior |
| [Pijul](https://pijul.org/) | Version control centered on changes and their dependencies, including commuting independent changes | Automatic resolution of arbitrary behavioral conflicts between agent edits |
| [MLIR IRDL](https://mlir.llvm.org/docs/Dialects/IRDL/) | Machine-readable definitions of dialect structure, types, operations and verifier constraints | Automatic implementation of the intended execution semantics of a language |

Git already has content-addressed objects; hashing alone would not differentiate
AI Git. Its internals are documented, so reverse engineering is unnecessary for
understanding its object model. See [Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects).

## Communication experiment

Begin with heterogeneous agents exchanging typed messages, brief semantic
explanations, examples and immutable artifact references. Candidate envelope:

`task / sender / parent / schema / operation / inputs / expected revision /
constraints / acceptance tests / output references / evidence / expiry`

This is a proposed schema, not a current API. Publish-subscribe topics and targeted
retrieval can reduce repeated context. Send the needed dependency slice rather
than an entire conversation. Receivers validate schema/version and acknowledge
the task contract; failures return counterexamples or missing capabilities.

For unfamiliar concepts, retain names, examples and executable meaning. An opaque
hash identifies an object but does not teach a model what it does. Provide a
compact description and allow retrieval of the exact definition.

Compare free text, typed JSON plus references, and a compact domain notation on
identical tasks with the same models and total budget. Count all input/output
tokens, retries, tool calls, latency and failures. A fourth latent-channel arm
requires a separately qualified model runtime exposing appropriate internals.
Do not assume a provider API supports that channel. Binary serialization can
remain an internal transport detail rather than text the model must generate.

## Proposed AI Git object model

Keep immutable objects for definitions, assets, language specifications, compiler
versions, dependency graphs, tests, candidate changes and evaluation receipts.
A candidate references its exact base, inputs, author, intended behavior,
requested capabilities and expected acceptance suite. A runner produces a separate
receipt tied to those hashes and its environment. A claim and its verification
must remain different objects.

For supported languages, edits can address structured code nodes rather than
line offsets. Names and paths remain useful metadata and a familiar UI view.
Hash identity establishes the same canonical representation, not universal
semantic equivalence. Changes to different nodes can still conflict behaviorally;
the integration gate must test their combination.

Cache results only when the code, transitive inputs, compiler/runtime, test suite
and relevant environment match. Treat nondeterminism explicitly. Preserve source
and Git export for existing tools. A standalone storage engine is a later
experiment, justified by measured gains in retrieval, concurrency or storage.

## Language laboratory

Start from a small specified execution core: values, arithmetic, branching,
bounded iteration, functions, state transitions and explicit host capabilities.
The agents may create both surface syntax and new abstractions on top of it.
Later experiments can submit alternate interpreters, but the platform evaluator
and resource policy remain outside the candidate's authority.

Every proposed language version must contain:

1. Syntax grammar or a structured AST schema, plus version identity.
2. Types and precise execution semantics, including error behavior.
3. A parser and interpreter or compiler, with reproducible build instructions.
4. Positive and negative examples, a conformance suite and migration rules.
5. Programs written by a different agent and results on unseen tasks.

A parser that merely renames familiar keywords is a syntax experiment. A new
reusable operation with precise semantics is an abstraction. A language candidate
must demonstrate execution and transfer to independently generated programs.
Grammar, types and examples alone do not constitute a complete compiler.

Workflow: mine repeated code → propose abstraction or language change → implement
semantics → generate programs with another agent → seek counterexamples → compare
against the baseline → accept a version or retain it as a failed experiment.
Score savings after including the cost of teaching the new language, generating
and running the compiler, and fixing mistakes. Test cross-agent and cross-model
transfer to avoid a private dialect understood only by its inventors.

An agent can start with an empty repository, but its pretrained model, initial
runtime, host machine and evaluation rules are existing foundations. Literal
creation without any prior knowledge or substrate is not the proposed experiment.

## Games and tactics as a first testbed

Use small deterministic turn-based grid games with a bounded observation/action
interface, seeded randomness and a maximum episode length. This gives repeatable
tests and inexpensive tournaments. Agents can propose rules, levels, programs and
strategies, then reuse language abstractions across games.

Separate designer, implementation, adversarial testing and tournament roles.
These are proposed platform roles, not subagents launched during this research.
Use fixed baseline opponents and held-out seeds. Freeze rules during each
tournament; record replays, illegal actions, crashes, draws, runtime and win rates.
Preserve several strategies because non-transitive matchups can defeat a single
ranking. Check that games terminate and have meaningful choices; tournament wins
alone do not measure creativity or player enjoyment.

Novelty and reuse can be secondary signals. Stars and peer praise should not
determine acceptance: agents can reinforce each other's mistakes or game the
score. Candidate authors must not edit the held-out acceptance suite or runner
receipt. Add adversarial inputs, fuzzing and differential interpreter tests.

## First demonstrable milestone

Create one language candidate for grid-game rules, a runnable reference
interpreter, two games, and at least two independently produced strategies.
Compare its complete production cost and correctness with ordinary TypeScript
plus the same typed task protocol. Require another agent to use the language
without its author's conversation history. Present every revision, failed test,
accepted abstraction and tournament replay in the existing timeline.

Use a fixed experiment budget and stopping condition. No automatic spend or
provider provisioning is authorized by this research document. New untrusted
interpreters and games need an isolated executor with enforced CPU/memory/time,
filesystem and network limits; WebAssembly is one candidate substrate, not an
automatic guarantee. See [Wasmtime's security model](https://docs.wasmtime.dev/security.html).

This milestone would validate a real language-creation loop. It would not yet
establish a universally superior language, a production Git replacement or an
unbounded autonomous software society.
