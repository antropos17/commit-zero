# Ecosystem decisions from the 2026-10-19 mission

Research is bounded by the local product and the no-inference mission. Sources
below were checked or attempted on 2026-10-19; documentation does not establish installed
capabilities or provider entitlement. The [mission log](MISSION-2026-10-19.md)
records implementation and verification timestamps.

## Keep pagination independent from head polling

Actual Timeline fixtures exposed stale busy state across filters, terminal focus
loss and a successful head read erasing an older-page failure. Decision: keep
separate request/error lifecycles, abort old cursors on context replacement and
restore manual entry only when another input has not been chosen. A further
new-head fixture checks complete event IDs against the actual handler so a
cursor from an old first page cannot create gaps. Expected benefit: readable,
recoverable history under concurrent updates. Seven focused Chrome cases passed.
The [Playwright clock reference](https://playwright.dev/docs/clock), accessed
2026-10-19, supports installing timer control before page scripts. It is used
only in explicit timer cases; HTTP handlers and scenario transactions still run.
This avoids artificial wall-time waits without making a performance claim.

## Scope readiness checks to their request

The [React effect/cleanup reference](https://react.dev/reference/react/useEffect#fetching-data-with-effects)
was accessed on 2026-10-19 while checking a real Commons race. A manual health
read could finish after a newer check and replace its offline result; its final
callback could also settle another request's busy state. Decision: cancel the
previous read, link caller cancellation and accept completion only from the
current controller. Validate availability/busy booleans and text reasons before
updating readiness. Expected benefit: task preparation cannot present stale or
malformed metadata as current readiness. Five focused Chrome cases preserve the
task draft, keyboard choice and exact scenario/Commons revisions with no writes.
These are metadata fixtures, not model runtime verification.

## Contain a failed page within the workspace

The [React error-boundary reference](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
was accessed on 2026-10-19 after Chrome reproduced a malformed Language lab
read removing the permanent navigation. Decision: add one small boundary around
the page subtree while retaining the shell and provider instances. Healthy
route changes do not acquire a remount key. Explicit retry remounts only the
failed page; a changed route clears its failed state. Expected benefit: users
can recover or open service health without discarding shell drafts. Fixtures
check repeated failure, keyboard recovery, preserved focus and zero model/write
requests in disposable services. This covers child rendering/lifecycle failures,
not arbitrary async/event-handler failures or the boundary's own errors. The
global fallback remains for failures outside the page and makes no data-safety
promise. No dependency or external reporting service was introduced.

## Reuse a declared local artifact

The official [Qwen model card](https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF)
and [pinned file page](https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/blob/13fb94bfda8c8cf22497dc57b78f391a9acb426a/qwen2.5-coder-7b-instruct-q4_k_m.gguf)
provide the repository, Apache-2.0 license, revision and digest for the already
used Q4_K_M candidate. Decision: bind the two disabled Qwen roles explicitly to
that candidate and provide a read-only byte inspector. Expected benefit: another
operator can distinguish an installed file's identity from an application alias
and runtime readiness. No weights were downloaded or replaced. Metadata/digest,
failure and cancellation fixtures verify the host tool; model quality and
hardware/token fit remain unqualified. [Identity and limits](AGENT-CATALOG.md).

The role pin is versioned. A later installer update must review the role identity
and fixtures explicitly; it must not silently substitute new weights into a
previously described role.

## Defer an MCP transport until tool permissions are qualified

The primary [MCP architecture reference](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture)
separates the host/client/server, protocol features and transport. The current
documentation resolved to version 2026-07-28, so a future integration must check
that version's discovery and authorization requirements rather than assume an
older handshake. Decision: retain Commit Zero's existing `ai-git/1` API and
source-tested proposed grants; add no MCP server, SDK or transport in this pass.
Expected benefit: avoid exposing executable tools before permission, cancellation
and receipt handling are qualified. Current host fixtures check exact context
and supplied evidence IDs; they are not MCP compatibility tests. Activation
requires a concrete needed tool, reviewed executable/dependency provenance,
capability discovery, narrow grants and real denial/cancellation fixtures.

## Keep unresolved provider choices explicit

Opening the official [Moonshot getting-started page](https://platform.moonshot.ai/docs/guide/getting-started)
returned “not accessible via this tool.” No exact Kimi API ID or account access
was verified. Decision: retain Kimi Navigator as unresolved and disabled. The
smallest next action is to obtain an accessible current primary model-ID source,
then qualify the selected adapter and account separately. Local Llama, Gemma
and DeepSeek entries likewise need an explicit artifact/license/hardware choice.
No substitute model is inferred from a familiar display name.

## Other adopted decisions and their evidence

### Complete the source evidence boundary before publication automation

The primary [Git ls-files reference](https://git-scm.com/docs/git-ls-files), accessed
2026-10-19, documents NUL-delimited names, stage/mode records and hidden/sparse
flags. Decision: extend the shared source index to tracked regular inputs and
registered archive/working inputs, and reject unsupported index states. Expected
benefit: root policy, configuration and legacy/reference changes invalidate frozen
receipts. An actual omitted-input inventory and controlled metadata edit exposed
the gap; nine filesystem/Git/CLI tests verify the correction. [Measurements and
reproduction](WORKFLOW-MEASUREMENTS.md#source-index-coverage-and-measured-cost).
The read-only inspection tool adds no provider, model execution or security sandbox.

Git's [commit-tree](https://git-scm.com/docs/git-commit-tree),
[hash-object](https://git-scm.com/docs/git-hash-object) and
[compare-and-swap ref update](https://git-scm.com/docs/git-update-ref) documentation
were also reviewed for a reversible publication preparer. The initial decision
was to defer until source-index v2 was qualified. After that gate, the simpler
[binary diff](https://git-scm.com/docs/git-diff) and
[checked index application](https://git-scm.com/docs/git-apply) contracts were
selected (accessed 2026-10-19): prepare and explicitly stage an exact patch while
leaving both commit histories intact. Commit and ordinary push remain separate.
No commit-tree/ref-update executor, release or tag was added. Expected benefit:
replace repeated handwritten per-file transfer logic, including binary/mode and
deletion handling, with reproducible checks. Eight disposable Git fixtures cover
unchanged dry runs, exact staging and refusal; actual maintainer staging still
requires the frozen full/browser gate and a clean verified commit.

The [Git environment reference](https://git-scm.com/docs/git) was also checked
for disabling lazy object fetch, replacement refs and optional index writes.
Source, preflight and preparation commands share a process-local environment
that clears inherited Git overrides/tracing. A live Windows check exposed the
platform's ownership exception being cleared as well. Decision: pass
`safe.directory` for the exact checked root on each command after ordinary-path
checks; do not change global settings. Actual `check:fast` and the source/preflight
fixtures passed after this correction. This is predictable maintainer behavior,
not a security boundary or proof against another process writing concurrently.

### Workspace and environment boundaries

Primary sources accessed 2026-10-19:

- [GitHub Copilot on GitHub](https://docs.github.com/en/copilot/concepts/copilot-surfaces/copilot-on-github)
  presents scoped repository tasks, reviewable session logs and separate review
  and implementation interactions; it also says logs do not replace review and
  testing. Decision: retain Commit Zero's bounded proposal/exact-review/operator
  merge workflow and disabled role preparation. Expected benefit: reviewable
  provenance without adding an external delegation surface. Existing exact
  patch, stale revision and cancellation suites verify the local behavior;
  this is a product-workflow inference, not comparative quality evidence.
- The [Dev Containers schema](https://github.com/devcontainers/spec/blob/main/schemas/devContainer.base.schema.json)
  exposes mounts, privileged mode, capabilities and security options. Decision:
  an environment description cannot qualify the code runner. Keep the explicit
  Docker argument contract and runtime-denial gates; do not add a convenience
  container configuration while its daemon and isolation remain unqualified.
  Expected benefit: avoid confusing reproducibility metadata with enforced
  boundaries. Source contract tests pass; runtime denial remains blocked.
- [Ollama's model-information endpoint](https://github.com/ollama/ollama/blob/main/docs/api.md#show-model-information)
  describes model metadata, templates, parameters and license. The standalone
  `/api/show` documentation URL returned 404, so the maintained repository was
  used. Decision: keep local alias, artifact identity and runtime readiness
  separate; reuse the existing pinned Qwen artifact inspector rather than add
  another provider for its own sake. Expected benefit: a reproducible identity
  check without model loading. Existing metadata/digest/cancellation fixtures
  and the real read-only Qwen digest provide the evidence; no Ollama probe ran.

### Scoped asynchronous reads

The [React Effect data-fetching reference](https://react.dev/reference/react/useEffect#fetching-data-with-effects)
and [MDN combined abort signals](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static)
were checked on 2026-10-19. Decision: bind retained resources to their exact URL
and revision, ignore cancelled reads, and combine the existing ordinary 12-second
request deadline with caller cancellation through response-body consumption.
Expected benefit: no mislabeled ranking snapshots or indefinite spinner after a
caller supplies cancellation. Actual Chrome baselines reproduced wrong-category
rows, a false empty state and a stalled read beyond its deadline. Host HTTP
fixtures cover body timeout, cancellation, HTTP failure details and invalid JSON;
browser fixtures check actual timeout/retry and newer transactional revisions.

The [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
(accessed 2026-10-19) distinguishes a stable-label toggle from an action button
with changing labels, and describes focus staying on actions in the same
context. Actual Chrome fixtures showed focus loss after Next step and an
unavailable Pause during an in-flight transaction. Decision: retain native
action buttons, restore manual-operation entry after the DOM commit, and keep
Pause available until future scheduling stops. The existing small
[React layout effect](https://react.dev/reference/react/useLayoutEffect)
runs after committed updates; it performs no state update, network call or
layout loop. Expected benefit: keyboard users can complete and pause the
deterministic cycle. Browser fixtures check terminal/new-run history, failure
without automatic write retry, and pause with/without another focus choice.

| Question | Decision and verification |
| --- | --- |
| Hosted request/response patterns | Four disconnected text contracts share host context and evidence validation. [Primary sources, offline fixtures and activation gaps](PROVIDER-DRAFTS.md). |
| Generated-code execution | Docker daemon remains unavailable. Keep the digest/mount/resource plan source-tested and the product blocked. [Setup path and unverified properties](SANDBOX-ADAPTER.md). |
| Collaboration failure/recovery | Seeded actors exercise actual HTTP contracts in disposable stores. [Commands, seeds and limits](SIMULATIONS.md). |
| Browser/workflow feedback | Use real Chrome, scoped fixtures and frozen full gates; preserve the production limiter. [Comparable measurements and limits](WORKFLOW-MEASUREMENTS.md). |
| Browser startup and temporary files | Reuse installed Playwright 1.64.1, apply workspace temporary variables before import/spawn, and inspect/remove a fresh Chrome profile in a separate readiness probe. [Primary launch reference, baseline and actual receipt](WORKFLOW-MEASUREMENTS.md#browser-temporary-paths-and-readiness). No new dependency or sandbox is introduced. |
| Source-bound release evidence | Use the existing Playwright JSON reporter and Git tree comparison to correlate full local/browser receipts without merging histories. [Primary reporter reference, observed manual friction and rejection fixtures](WORKFLOW-MEASUREMENTS.md#earlier-feedback-measurements). The preflight never publishes or claims provider/sandbox qualification. |
| Open-source distribution | Prepare real captures and channel-specific material, respect channel restrictions, and publish only source/docs. [Rules, drafts and assets](DISTRIBUTION.md). |

### Saved-author recovery (accessed 2026-10-19)

The existing [React effect cleanup guidance](https://react.dev/reference/react/useEffect#fetching-data-with-effects)
also applies to owner-scoped configuration reads. An actual Chrome baseline
showed a false sign-in instruction and a native select visually falling back to
Workspace Builder after HTTP 503. Decision: keep owner-scoped read state, validate
rendered fields and IDs, cancel replaced reads, retain the intended selection
with an unavailable option, and offer explicit read-only refresh. Last-available
choices stay qualified and cannot authorize a submission until refreshed.
Expected benefit: a failed discovery read cannot silently change task attribution.
Four browser cases exercise actual disposable account/configuration endpoints,
failed and malformed reads, recovery, missing selection, focus and narrow axe.
Configuration creation is explicitly non-executable; no job is submitted and no
model or catalog role is activated. No dependency or third-party code is added.
