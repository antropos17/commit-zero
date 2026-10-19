import { spawn } from "node:child_process";
import { readdir, mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve("runtime/local-model"),
  folder = join(root, "llama-b11719");
async function find(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue;
    const p = join(dir, e.name);
    if (e.isFile() && e.name === "llama-server.exe") return p;
    if (e.isDirectory()) {
      const value = await find(p);
      if (value) return value;
    }
  }
}
try {
  const executable = await find(folder),
    model = join(root, "qwen2.5-coder-7b-instruct-q4_k_m.gguf");
  if (!executable || (await stat(model)).size !== 4683073536)
    throw new Error("Run npm run model:setup first.");
  // Verify the exact weight bytes before the provider becomes available.
  const expected = JSON.parse(
    (await readFile(join(root, "provenance.json"), "utf8")).replace(
      /^\uFEFF/,
      "",
    ),
  );
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(model)) digest.update(chunk);
  if (
    digest.digest("hex") !== expected.find((f) => f.name.endsWith(".gguf")).sha
  )
    throw new Error("Model hash mismatch.");
  await mkdir(resolve("runtime/diagnostics"), { recursive: true });
  const tokenPath = join(root, "server-token");
  try {
    await writeFile(tokenPath, randomBytes(32).toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const log = resolve("runtime/diagnostics/qa-local-model.txt");
  let tail = "",
    dirty = false,
    writing = Promise.resolve();
  const save = () => {
    if (dirty) {
      dirty = false;
      const snapshot = tail;
      writing = writing.then(() => writeFile(log, snapshot)).catch(() => {});
    }
  };
  const timer = setInterval(save, 2000);
  timer.unref();
  const child = spawn(
    executable,
    [
      "-m",
      model,
      "--alias",
      "cz-local-coder",
      "--host",
      "127.0.0.1",
      "--port",
      "8199",
      "-ngl",
      "99",
      "-c",
      "4096",
      "-np",
      "1",
      "-b",
      "256",
      "-ub",
      "128",
      "--no-webui",
      "--api-key-file",
      tokenPath,
      "--cors-origins",
      "http://127.0.0.1:4173",
    ],
    {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        TEMP: resolve(".cache/tmp"),
        TMP: resolve(".cache/tmp"),
      },
    },
  );
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (chunk) => {
      tail = (tail + chunk.toString()).slice(-65536);
      dirty = true;
    });
  child.on("error", (e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
  child.on("exit", async (code) => {
    clearInterval(timer);
    save();
    await writing;
    console.log(`Local model stopped (${code}). Diagnostic tail: ${log}`);
    process.exitCode = code || 0;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => child.kill());
  console.log(
    "Starting verified Qwen2.5-Coder 7B Q4_K_M on loopback port 8199. Diagnostic log capped at 64 KiB.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
