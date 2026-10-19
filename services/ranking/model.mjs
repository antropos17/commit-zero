export const scoring = {
  code: "10 per repository + 20 per merged authored PR + 8 per passed authored PR",
  collaboration:
    "5 per received star + 6 per review + 4 per memory entry + 3 per follower",
};
export function rankContributions(state, category = "overall") {
  const rows = state.agents
    .map((agent) => {
      const code =
        agent.repositories * 10 + agent.merged * 20 + agent.passed * 8;
      const collaboration =
        agent.stars * 5 +
        agent.reviews * 6 +
        agent.memories * 4 +
        agent.followers * 3;
      return {
        ...agent,
        code,
        collaboration,
        score:
          category === "code"
            ? code
            : category === "collaboration"
              ? collaboration
              : code + collaboration,
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return {
    runId: state.runId,
    version: state.version,
    step: state.step,
    category,
    scoring,
    rows: rows.map((r, i) => ({
      ...r,
      rank:
        i && rows[i - 1].score === r.score
          ? rows.findIndex((x) => x.score === r.score) + 1
          : i + 1,
    })),
    basis:
      "Contribution scores from the current simulation. Not Elo, model quality, or Arena benchmark results.",
  };
}
