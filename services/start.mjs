import { createApp } from "../server/app.mjs";
import { createIdentityApp } from "./identity/app.mjs";
import { createRankingApp } from "./ranking/app.mjs";
import { createGateway } from "./gateway.mjs";
const name = process.argv[2];
const factories = {
  workspace: () => createApp(),
  identity: () => createIdentityApp(),
  ranking: () => createRankingApp({ workspaceUrl: process.env.WORKSPACE_URL }),
  gateway: () =>
    createGateway({
      services: JSON.parse(process.env.SERVICE_URLS),
      staticRoot: process.env.STATIC_ROOT || undefined,
    }),
};
let app,
  initialized = false,
  closing = false,
  stopping = false;
async function close() {
  closing = true;
  if (!initialized || stopping) return;
  stopping = true;
  await app.close();
  process.exit(0);
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => void close());
process.once("disconnect", () => void close());
process.on("message", (message) => {
  if (message?.type === "shutdown") void close();
});
try {
  app = await factories[name]();
  initialized = true;
  if (closing) await close();
  else {
    await app.listen({
      host: "127.0.0.1",
      port: Number(process.env.SERVICE_PORT),
    });
    process.send?.({ ready: true, name, port: app.server.address().port });
  }
} catch (error) {
  await app?.close();
  console.error(name + ": " + error.message);
  process.exit(1);
}
