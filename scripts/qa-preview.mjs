import { startServices } from "./services.mjs";
const cluster = await startServices({
  memory: true,
  ports: { workspace: 0, identity: 0, ranking: 0, gateway: 0 },
  staticRoot: "dist",
});
// A different hostname keeps disposable QA cookies separate from the normal 127.0.0.1 preview.
console.log(
  "Disposable QA preview: " + cluster.url.replace("127.0.0.1", "localhost"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await cluster.close();
    process.exit(0);
  });
