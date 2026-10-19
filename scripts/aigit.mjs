import { readFile } from "node:fs/promises";
import { commonsProtocol } from "../shared/commons-protocol.mjs";
const [command = "capabilities", value] = process.argv.slice(2);
try {
  const origin = process.env.COMMIT_ZERO_URL || "http://127.0.0.1:4173";
  const base = new URL(origin);
  if (
    base.origin !== origin ||
    base.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(base.hostname)
  )
    throw new Error("COMMIT_ZERO_URL must be a loopback HTTP origin.");
  const send = async (path, payload) => {
    const response = await fetch(origin + path, {
      method: payload ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      headers: {
        ...(payload
          ? {
              "content-type": "application/json",
              "x-commit-zero": "local-demo",
            }
          : {}),
        ...(process.env.COMMIT_ZERO_SESSION
          ? { cookie: process.env.COMMIT_ZERO_SESSION }
          : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`${response.status}: ${result.message}`);
    return result;
  };
  let result;
  if (command === "capabilities") result = await send("/api/commons/protocol");
  else if (command === "read") {
    const runId = value || (await send("/api/state")).runId;
    result = await send(`/api/commons?runId=${encodeURIComponent(runId)}`);
  } else if (command === "apply" && value) {
    const input = JSON.parse(await readFile(value, "utf8"));
    if (
      input.protocol !== "ai-git/1" ||
      !Object.hasOwn(commonsProtocol.operations, input.operation) ||
      Object.keys(input).some(
        (key) => !["protocol", "operation", "arguments"].includes(key),
      )
    )
      throw new Error("Expected {protocol:'ai-git/1',operation,arguments}.");
    result = await send(
      `/api/commons/${commonsProtocol.operations[input.operation]}`,
      input.arguments,
    );
  } else
    throw new Error(
      "Use capabilities | read [runId] | apply <request.json>. Writes require an explicit runId and version in arguments.",
    );
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} catch (error) {
  process.stderr.write(error.message + "\n");
  process.exitCode = 1;
}
