import { validAgentContext, validateAgentOutput } from "./agent-evaluation.mjs";

// Pure, disconnected contract drafts. No credential, transport, tool executor or
// activation path is provided here. A future host must qualify all of those.
const endpoints = Object.freeze({
  anthropic: "https://api.anthropic.com/v1/messages",
  openai: "https://api.openai.com/v1/responses",
  mistral: "https://api.mistral.ai/v1/chat/completions",
});

export function draftProviderExchange(profile, expected, task, references = []) {
  if (!profile || profile.enabled !== false || profile.model?.provider === "local" || !profile.model?.id ||
      !Number.isInteger(profile.limits?.outputTokens) || profile.limits.outputTokens < 1 || profile.limits.outputTokens > 1600 ||
      !validAgentContext(expected))
    throw new Error("A disabled, documented hosted profile and exact context are required.");
  if (typeof task !== "string" || !task.trim() || !Array.isArray(references) ||
      references.length > 20 || references.some((item) => typeof item !== "string" || !expected.allowedEvidence.includes(item)))
    throw new Error("A bounded text task and reference list are required.");
  const input = JSON.stringify({
    task, references, runId: expected.runId, projectId: expected.projectId,
    sourceRevision: expected.sourceRevision, profileId: profile.id,
    allowedEvidence: expected.allowedEvidence,
  });
  if (input.length > profile.limits.contextCharacters)
    throw new Error("Input exceeds the profile context ceiling.");
  const system = `${profile.instructions} Return only a JSON object with profileId, runId, projectId, artifactType, sourceRevision, summary, evidence, uncertainties, runtimeVerified:false, merged:false. Evidence must use only allowedEvidence reference IDs supplied by the host. Do not call tools.`;
  const provider = profile.model.provider;
  const model = profile.model.id;
  const maxTokens = profile.limits.outputTokens;
  let url = endpoints[provider];
  let body;
  if (provider === "anthropic")
    body = { model, max_tokens: maxTokens, stream: false, system, messages: [{ role: "user", content: input }] };
  else if (provider === "openai")
    body = { model, max_output_tokens: maxTokens, instructions: system, input };
  else if (provider === "google") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: input }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    };
  } else if (provider === "mistral")
    body = { model, max_tokens: maxTokens, stream: false, n: 1, tool_choice: "none",
      messages: [{ role: "system", content: system }, { role: "user", content: input }] };
  else throw new Error(`No contract draft for provider: ${provider}`);
  return { provider, url, method: "POST", body, transport: "not-connected", toolExecution: false };
}

function providerText(profile, response) {
  const provider = profile.model.provider;
  if (!response || typeof response !== "object" || Array.isArray(response))
    throw new Error("Provider response is not an object.");
  if (response.model && response.model !== profile.model.id)
    throw new Error("Provider model does not match the selected profile.");
  if (provider === "anthropic") {
    if (response.stop_reason !== "end_turn" || response.stop_details?.type === "refusal" ||
        !Array.isArray(response.content) || response.content.length !== 1 ||
        response.content[0]?.type !== "text")
      throw new Error("Anthropic response is incomplete, refused, or not text-only.");
    return response.content[0].text;
  }
  if (provider === "openai") {
    if (response.status !== "completed" || !Array.isArray(response.output))
      throw new Error("OpenAI response is incomplete.");
    const messages = response.output.filter((item) => item?.type === "message");
    if (response.output.some((item) => !["message", "reasoning"].includes(item?.type)) ||
        messages.length !== 1 || messages[0].role !== "assistant" ||
        messages[0].status !== "completed" || messages[0].content?.length !== 1 ||
        messages[0].content[0]?.type !== "output_text")
      throw new Error("OpenAI response has no single completed text message.");
    return messages[0].content[0].text;
  }
  if (provider === "google") {
    if (response.candidates?.length !== 1 || response.candidates[0].finishReason !== "STOP" ||
        response.candidates[0].content?.parts?.length !== 1 ||
        typeof response.candidates[0].content.parts[0]?.text !== "string" ||
        Object.keys(response.candidates[0].content.parts[0]).some((key) => key !== "text"))
      throw new Error("Google response is incomplete or not text-only.");
    return response.candidates[0].content.parts[0].text;
  }
  if (provider === "mistral") {
    if (response.choices?.length !== 1 || response.choices[0].finish_reason !== "stop" ||
        response.choices[0].message?.role !== "assistant" ||
        typeof response.choices[0].message.content !== "string" ||
        (response.choices[0].message.tool_calls != null &&
          (!Array.isArray(response.choices[0].message.tool_calls) || response.choices[0].message.tool_calls.length)))
      throw new Error("Mistral response is incomplete or not text-only.");
    return response.choices[0].message.content;
  }
  throw new Error(`No response contract for provider: ${provider}`);
}

export function inspectProviderExchange(profile, expected, response) {
  try {
    if (!profile?.model?.id || !validAgentContext(expected))
      throw new Error("A documented profile and exact context are required.");
    const text = providerText(profile, response);
    if (typeof text !== "string" || !text.trim() || text.length > profile.limits.outputCharacters)
      throw new Error("Provider text is empty or exceeds the profile output ceiling.");
    const envelope = JSON.parse(text);
    const check = validateAgentOutput(profile, expected, envelope);
    return check.ok ? { ok: true, envelope } : check;
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}
