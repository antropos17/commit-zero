import { createServer } from "vite";
import { startServices } from "./services.mjs";
import config from "../vite.config.mjs";
let web;
const cluster = await startServices({
  onFailure: (error) => {
    console.error(error.message);
    void web?.close();
    process.exitCode = 1;
  },
});
try {
  web = await createServer({ ...config, configFile: false });
  await web.listen();
  console.log(
    "Commit Zero: http://127.0.0.1:4173/ | workspace 4185 | identity 4186 | ranking 4187 | gateway 4174",
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      await web.close();
      await cluster.close();
      process.exit(0);
    });
} catch (error) {
  await cluster.close();
  throw error;
}
