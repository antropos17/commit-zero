# Disconnected hosted-provider contract drafts

`shared/provider-drafts.mjs` prepares bounded, text-only request bodies for the
documented Anthropic, OpenAI, Google and Mistral profiles. It contains **no HTTP
client, credential, activation switch or tool executor**. `draftProviderExchange`
returns `transport: "not-connected"`; it does not check account access or incur
cost. Local and unresolved model selections fail before a draft is produced.

`inspectProviderExchange` uses offline response shapes to refuse truncated,
refused, non-text and tool-call outcomes, parses one JSON envelope, and checks its
exact run, project and source revision. These are host contract checks; they do
not establish that any real API response will have this shape or that the model
will follow the instructions. Tests use handwritten schema fixtures, never a model.

## Sources and decisions

All sources accessed 2026-10-19. Their API shapes may change before activation.

| Primary source | Relevance, expected benefit, decision, verification |
| --- | --- |
| [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create) | System text is separate from user messages; `max_tokens` and `stop_reason` constrain a text-only draft. Reject anything other than a completed single text block. Offline fixture covers end turn, truncation and refusal. |
| [OpenAI text generation](https://developers.openai.com/api/docs/guides/text) | Responses API has `instructions`, `input`, `max_output_tokens`, and an `output` array that can include non-text items. Scan the array and reject tool output rather than assuming `output[0]` is text. Offline fixture covers a message and a tool call. |
| [Gemini generateContent API](https://ai.google.dev/api/generate-content) | `systemInstruction`, `contents`, `generationConfig.maxOutputTokens` and candidate `finishReason` support a bounded draft. Only one `STOP` text part is accepted; safety and function output fail closed in fixtures. |
| [Mistral chat API](https://docs.mistral.ai/api/endpoint/chat) | Chat messages and `max_tokens` support a text draft. `tool_choice: "none"` and response inspection reject tool calls; offline fixture covers stop and tool output. |

The four adapters share a task/context envelope and the existing
`validateAgentOutput` host check. None of the proposed `repository.read`,
`proposal.write`, `proposal.read`, or `web.read` grants is executable here.

## Reproduce and activate later

```powershell
node --test tests/provider-drafts.test.mjs
npm run check:commons
```

Before any hosted call, add an owner-controlled credential store and access
preflight, model availability check, bounded transport with abort/timeout,
rate and cost accounting, immutable request/response receipts, explicit tool
authorization, error recovery and a single-role activation gate. Qualify each
provider and exact model through an approved real run; neither these fixtures
nor model documentation qualify a runtime. Revisit API versions and policy
before accepting a response in production.
