import { randomUUID } from "node:crypto";
import { httpError } from "../../services/base.mjs";
import { LocalModel } from "../lab/model.mjs";
import {
  CommonsStore,
  activeJob,
  capacity,
  contentHash,
  project,
  record,
} from "./store.mjs";
import { collaborate } from "./runner.mjs";
import { revisionTag, versionFromTag } from "../../shared/revisions.mjs";
import { registerProjects, writableProject, issueIn } from "./projects.mjs";
import { resolveOwnedAgent, qualifyAgent } from "./owned-agent.mjs";
import { commonsProtocol } from "../../shared/commons-protocol.mjs";

export async function registerCommons(
  app,
  db,
  workspace,
  { model = new LocalModel(), resolveAgent = resolveOwnedAgent } = {},
) {
  const store = new CommonsStore(db, workspace);
  await store.recover();
  registerProjects(app, store);
  app.get("/api/commons/protocol", async () => commonsProtocol);
  let active = null;
  app.decorate("commonsBusy", () => Boolean(active));
  const runId = { type: "string", format: "uuid" };
  const revision = { type: "integer", minimum: 0 };
  const text = (maxLength) => ({ type: "string", minLength: 1, maxLength });
  const body = (properties, optional = {}) => ({
    body: {
      type: "object",
      additionalProperties: false,
      required: ["runId", "version", ...Object.keys(properties)],
      properties: { runId, version: revision, ...properties, ...optional },
    },
  });
  app.get(
    "/api/commons",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["runId"],
          properties: { runId },
        },
      },
    },
    async (request, reply) => {
      const id = request.query.runId;
      const known = versionFromTag(
        request.headers["if-none-match"],
        "commons",
        id,
      );
      const state = await store.read(id, known);
      reply.header("etag", revisionTag("commons", id, state?.version ?? known));
      return state === null ? reply.code(304).send() : state;
    },
  );
  app.get("/api/commons/provider", async () => ({
    ...(await model.ready()),
    busy: Boolean(active),
  }));
  app.get(
    "/api/commons/events",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["runId"],
          properties: {
            runId,
            after: {
              type: "integer",
              minimum: 0,
              maximum: 2147483647,
              default: 0,
            },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
          },
        },
      },
    },
    async (request) =>
      store.events(
        request.query.runId,
        request.query.after,
        request.query.limit,
      ),
  );
  app.post(
    "/api/commons/messages",
    {
      schema: body({
        repoId: { type: "string", maxLength: 100 },
        message: text(2000),
      }),
    },
    async (request) => {
      const { runId, version, repoId, message } = request.body;
      if (!message.trim()) throw httpError(400, "Write a message first.");
      return store.change(runId, version, (s) => {
        capacity(s);
        if (repoId) project(s, repoId);
        record(s, "message", "operator", repoId, message.trim());
      });
    },
  );
  app.post(
    "/api/commons/jobs",
    {
      schema: body(
        { repoId: text(100), task: text(1000) },
        {
          sourceMessageId: runId,
          issueId: runId,
          sourcePrId: runId,
          agentId: runId,
          agentVersion: { type: "integer", minimum: 1 },
        },
      ),
    },
    async (request, reply) => {
      if (app.modelLease.owner)
        throw httpError(
          409,
          "Another local model job is running. Wait or stop it first.",
        );
      const reservation = {
        controller: new AbortController(),
        promise: Promise.resolve(),
      };
      active = reservation;
      app.modelLease.owner = reservation;
      try {
        if (
          Boolean(request.body.agentId) !== Boolean(request.body.agentVersion)
        )
          throw httpError(
            400,
            "Agent ID and configuration version must be supplied together.",
          );
        const agent = request.body.agentId
          ? qualifyAgent(
              await resolveAgent(request, request.body.agentId),
              request.body,
              model,
            )
          : null;
        const ready = await model.ready();
        if (!ready.available) throw httpError(503, ready.reason);
        const {
          runId,
          version,
          repoId,
          task,
          sourceMessageId,
          issueId,
          sourcePrId,
        } = request.body;
        if (!task.trim())
          throw httpError(400, "Describe the improvement to investigate.");
        const id = randomUUID();
        const state = await store.change(runId, version, (s) => {
          capacity(s);
          const repo = writableProject(s, repoId);
          if (issueId && issueIn(repo, issueId).status !== "open")
            throw httpError(409, "Reopen the issue before starting a task.");
          if (
            sourcePrId &&
            !repo.prs.some(
              (pr) => pr.id === sourcePrId && pr.status !== "merged",
            )
          )
            throw httpError(
              404,
              "Choose an unmerged pull request in this project.",
            );
          if (
            sourceMessageId &&
            !s.events.some(
              (event) =>
                event.id === sourceMessageId &&
                event.type === "message" &&
                (!event.repoId || event.repoId === repoId),
            )
          )
            throw httpError(
              404,
              "Source message is unavailable in this project or General.",
            );
          s.jobs.push({
            id,
            repoId,
            task: task.trim(),
            ...(sourceMessageId ? { sourceMessageId } : {}),
            ...(issueId ? { issueId } : {}),
            ...(sourcePrId ? { sourcePrId } : {}),
            ...(agent ? { agent } : {}),
            status: "running",
            model: model.name,
            provenance: model.provenance,
            startedAt: new Date().toISOString(),
          });
          record(s, "started", "operator", repoId, task.trim(), {
            jobId: id,
            ...(sourceMessageId ? { sourceMessageId } : {}),
            ...(issueId ? { issueId } : {}),
            ...(sourcePrId ? { sourcePrId } : {}),
          });
        });
        reservation.promise = collaborate(
          store,
          model,
          runId,
          id,
          AbortSignal.any([
            reservation.controller.signal,
            AbortSignal.timeout((agent?.maxMinutes || 8) * 60000),
          ]),
        )
          .catch(async (error) => {
            await store.change(runId, null, (s) => {
              const job = s.jobs.find((j) => j.id === id);
              if (job.status !== "running") return;
              job.status = "failed";
              record(
                s,
                "failed",
                "system",
                repoId,
                error.message.slice(0, 2000),
                { jobId: id },
              );
            });
          })
          .finally(() => {
            if (active === reservation) active = null;
            if (app.modelLease.owner === reservation)
              app.modelLease.owner = null;
          });
        return reply.code(202).send(state);
      } catch (error) {
        if (active === reservation) active = null;
        if (app.modelLease.owner === reservation) app.modelLease.owner = null;
        throw error;
      }
    },
  );
  app.post(
    "/api/commons/stop",
    { schema: body({ jobId: runId }) },
    async (request) => {
      const { runId, version, jobId } = request.body;
      const state = await store.change(runId, version, (s) => {
        const job = activeJob(s, jobId);
        job.status = "cancelled";
        record(
          s,
          "stopped",
          "operator",
          job.repoId,
          "Stopped by the local operator. Completed actions are retained.",
          { jobId },
        );
      });
      active?.controller.abort();
      return state;
    },
  );
  app.post(
    "/api/commons/merge",
    { schema: body({ repoId: text(100), prId: runId }) },
    async (request) => {
      const { runId, version, repoId, prId } = request.body;
      return store.change(runId, version, (s) => {
        capacity(s);
        const p = writableProject(s, repoId),
          pr = p.prs.find((item) => item.id === prId);
        if (!pr) throw httpError(404, "Pull request not found.");
        if (
          pr.status !== "approved" ||
          !pr.check.passed ||
          !pr.review?.approve ||
          pr.review.actor !== "reviewer" ||
          pr.review.codeHash !== pr.hash ||
          pr.check.codeHash !== contentHash(pr.after) ||
          pr.baseRevision !== p.revision ||
          (p.files[pr.path] ?? null) !== pr.before
        )
          throw httpError(
            409,
            "Merge requires an approved, syntax-checked patch against the current project revision.",
          );
        p.files[pr.path] = pr.after;
        p.revision++;
        pr.status = "merged";
        const job = s.jobs.find((item) => item.id === pr.jobId);
        if (job?.issueId) {
          const issue = issueIn(p, job.issueId);
          if (issue.status !== "closed") {
            issue.status = "closed";
            record(
              s,
              "issue-state",
              "system",
              p.id,
              `Closed issue #${issue.number} after merge.`,
              { issueId: issue.id, prId, jobId: job.id },
            );
          }
        }
        record(
          s,
          "merge",
          "operator",
          p.id,
          `Merged ${pr.title} into the collaboration copy. Runtime behavior remains unverified.`,
          { prId, jobId: pr.jobId },
        );
      });
    },
  );
  app.addHook("preClose", async () => {
    active?.controller.abort();
    await active?.promise;
  });
}
