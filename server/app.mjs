import { createBase } from "../services/base.mjs";
import { english } from "../shared/english.mjs";
import fastifyStatic from "@fastify/static";
import { resolve } from "node:path";
import { connectDatabase } from "./database.mjs";
import { WorkspaceStore } from "./store.mjs";
import { contributions } from "./domain/contributions.mjs";
import { timeline, timelineQuery } from "./domain/timeline.mjs";
import { registerAgentProtocol } from "./agent-protocol.mjs";
import { registerExperiments } from "./lab/app.mjs";
import { registerCommons } from "./commons/app.mjs";

export async function createApp({
  db,
  staticRoot,
  logger = false,
  lab,
  commons,
} = {}) {
  db ||= await connectDatabase();
  const app = await createBase({ logger });
  const store = new WorkspaceStore(db);
  app.decorate("modelLease", { owner: null });
  await store.initialize();
  await registerExperiments(app, db, lab);
  await registerCommons(app, db, store, commons);
  app.addHook("onClose", () => db.close());
  const state = async () => ({
    ...english(await store.read()),
    databaseMode: db.mode,
  });
  app.get("/api/health", async () => {
    await db.query("SELECT 1");
    return {
      status: "ok",
      database: db.mode,
      mode: "simulation",
      schema: 5,
      commons: "local-model-proposals",
      experiments: "local-model",
    };
  });
  app.get("/api/state", state);
  app.get(
    "/api/timeline",
    { schema: { querystring: timelineQuery } },
    async (request) =>
      timeline(english(await store.read(request.query.runId)), request.query),
  );
  registerAgentProtocol(app, state);
  app.get("/api/contributions", async () => contributions(await store.read()));
  app.get("/api/export", async (_request, reply) => {
    reply.header(
      "Content-Disposition",
      'attachment; filename="commit-zero.json"',
    );
    return {
      format: 1,
      exportedAt: new Date().toISOString(),
      state: await state(),
    };
  });
  app.get(
    "/api/runs/:id/export",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      reply.header(
        "Content-Disposition",
        `attachment; filename="commit-zero-${request.params.id}.json"`,
      );
      return {
        format: 1,
        exportedAt: new Date().toISOString(),
        state: english(await store.read(request.params.id)),
      };
    },
  );
  const schema = {
    body: {
      type: "object",
      additionalProperties: false,
      required: ["runId", "version"],
      properties: {
        runId: { type: "string", format: "uuid" },
        version: { type: "integer", minimum: 0 },
      },
    },
  };
  app.post("/api/advance", { schema }, async (request) => ({
    ...english(await store.change(request.body)),
    databaseMode: db.mode,
  }));
  app.post("/api/runs", { schema }, async (request) => ({
    ...english(await store.change(request.body, true)),
    databaseMode: db.mode,
  }));
  if (staticRoot)
    await app.register(fastifyStatic, {
      root: resolve(staticRoot),
      index: "index.html",
      dotfiles: "deny",
    });
  return app;
}
