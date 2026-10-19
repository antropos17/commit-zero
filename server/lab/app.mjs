import { ExperimentStore } from "./store.mjs";
import { LocalModel } from "./model.mjs";
import { runExperiment } from "./runner.mjs";
import { runArena } from "./arena-runner.mjs";
import { httpError } from "../../services/base.mjs";
import { revisionTag, versionFromTag } from "../../shared/revisions.mjs";
export async function registerExperiments(
  app,
  db,
  { model = new LocalModel() } = {},
) {
  const store = new ExperimentStore(db);
  await store.recover();
  let active = null;
  app.decorate("labBusy", () => Boolean(active));
  const params = {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  };
  app.get("/api/lab", async () => ({
    provider: await model.ready(),
    runs: await store.list(),
    boundary:
      "Agent-defined expression language on a bounded host interpreter. Real local inference; no generated native or JavaScript code is executed.",
  }));
  app.get(
    "/api/lab/runs/:id",
    { schema: { params } },
    async (request, reply) => {
      const id = request.params.id;
      const known = versionFromTag(request.headers["if-none-match"], "lab", id);
      const state = await store.read(id, false, known);
      reply.header("etag", revisionTag("lab", id, state?.version ?? known));
      return state === null ? reply.code(304).send() : state;
    },
  );
  app.get("/api/lab/runs/:id/export", { schema: { params } }, async (request) =>
    store.read(request.params.id, true),
  );
  app.get(
    "/api/lab/runs/:id/artifacts/:name",
    {
      schema: {
        params: {
          ...params,
          required: ["id", "name"],
          properties: {
            ...params.properties,
            name: { type: "string", pattern: "^[a-z0-9-]+[.]json$" },
          },
        },
      },
    },
    async (request) => store.artifact(request.params.id, request.params.name),
  );
  app.post(
    "/api/lab/runs",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            mode: { type: "string", enum: ["heap", "arena"] },
            learningRounds: {
              type: "integer",
              minimum: 0,
              maximum: 3,
              default: 2,
            },
            sourceRunId: { type: "string", format: "uuid" },
            sourceVersion: { type: "integer", minimum: 0 },
          },
          dependencies: {
            sourceRunId: ["sourceVersion"],
            sourceVersion: ["sourceRunId"],
          },
        },
      },
    },
    async (request, reply) => {
      if (app.modelLease.owner)
        throw httpError(409, "A local model job is already running.");
      const lease = {};
      app.modelLease.owner = lease;
      try {
        if (!(await model.ready()).available)
          throw httpError(
            503,
            "The local model is not ready. No experiment was fabricated.",
          );
        const { sourceRunId, sourceVersion, learningRounds } = request.body;
        const source = sourceRunId ? await store.read(sourceRunId) : null;
        const mode = request.body.mode || source?.summary.mode || "heap";
        if (mode === "heap" && source?.summary.mode === "arena")
          throw httpError(
            409,
            "Arena policies cannot continue in the heap engine.",
          );
        if (
          source &&
          (source.status !== "completed" ||
            source.version !== sourceVersion ||
            source.provenance !== model.provenance)
        )
          throw httpError(
            409,
            "Choose a completed run with matching provenance and refresh its version.",
          );
        const run = await store.create(model.name, model.provenance, {
          mode,
          learningRounds,
          sourceRunId: source?.id || null,
        });
        const controller = new AbortController();
        const promise = (mode === "arena" ? runArena : runExperiment)(
          store,
          model,
          run.id,
          controller.signal,
          {
            source,
            learningRounds,
          },
        ).catch(() => {});
        active = { id: run.id, controller, promise };
        promise.finally(() => {
          if (active?.id === run.id) active = null;
          if (app.modelLease.owner === lease) app.modelLease.owner = null;
        });
        return reply.code(202).send(run);
      } catch (error) {
        if (app.modelLease.owner === lease) app.modelLease.owner = null;
        throw error;
      }
    },
  );
  app.post(
    "/api/lab/runs/:id/cancel",
    {
      schema: {
        params,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["version"],
          properties: { version: { type: "integer", minimum: 0 } },
        },
      },
    },
    async (request) => {
      const run = await store.read(request.params.id);
      if (run.status !== "running") return run;
      if (active?.id !== run.id)
        throw httpError(
          409,
          "This run is no longer owned by the active worker.",
        );
      await store.event(
        run.id,
        "operator",
        "cancelled",
        "Stop requested; pending inference is being cancelled.",
        {},
        { expected: request.body.version, status: "cancelled" },
      );
      if (active?.id === run.id) active.controller.abort();
      return store.read(run.id);
    },
  );
  app.addHook("preClose", async () => {
    if (active) {
      active.controller.abort();
      await active.promise;
    }
  });
}
