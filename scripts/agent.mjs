import { randomUUID } from "node:crypto";
const [command = "capabilities", value] = process.argv.slice(2);
const base = new URL(process.env.COMMIT_ZERO_URL || "http://127.0.0.1:4173");
if (
  base.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(base.hostname) ||
  base.username ||
  base.password
)
  throw new Error("COMMIT_ZERO_URL must identify a local HTTP server.");
const get = async (path, body) => {
  const response = await fetch(new URL(path, base), {
    method: body ? "POST" : "GET",
    redirect: "error",
    signal: AbortSignal.timeout(12000),
    headers: body
      ? { "Content-Type": "application/json", "X-Commit-Zero": "local-demo" }
      : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${result.message}`);
  return result;
};
try {
  let result;
  if (command === "capabilities") result = await get("/api/agent/v1");
  else {
    const operations = {
      timeline: "timeline.read",
      repository: "repository.read",
      change: "change.read",
    };
    if (!operations[command])
      throw new Error(
        "Use: capabilities | timeline [actor] | repository <id> | change <number>",
      );
    const state = await get("/api/state");
    result = await get("/api/agent/v1/query", {
      protocol: "cz-agent/1",
      requestId: randomUUID(),
      runId: state.runId,
      revision: state.version,
      operation: operations[command],
      arguments:
        command === "timeline"
          ? value
            ? { actor: value }
            : {}
          : command === "repository"
            ? { repository: value }
            : { number: Number(value) },
    });
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} catch (error) {
  process.stderr.write(error.message + "\n");
  process.exitCode = 1;
}
