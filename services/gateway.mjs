import { resolve } from "node:path";
import fastifyStatic from "@fastify/static";
import { createBase } from "./base.mjs";

export async function createGateway({
  services,
  staticRoot,
  transport = fetch,
} = {}) {
  const app = await createBase();
  app.get("/api/health", async (_request, reply) => {
    const states = await Promise.all(
      Object.entries(services).map(async ([name, url]) => {
        try {
          const response = await transport(url + "/api/health", {
            signal: AbortSignal.timeout(3000),
          });
          if (!response.ok) throw new Error("Service unavailable");
          return [name, await response.json()];
        } catch {
          return [name, { status: "unavailable" }];
        }
      }),
    );
    const health = Object.fromEntries(states);
    const ok = states.every(([, s]) => s.status === "ok");
    return reply.code(ok ? 200 : 503).send({
      status: ok ? "ok" : "degraded",
      mode: "simulation",
      database: health.workspace.database,
      services: health,
    });
  });
  app.route({
    method: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    url: "/api/*",
    async handler(request, reply) {
      const target = /^\/api\/(auth\/|account(?:\/|$))/.test(
        request.url.split("?")[0],
      )
        ? "identity"
        : request.url.startsWith("/api/rankings")
          ? "ranking"
          : "workspace";
      try {
        const response = await transport(services[target] + request.url, {
          method: request.method,
          headers: {
            "x-commit-zero": "local-demo",
            ...(request.method === "GET" && request.headers["if-none-match"]
              ? { "if-none-match": request.headers["if-none-match"] }
              : {}),
            "x-cz-browser-origin":
              request.headers.origin || `http://${request.headers.host}`,
            ...(request.headers.cookie
              ? { cookie: request.headers.cookie }
              : {}),
            ...(request.body ? { "content-type": "application/json" } : {}),
          },
          body: request.body ? JSON.stringify(request.body) : undefined,
          signal: AbortSignal.timeout(
            /^\/api\/auth\/oauth\/(github|google)\/callback(?:\?|$)/.test(
              request.url,
            )
              ? 25000
              : 10000,
          ),
          redirect: "manual",
        });
        for (const key of [
          "content-type",
          "location",
          "referrer-policy",
          "content-disposition",
          "etag",
        ]) {
          const value = response.headers.get(key);
          if (value) reply.header(key, value);
        }
        const cookies = response.headers.getSetCookie();
        if (cookies.length) reply.header("set-cookie", cookies);
        return reply.code(response.status).send(await response.text());
      } catch {
        return reply.code(503).send({
          message: `${target[0].toUpperCase() + target.slice(1)} service is unavailable. Try again shortly.`,
        });
      }
    },
  });
  if (staticRoot)
    await app.register(fastifyStatic, {
      root: resolve(staticRoot),
      index: "index.html",
      dotfiles: "deny",
    });
  return app;
}
