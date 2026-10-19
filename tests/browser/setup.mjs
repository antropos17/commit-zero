import { startServices } from "../../scripts/services.mjs";

// Keep the supervisor in Playwright's runner so teardown can await every child.
// The services use disposable in-memory stores and fixed loopback test ports.
export default async function setup() {
  const cluster = await startServices({
    memory: true,
    staticRoot: "dist",
    ports: { gateway: 4190, workspace: 4191, identity: 4192, ranking: 4193 },
  });
  return async () => {
    await cluster.close();
  };
}
