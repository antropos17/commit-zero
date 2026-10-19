import { fork } from "node:child_process";
import { once } from "node:events";
export async function startServices({
  memory = false,
  ports = {},
  staticRoot,
  onFailure = () => {},
} = {}) {
  const children = [];
  const services = {};
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await Promise.all(
      children.map(async (child) => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        const exited = once(child, "exit").catch(() => {});
        if (child.connected) child.send({ type: "shutdown" });
        else child.kill("SIGTERM");
        const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
        await exited;
        clearTimeout(timer);
      }),
    );
  };
  try {
    for (const name of ["identity", "workspace", "ranking", "gateway"]) {
      const defaults = {
        workspace: Number(process.env.WORKSPACE_PORT || 4185),
        identity: Number(process.env.IDENTITY_PORT || 4186),
        ranking: Number(process.env.RANKING_PORT || 4187),
        gateway: Number(process.env.API_PORT || 4174),
      };
      const child = fork("services/start.mjs", [name], {
        stdio: ["ignore", "inherit", "inherit", "ipc"],
        env: {
          ...process.env,
          ...(memory
            ? {
                DATABASE_MEMORY: "1",
                DATABASE_URL: "",
                IDENTITY_DATABASE_URL: "",
              }
            : {}),
          SERVICE_PORT: String(ports[name] ?? defaults[name]),
          WORKSPACE_URL: services.workspace || "",
          IDENTITY_URL: services.identity || "",
          SERVICE_URLS: JSON.stringify(services),
          STATIC_ROOT: name === "gateway" ? staticRoot || "" : "",
        },
      });
      children.push(child);
      const ready = await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`${name} startup timed out`)),
          30000,
        );
        child.once("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        child.once("exit", (code) => {
          clearTimeout(timeout);
          reject(new Error(`${name} stopped (${code})`));
        });
        child.once("message", (message) => {
          clearTimeout(timeout);
          resolve(message);
        });
      });
      services[name] = `http://127.0.0.1:${ready.port}`;
      child.on("exit", (code) => {
        if (!closing) {
          void close();
          onFailure(new Error(`${name} exited (${code})`));
        }
      });
    }
    return { services, url: services.gateway, close };
  } catch (error) {
    await close();
    throw error;
  }
}
