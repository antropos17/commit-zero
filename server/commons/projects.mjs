import { randomUUID } from "node:crypto";
import { httpError } from "../../services/base.mjs";
import { capacity, contentHash, project, record } from "./store.mjs";
import { gitStream } from "./git-export.mjs";

export const filePath =
  /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:m?js|json|md|txt|css|html)$/;
export function writableProject(state, id) {
  const result = project(state, id);
  if (result.archived)
    throw httpError(
      409,
      "This project is archived. Restore it before making changes.",
    );
  return result;
}
export function issueIn(repo, id) {
  const issue = (repo.issues || []).find((item) => item.id === id);
  if (!issue) throw httpError(404, "Issue not found in this project.");
  return issue;
}
const text = (maxLength) => ({
  type: "string",
  minLength: 1,
  maxLength,
  pattern: "\\S",
});
const uuid = { type: "string", format: "uuid" };
const repoId = text(100);
const schema = (properties) => ({
  body: {
    type: "object",
    additionalProperties: false,
    required: ["runId", "version", ...Object.keys(properties)],
    properties: {
      runId: uuid,
      version: { type: "integer", minimum: 0 },
      ...properties,
    },
  },
});

export function registerProjects(app, store) {
  app.get(
    "/api/commons/projects/:id/git",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: repoId },
        },
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["runId"],
          properties: { runId: uuid },
        },
      },
    },
    async (request, reply) => {
      const state = await store.read(request.query.runId);
      reply
        .type("text/plain; charset=utf-8")
        .header("content-disposition", 'attachment; filename="project.fi"');
      return gitStream(project(state, request.params.id), state.events);
    },
  );
  const mutation = (route, fields, update) =>
    app.post(
      `/api/commons/${route}`,
      { schema: schema(fields) },
      async (request) =>
        store.change(request.body.runId, request.body.version, (state) => {
          capacity(state);
          update(state, request.body);
        }),
    );
  mutation(
    "projects",
    {
      id: { type: "string", pattern: "^[a-z][a-z0-9-]{1,47}$" },
      name: text(80),
      description: text(600),
      kind: { type: "string", enum: ["game", "library"] },
      sourceRepoId: { type: "string", maxLength: 100 },
    },
    (state, input) => {
      if (state.projects.length >= 40)
        throw httpError(
          409,
          "This workspace has reached its 40-project limit.",
        );
      if (state.projects.some((p) => p.id === input.id))
        throw httpError(409, "This project address already exists.");
      const source = input.sourceRepoId
        ? project(state, input.sourceRepoId)
        : null;
      const files = source
        ? structuredClone(source.files)
        : {
            "README.md": `# ${input.name.trim()}\n\n${input.description.trim()}\n`,
            "main.js":
              "// New project. Ask an agent to implement the first version.\nexport {};\n",
          };
      const created = {
        id: input.id,
        name: input.name.trim(),
        description: input.description.trim(),
        kind: input.kind,
        files,
        revision: 0,
        stars: [],
        forks: [],
        prs: [],
        issues: [],
        archived: false,
        createdAt: new Date().toISOString(),
        ...(source
          ? {
              origin: {
                repoId: source.id,
                revision: source.revision,
                hash: contentHash(source.files),
              },
            }
          : {}),
      };
      state.projects.push(created);
      record(
        state,
        source ? "project-fork" : "project-created",
        "operator",
        created.id,
        source
          ? `Forked ${source.name} at v${source.revision}.`
          : `Created ${created.name}.`,
        source ? { source: created.origin } : {},
      );
    },
  );
  mutation(
    "project-state",
    { repoId, archived: { type: "boolean" } },
    (state, input) => {
      const repo = project(state, input.repoId);
      if (
        state.jobs.some(
          (job) => job.repoId === repo.id && job.status === "running",
        )
      )
        throw httpError(
          409,
          "Stop the active task before archiving this project.",
        );
      if (Boolean(repo.archived) === input.archived)
        throw httpError(409, "Project already has that state.");
      repo.archived = input.archived;
      record(
        state,
        "project-state",
        "operator",
        repo.id,
        input.archived
          ? "Archived project; history retained."
          : "Restored project.",
      );
    },
  );
  mutation(
    "stars",
    { repoId, starred: { type: "boolean" } },
    (state, input) => {
      const repo = writableProject(state, input.repoId);
      const hasStar = repo.stars.includes("operator");
      if (hasStar === input.starred)
        throw httpError(409, "Star already has that state.");
      repo.stars = input.starred
        ? [...repo.stars, "operator"]
        : repo.stars.filter((actor) => actor !== "operator");
      record(
        state,
        input.starred ? "star" : "unstar",
        "operator",
        repo.id,
        input.starred ? "Starred this project." : "Removed star.",
      );
    },
  );
  mutation(
    "issues",
    { repoId, title: text(120), description: text(4000) },
    (state, input) => {
      const repo = writableProject(state, input.repoId);
      repo.issues ||= [];
      if (repo.issues.length >= 100)
        throw httpError(409, "This project has reached its 100-issue limit.");
      const issue = {
        id: randomUUID(),
        number: repo.issues.length + 1,
        title: input.title.trim(),
        description: input.description.trim(),
        status: "open",
        createdAt: new Date().toISOString(),
        actor: "operator",
      };
      repo.issues.push(issue);
      record(state, "issue-opened", "operator", repo.id, issue.title, {
        issueId: issue.id,
      });
    },
  );
  mutation(
    "issue-state",
    {
      repoId,
      issueId: uuid,
      status: { type: "string", enum: ["open", "closed"] },
    },
    (state, input) => {
      const repo = writableProject(state, input.repoId),
        issue = issueIn(repo, input.issueId);
      if (issue.status === input.status)
        throw httpError(409, "Issue already has that state.");
      issue.status = input.status;
      record(
        state,
        "issue-state",
        "operator",
        repo.id,
        `${input.status === "open" ? "Reopened" : "Closed"} issue #${issue.number}.`,
        { issueId: issue.id },
      );
    },
  );
  mutation(
    "comments",
    {
      repoId,
      targetId: uuid,
      targetType: { type: "string", enum: ["issue", "pull"] },
      message: text(2000),
    },
    (state, input) => {
      const repo = writableProject(state, input.repoId);
      if (input.targetType === "issue") issueIn(repo, input.targetId);
      else if (!repo.prs.some((pr) => pr.id === input.targetId))
        throw httpError(404, "Pull request not found.");
      record(
        state,
        "comment",
        "operator",
        repo.id,
        input.message.trim(),
        input.targetType === "issue"
          ? { issueId: input.targetId }
          : { prId: input.targetId },
      );
    },
  );
  mutation(
    "pull-state",
    {
      repoId,
      prId: uuid,
      status: { type: "string", enum: ["open", "closed"] },
    },
    (state, input) => {
      const repo = writableProject(state, input.repoId),
        pr = repo.prs.find((p) => p.id === input.prId);
      if (!pr) throw httpError(404, "Pull request not found.");
      if (
        state.jobs.some(
          (job) => job.id === pr.jobId && job.status === "running",
        )
      )
        throw httpError(409, "Wait for the reviewer or stop the task.");
      if (pr.status === "merged")
        throw httpError(
          409,
          "Merged pull requests cannot be reopened or closed.",
        );
      if ((pr.status === "closed") === (input.status === "closed"))
        throw httpError(409, "Pull request already has that state.");
      if (input.status === "closed") {
        pr.closedFrom = pr.status;
        pr.status = "closed";
      } else {
        pr.status = pr.closedFrom || "open";
        delete pr.closedFrom;
      }
      record(
        state,
        "pull-state",
        "operator",
        repo.id,
        `${input.status === "closed" ? "Closed" : "Reopened"} ${pr.title}.`,
        { prId: pr.id },
      );
    },
  );
  app.get(
    "/api/commons/projects/:id/export",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: repoId },
        },
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["runId"],
          properties: { runId: uuid },
        },
      },
    },
    async (request, reply) => {
      const state = await store.read(request.query.runId),
        repo = project(state, request.params.id);
      reply.header(
        "content-disposition",
        'attachment; filename="project.json"',
      );
      return {
        format: "commit-zero-project/1",
        runId: state.runId,
        workspaceRevision: state.version,
        project: repo,
        events: state.events.filter((event) => event.repoId === repo.id),
        sourceHash: contentHash(repo.files),
      };
    },
  );
}
