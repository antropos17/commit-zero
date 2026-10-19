import { randomUUID } from "node:crypto";
import { httpError } from "../base.mjs";

// Configuration is persisted; no provider or command runner is connected here.
const execution = Object.freeze({
  available: false,
  proposals: {
    available: true,
    provider: "local",
    model: "cz-local-coder",
    route: "/api/commons/jobs",
    codeExecution: false,
  },
  blockers: [
    "Connect a model provider.",
    "Connect and qualify an isolated code runner.",
  ],
  policy: {
    version: 1,
    reviewRequired: true,
    directMerge: false,
    platformCredentialsInRunner: false,
    repositoryContentIsUntrusted: true,
  },
});
const text = (minLength, maxLength) => ({
  type: "string",
  minLength,
  maxLength,
  pattern: "\\S",
});
const fields = {
  name: text(2, 48),
  mission: text(10, 600),
  instructions: text(10, 3000),
  provider: {
    type: "string",
    enum: ["openai", "anthropic", "google", "local"],
  },
  model: text(1, 120),
  repository: {
    type: "string",
    maxLength: 160,
    pattern: "^([a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+)?$",
  },
  dailyBudgetCents: { type: "integer", minimum: 0, maximum: 10000 },
  maxMinutes: { type: "integer", minimum: 1, maximum: 60 },
  capabilities: {
    type: "array",
    uniqueItems: true,
    minItems: 1,
    maxItems: 4,
    items: { type: "string", enum: ["propose", "review", "discuss", "star"] },
  },
};
const bodySchema = (extra = {}) => ({
  type: "object",
  additionalProperties: false,
  properties: { ...fields, ...extra },
  required: [...Object.keys(fields), ...Object.keys(extra)],
});
const params = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string", pattern: "^[a-f0-9-]{36}$" } },
};
const publicAgent = (row) => ({
  id: row.id,
  name: row.name,
  mission: row.mission,
  instructions: row.instructions,
  provider: row.provider,
  model: row.model,
  repository: row.repository,
  dailyBudgetCents: row.daily_budget_cents,
  maxMinutes: row.max_minutes,
  capabilities: row.capabilities,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  status: "configuration_only",
});
const values = (data) => {
  for (const [field, minimum] of [
    ["name", 2],
    ["mission", 10],
    ["instructions", 10],
    ["model", 1],
  ]) {
    if (data[field].trim().length < minimum)
      throw httpError(400, `Please enter a longer ${field}.`);
  }
  return [
    data.name.trim(),
    data.mission.trim(),
    data.instructions.trim(),
    data.provider,
    data.model.trim(),
    data.repository,
    data.dailyBudgetCents,
    data.maxMinutes,
    JSON.stringify(data.capabilities),
  ];
};

export function registerAgentRoutes(app, db, requireUser) {
  app.get(
    "/api/account/agents/:id",
    { schema: { params } },
    async (request) => {
      const user = await requireUser(request);
      const found = await db.query(
        "SELECT * FROM agent_configurations WHERE id=$1 AND account_id=$2",
        [request.params.id, user.id],
      );
      if (!found.rows[0])
        throw httpError(404, "Agent configuration not found.");
      return { agent: publicAgent(found.rows[0]), execution };
    },
  );
  app.get("/api/account/agents", async (request) => {
    const user = await requireUser(request);
    const result = await db.query(
      "SELECT * FROM agent_configurations WHERE account_id=$1 ORDER BY created_at DESC, id",
      [user.id],
    );
    return { agents: result.rows.map(publicAgent), execution };
  });
  app.post(
    "/api/account/agents",
    { schema: { body: bodySchema() } },
    async (request, reply) => {
      const user = await requireUser(request);
      try {
        const agent = await db.transaction(async (tx) => {
          await tx.query("SELECT id FROM accounts WHERE id=$1 FOR UPDATE", [
            user.id,
          ]);
          const count = await tx.query(
            "SELECT count(*) AS total FROM agent_configurations WHERE account_id=$1",
            [user.id],
          );
          if (Number(count.rows[0].total) >= 12)
            throw httpError(
              409,
              "This account already has 12 agent configurations.",
            );
          const result = await tx.query(
            "INSERT INTO agent_configurations(id,account_id,name,mission,instructions,provider,model,repository,daily_budget_cents,max_minutes,capabilities) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
            [randomUUID(), user.id, ...values(request.body)],
          );
          return publicAgent(result.rows[0]);
        });
        return reply.code(201).send({ agent, execution });
      } catch (error) {
        if (error.code === "23505")
          throw httpError(409, "You already have an agent with this name.");
        throw error;
      }
    },
  );
  app.patch(
    "/api/account/agents/:id",
    {
      schema: {
        params,
        body: bodySchema({ version: { type: "integer", minimum: 1 } }),
      },
    },
    async (request) => {
      const user = await requireUser(request);
      try {
        return await db.transaction(async (tx) => {
          const found = await tx.query(
            "SELECT * FROM agent_configurations WHERE id=$1 AND account_id=$2 FOR UPDATE",
            [request.params.id, user.id],
          );
          if (!found.rows[0])
            throw httpError(404, "Agent configuration not found.");
          if (found.rows[0].version !== request.body.version)
            throw httpError(
              409,
              "This agent changed in another tab. Reload before saving.",
            );
          const result = await tx.query(
            "UPDATE agent_configurations SET name=$3,mission=$4,instructions=$5,provider=$6,model=$7,repository=$8,daily_budget_cents=$9,max_minutes=$10,capabilities=$11,version=version+1,updated_at=now() WHERE id=$1 AND account_id=$2 RETURNING *",
            [request.params.id, user.id, ...values(request.body)],
          );
          return { agent: publicAgent(result.rows[0]), execution };
        });
      } catch (error) {
        if (error.code === "23505")
          throw httpError(409, "You already have an agent with this name.");
        throw error;
      }
    },
  );
  app.post(
    "/api/account/agents/:id/launch",
    { schema: { params } },
    async (request, reply) => {
      const user = await requireUser(request);
      const result = await db.query(
        "SELECT id FROM agent_configurations WHERE id=$1 AND account_id=$2",
        [request.params.id, user.id],
      );
      if (!result.rows[0])
        throw httpError(404, "Agent configuration not found.");
      return reply.code(409).send({
        message:
          "Launch is unavailable. Your configuration is saved; no model or code has been executed.",
        execution,
      });
    },
  );
}
