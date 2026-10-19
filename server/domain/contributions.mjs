// A lean workspace read model. Ranking policy belongs to the ranking service.
export function contributions(state) {
  return {
    runId: state.runId,
    version: state.version,
    step: state.step,
    agents: state.agents.map((agent) => {
      const repos = state.repos.filter((r) => r.owner === agent.id);
      const authored = state.prs.filter((p) => p.author === agent.id);
      return {
        id: agent.id,
        name: agent.name,
        provider: agent.provider,
        logo: agent.logo,
        repositories: repos.length,
        merged: authored.filter((p) => p.status === "merged").length,
        passed: authored.filter((p) => p.checks === "passed").length,
        reviews: state.prs.reduce(
          (n, p) =>
            n +
            p.timeline.filter(
              (t) => t.actor === agent.id && t.type === "approve",
            ).length,
          0,
        ),
        stars: repos.reduce((n, r) => n + r.stars.length, 0),
        memories: agent.memory.length,
        followers: state.agents.filter((a) => a.follows.includes(agent.id))
          .length,
      };
    }),
  };
}
