import { setTimeout } from "node:timers/promises";
import { arenaRounds } from "./arena-engine.mjs";

// Execute one round at a time, committing it before the next interpreter step.
export async function broadcastMatch({
  language,
  game,
  strategies,
  seed,
  players,
  generation,
  trial = false,
  matchId,
  event,
  signal,
  delayMs = 650,
}) {
  signal.throwIfAborted();
  await event("arena", "match-start", `${game.name}: live match begins.`, {
    matchId,
    generation,
    players,
    gameRules: game,
    strategyNames: strategies.map((s) => s.name),
    seed,
    ...(trial ? { trial: true } : {}),
  });
  const iterator = arenaRounds(language, game, strategies, seed);
  let previousSelections = [];
  while (true) {
    signal.throwIfAborted();
    const next = iterator.next();
    if (next.done) return next.value;
    if (next.value.selections) {
      for (const [seat, selection] of next.value.selections.entries())
        if (selection.index !== previousSelections[seat])
          await event(
            `strategist-${players[seat] + 1}`,
            "selection",
            `Round ${next.value.round + 1}: ${selection.index ? `specialist ${selection.index}` : "baseline"} selected. ${selection.reason}.`,
            {
              matchId,
              generation,
              player: players[seat],
              round: next.value.round,
              selection,
              trial,
            },
          );
      previousSelections = next.value.selections.map((s) => s.index);
    }
    await event(
      "arena",
      "round",
      `Round ${next.value.round + 1}: both actions resolved.`,
      { matchId, generation, round: next.value },
    );
    if (delayMs) await setTimeout(delayMs, undefined, { signal });
  }
}
