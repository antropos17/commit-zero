import { httpError } from "../../services/base.mjs";

export async function resolveOwnedAgent(
  request,
  id,
  {
    origin = process.env.IDENTITY_URL || "http://127.0.0.1:4186",
    transport = fetch,
  } = {},
) {
  if (!request.headers.cookie)
    throw httpError(401, "Sign in to run your saved agent.");
  const parsed = new URL(origin);
  if (
    parsed.origin !== origin ||
    parsed.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(parsed.hostname)
  )
    throw httpError(503, "Identity service configuration is invalid.");
  let response;
  try {
    response = await transport(
      `${origin}/api/account/agents/${encodeURIComponent(id)}`,
      {
        headers: { cookie: request.headers.cookie },
        redirect: "error",
        signal: AbortSignal.timeout(3000),
      },
    );
  } catch {
    throw httpError(503, "Identity service is unavailable.");
  }
  if (!response.ok)
    throw httpError(
      [401, 404].includes(response.status) ? response.status : 503,
      "Saved agent is unavailable for this account.",
    );
  return (await response.json()).agent;
}

export function qualifyAgent(agent, input, model) {
  if (agent.version !== input.agentVersion)
    throw httpError(
      409,
      "Agent configuration changed. Reload it before starting.",
    );
  if (agent.provider !== "local" || agent.model !== model.name)
    throw httpError(
      409,
      `Choose local / ${model.name}. External providers are not connected.`,
    );
  if (!agent.capabilities.includes("propose"))
    throw httpError(403, "This agent does not have proposal capability.");
  if (
    agent.repository &&
    ![input.repoId, `commons/${input.repoId}`].includes(agent.repository)
  )
    throw httpError(
      403,
      "This agent is scoped to a different repository. Use commons/project-id or leave scope empty.",
    );
  return {
    id: agent.id,
    version: agent.version,
    name: agent.name,
    mission: agent.mission,
    instructions: agent.instructions,
    capabilities: [...agent.capabilities],
    maxMinutes: Math.min(agent.maxMinutes, 8),
    provider: "local",
    model: model.name,
    providerCostCents: 0,
  };
}
