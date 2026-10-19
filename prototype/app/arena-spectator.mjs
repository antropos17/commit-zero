export function liveMatch(run) {
  const start = run.events.findLast((e) => e.kind === "match-start");
  if (!start) return null;
  const rounds = run.events
    .filter((e) => e.kind === "round" && e.data.matchId === start.data.matchId)
    .map((e) => e.data.round);
  return {
    ...start.data,
    game: start.data.gameRules.name,
    rounds,
    complete: run.events.some(
      (e) => e.kind === "match" && e.data.artifact === start.data.matchId,
    ),
  };
}
export function frameAt(match, step) {
  const round = match.rounds[Math.max(0, step) - 1];
  return {
    round,
    phase: round?.phase ?? 0,
    energy: round?.after ?? [
      match.gameRules.energyCap,
      match.gameRules.energyCap,
    ],
    score: round?.score ?? 0,
  };
}
