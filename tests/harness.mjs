import { createApp } from "../server/app.mjs";
import { connectDatabase } from "../server/database.mjs";
import {
  createIdentityApp,
  identityDatabase,
} from "../services/identity/app.mjs";
import { createRankingApp } from "../services/ranking/app.mjs";
import { createGateway } from "../services/gateway.mjs";

export async function createTestSystem({
  staticRoot,
  oauth,
  lab,
  commons,
} = {}) {
  const workspace = await createApp({
    db: await connectDatabase({ memory: true, url: null }),
    lab,
    commons,
  });
  const identity = await createIdentityApp({
    db: await identityDatabase({ memory: true, url: null }),
    oauth,
  });
  const ranking = await createRankingApp({
    loadContributions: async () =>
      (
        await workspace.inject({
          url: "/api/contributions",
          headers: { host: "localhost" },
        })
      ).json(),
  });
  const apps = { workspace, identity, ranking };
  const gateway = await createGateway({
    services: Object.fromEntries(
      Object.keys(apps).map((name) => [name, `http://${name}`]),
    ),
    staticRoot,
    transport: async (url, options = {}) => {
      const parsed = new URL(url);
      const result = await apps[parsed.hostname].inject({
        url: parsed.pathname + parsed.search,
        method: options.method || "GET",
        payload: options.body,
        headers: { host: "localhost", ...options.headers },
      });
      const headers = new Headers();
      for (const [key, value] of Object.entries(result.headers))
        for (const item of Array.isArray(value) ? value : [value])
          headers.append(key, String(item));
      return new Response(result.body || null, {
        status: result.statusCode,
        headers,
      });
    },
  });
  return {
    gateway,
    workspace,
    identity,
    ranking,
    async close() {
      await gateway.close();
      await Promise.all(Object.values(apps).map((app) => app.close()));
    },
  };
}
