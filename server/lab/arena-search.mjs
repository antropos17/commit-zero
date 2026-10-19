import {
  arenaFitness,
  behavior,
  distance,
  DIVERSITY_FLOOR,
  policyHash,
  validateArenaStrategy,
} from "./arena-engine.mjs";
import { resultType } from "./schema.mjs";

// Bounded program enumeration is an explicit host tool, not model-authored code.
export function searchArena(language, games, others, opponents) {
  const terminals = [
    "expected",
    "counter",
    "cost",
    "action",
    "pay0",
    "pay1",
    "pay2",
    "phase",
    -1,
    1,
    3,
  ];
  const signatures = others.map((s) => behavior(language, games, s)),
    candidates = [],
    seen = new Set();
  for (const fn of language.functions.filter(
    (f) => resultType(f.body) === "number",
  )) {
    for (const a of terminals)
      for (const b of terminals) {
        if (candidates.length >= 120) break;
        const score = [
          fn.name,
          ...Array.from({ length: fn.params.length }, (_, i) =>
            i === 0 ? a : b,
          ),
        ];
        const strategy = {
          name: "Tool candidate",
          explanation: "Enumerated by the bounded host search tool.",
          score,
          temperature: 1,
        };
        if (seen.has(policyHash(strategy))) continue;
        seen.add(policyHash(strategy));
        try {
          validateArenaStrategy(language, games, strategy);
          const signature = behavior(language, games, strategy);
          if (signatures.some((s) => distance(s, signature) < DIVERSITY_FLOOR))
            continue;
          if (candidates.some((c) => distance(c.signature, signature) < 0.04))
            continue;
          const fitness = arenaFitness(
            language,
            games,
            strategy,
            opponents,
            [11, 12],
          );
          candidates.push({
            strategy,
            signature,
            points: fitness.points,
            matches: fitness.matches,
          });
        } catch {
          /* Invalid generated programs are excluded by actual execution. */
        }
      }
  }
  return candidates
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map(({ strategy, points, matches }) => ({ strategy, points, matches }));
}
