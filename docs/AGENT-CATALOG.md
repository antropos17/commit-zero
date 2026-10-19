# Proposed agent catalog

The **Proposed roles** page (`#/agent-catalog`) reads 18 source-controlled role
definitions from `shared/agent-catalog.mjs`. It performs no model call, account
write, provider probe, or tool execution. Each role has its own stable ID, purpose,
instructions, expected output, model family, future tool grants, limits, fixture,
and activation requirement. A display name is never treated as an API model ID.
Search by name, purpose or provider, and filter by documented or unresolved model
ID; an empty result is explicit. Filtering never activates a role or changes
saved agent configurations. On narrow screens, details appear above the list;
selecting a role moves focus and the viewport back to those details. Desktop
selection keeps its side-by-side layout.

## Evidence vocabulary

- **Documented**: an exact API ID appears in the linked provider's own catalog.
  This does not show account access, adapter behavior, or suitability for the role.
- **Unresolved model ID**: no exact API ID or chosen local artifact has been
  verified. `cz-local-coder` on Qwen roles is the existing application's local
  alias, not a Qwen upstream model ID.
- **Contract tested**: `node --test tests/agent-catalog.test.mjs` checks unique,
  disabled definitions and rejects mismatched, stale, oversized, or fabricated
  output envelopes. This is deterministic host validation, not model evaluation.
- **Configured / runtime verified**: neither applies to the new catalog. The
  existing saved local agent path is separate and retains its earlier evidence.

As of 2026-10-19, 12 entries reference documented API IDs and six need exact
model selection. All 18 remain disabled. No access to Anthropic, OpenAI, Google,
Mistral, Moonshot, or open-model inference was tested in this mission.

## Sources and decisions

| Source (accessed 2026-10-19) | Relevance and adopted decision |
| --- | --- |
| [Anthropic models](https://platform.claude.com/docs/en/models/overview) | Haiku 5.5, Sonnet 5.5, Opus 5.5, and Fable 5.1 IDs. Keep role names distinct from the model IDs and require a later account and adapter check. |
| [OpenAI API models](https://developers.openai.com/api/docs/models) | Luna, Sol, and Astra IDs. Record them as documented only; no API credential or availability is inferred. |
| [Gemini API models](https://ai.google.dev/gemini-api/docs/models) | Gemini 3.8 Flash endpoint for Explorer. The role remains disabled until adapter and evaluation work. |
| [Mistral Small 4](https://docs.mistral.ai/models/mistral-small-4-0-26-03) | Current `mistral-small-2603` ID for Editor. Earlier `mistral-small-2503` was rejected because it appears under deprecated models. |

Local Qwen, Llama, Gemma, and DeepSeek roles need an explicitly selected model
artifact, license, hardware check, and qualified adapter. Kimi needs a verified
Moonshot API ID and account access. No silent substitute is allowed.

## Contracts and activation

Every candidate receives a bounded task, project/run ID, source revision and
untrusted references. Host validation compares the output's run ID, project ID
and source revision with the exact expected context, rejects unknown fields,
and requires matching profile and artifact types, a bounded summary, evidence
references and uncertainties. It must state `runtimeVerified: false` and
`merged: false`.
`shared/agent-evaluation.mjs` contains task fixtures for conflict, stale base,
disagreement, invalid output, missing documents, and large repository context.
They define validation inputs, not scored model results.

Tool grants in the catalog are proposed permissions. `repository.read`,
`proposal.read`, `proposal.write`, and `web.read` have no catalog executor yet.
There is no shell, secret, network write, merge, or sandbox grant. Before
activating any profile, implement a provider adapter with explicit access checks,
host-enforced permission and cost ceilings, timeout and cancellation receipts,
revision checks, test fixtures, and a real runtime qualification. Record the
provider response and failures without upgrading another profile by association.
The [disconnected hosted-provider drafts](PROVIDER-DRAFTS.md) prepare text-only
request shapes and inspect offline response fixtures for four documented
families. They supply no credential or transport and do not change the disabled
or runtime-unverified status of any role.

The existing Commons Builder/Reviewer workflow is a separate, locally configured
path and still does not execute generated JavaScript. Its parser and review do
not establish runtime correctness.

An [actual browser capture of the proposed-role view](media/agent-catalog-2026-10-19.png)
shows the source-controlled catalog in a disposable scenario fixture. The
scenario badge is part of the deterministic example; none of the proposed roles
ran to produce this image.
