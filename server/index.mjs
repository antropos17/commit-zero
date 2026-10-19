import { startServices } from "../scripts/services.mjs";
const cluster = await startServices({
  staticRoot: "dist",
  ports: { gateway: Number(process.env.PORT || 4173) },
  onFailure: (error) => {
    console.error(error.message);
    process.exitCode = 1;
  },
});
console.log("Commit Zero: " + cluster.url + " (loopback only)");
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await cluster.close();
    process.exit(0);
  });
