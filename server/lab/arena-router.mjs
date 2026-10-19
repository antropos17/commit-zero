import { hash } from "./store.mjs";

export const flatStrategy = ({ portfolio: _portfolio, ...strategy }) =>
  strategy;
export function routingRule(game) {
  const { payoffs, costs, energyCap, recharge, phaseLength } = game;
  return hash({ payoffs, costs, energyCap, recharge, phaseLength });
}
export function routingContext(game, state, player) {
  const counts = state.counts[1 - player],
    total = counts.reduce((a, b) => a + b, 0);
  const dominant = counts.indexOf(Math.max(...counts));
  const style =
    total < 4
      ? "unknown"
      : counts[dominant] / total >= 0.55
        ? `action-${dominant}`
        : "mixed";
  return `${Math.floor(state.round / game.phaseLength) % 2}:${style}`;
}
export function selectStrategy(strategy, game, state, player) {
  const fallback = flatStrategy(strategy),
    portfolio = strategy.portfolio;
  if (!portfolio)
    return { strategy: fallback, index: 0, reason: "Single policy" };
  const key = routingRule(game),
    context = routingContext(game, state, player);
  const rule = portfolio.rules.find((r) => r.key === key);
  if (!rule)
    return {
      strategy: fallback,
      index: 0,
      context,
      reason: "Unseen rules: baseline fallback",
    };
  const contextual = rule.contexts[context];
  const rows = contextual?.every((r) => r.matches >= 6)
    ? contextual
    : rule.overall;
  let index = 0;
  const means = rows.map((r) => (r.points + 2) / (r.matches + 2));
  for (let i = 1; i < rows.length; i++)
    if (rule.allowed.includes(i) && means[i] > means[index] + 0.1) index = i;
  return {
    strategy: index === 0 ? fallback : portfolio.experts[index - 1],
    index,
    context,
    reason:
      rows === contextual
        ? "Learned from observed opponent history"
        : "Learned game-specific results; sparse-history fallback",
    trainingMean: means[index],
    trainingMatches: rows[index].matches,
  };
}
