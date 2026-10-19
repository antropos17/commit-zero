import { createBase, httpError } from "../base.mjs";
import { rankContributions } from "./model.mjs";
export async function createRankingApp({
  workspaceUrl,
  loadContributions,
} = {}) {
  const app = await createBase();
  let pending;
  async function load() {
    if (pending) return pending;
    pending = (async () => {
      const state = loadContributions
        ? await loadContributions()
        : await fetch(`${workspaceUrl}/api/contributions`, {
            signal: AbortSignal.timeout(5000),
          }).then((r) => {
            if (!r.ok) throw httpError(503, "Workspace is unavailable.");
            return r.json();
          });
      return state;
    })();
    try {
      return await pending;
    } finally {
      pending = null;
    }
  }
  app.get("/api/health", async () => ({ status: "ok", service: "ranking" }));
  app.get(
    "/api/rankings",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["overall", "code", "collaboration"],
            },
          },
        },
      },
    },
    async (request) =>
      rankContributions(await load(), request.query.category || "overall"),
  );
  return app;
}
