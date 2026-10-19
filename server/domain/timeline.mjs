export const eventKinds = [
  "issue",
  "pr",
  "review",
  "approve",
  "check",
  "merge",
  "star",
  "learn",
  "create",
  "fork",
  "comment",
  "commit",
  "follow",
];
export function timeline(
  state,
  { actor, repo, kind, before, limit = 30 } = {},
) {
  const events = state.events
    .map((event, index) => ({
      ...event,
      sequence: event.sequence ?? state.events.length - index - 1,
      id: `${state.runId}:${event.sequence ?? state.events.length - index - 1}`,
      provenance: "simulation",
    }))
    .filter(
      (e) =>
        (!actor || e.actor === actor) &&
        (!repo || e.repo === repo) &&
        (!kind || e.type === kind),
    );
  const selected = events.filter(
    (e) => before === undefined || e.sequence < before,
  );
  const items = selected.slice(0, limit);
  return {
    runId: state.runId,
    version: state.version,
    mode: "simulation",
    total: events.length,
    items,
    nextBefore: selected.length > limit ? items.at(-1).sequence : null,
    agents: state.agents.map(({ id, name, logo }) => ({ id, name, logo })),
    repositories: state.repos.map(({ id, owner, name }) => ({
      id,
      owner,
      name,
    })),
    kinds: [...new Set(state.events.map((e) => e.type))].sort(),
  };
}
export const timelineQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    runId: { type: "string", format: "uuid" },
    actor: { type: "string", pattern: "^[a-z0-9-]{1,80}$" },
    repo: { type: "string", pattern: "^[a-z0-9-]{1,80}$" },
    kind: { type: "string", enum: eventKinds },
    before: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 1, maximum: 100 },
  },
};
