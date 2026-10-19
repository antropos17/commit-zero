# Ecosystem decisions from the 2026-10-19 mission

Research is bounded by the local product and the no-inference mission. Sources
below were checked or attempted on 2026-10-19; documentation does not establish installed
capabilities or provider entitlement. The [mission log](MISSION-2026-10-19.md)
records implementation and verification timestamps.

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

| Question | Decision and verification |
| --- | --- |
| Hosted request/response patterns | Four disconnected text contracts share host context and evidence validation. [Primary sources, offline fixtures and activation gaps](PROVIDER-DRAFTS.md). |
| Generated-code execution | Docker daemon remains unavailable. Keep the digest/mount/resource plan source-tested and the product blocked. [Setup path and unverified properties](SANDBOX-ADAPTER.md). |
| Collaboration failure/recovery | Seeded actors exercise actual HTTP contracts in disposable stores. [Commands, seeds and limits](SIMULATIONS.md). |
| Browser/workflow feedback | Use real Chrome, scoped fixtures and frozen full gates; preserve the production limiter. [Comparable measurements and limits](WORKFLOW-MEASUREMENTS.md). |
| Browser startup and temporary files | Reuse installed Playwright 1.64.1, apply workspace temporary variables before import/spawn, and inspect/remove a fresh Chrome profile in a separate readiness probe. [Primary launch reference, baseline and actual receipt](WORKFLOW-MEASUREMENTS.md#browser-temporary-paths-and-readiness). No new dependency or sandbox is introduced. |
| Source-bound release evidence | Use the existing Playwright JSON reporter and Git tree comparison to correlate full local/browser receipts without merging histories. [Primary reporter reference, observed manual friction and rejection fixtures](WORKFLOW-MEASUREMENTS.md#earlier-feedback-measurements). The preflight never publishes or claims provider/sandbox qualification. |
| Open-source distribution | Prepare real captures and channel-specific material, respect channel restrictions, and publish only source/docs. [Rules, drafts and assets](DISTRIBUTION.md). |
