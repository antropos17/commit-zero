import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const response = await fetch("http://127.0.0.1:4173/api/export");
if (!response.ok) throw new Error("Start the application before exporting.");
const body = await response.text();
const parsed = JSON.parse(body);
if (parsed.format !== 1 || !parsed.state?.runId)
  throw new Error("Unexpected export format.");
await mkdir("runtime/backups", { recursive: true });
const path = `runtime/backups/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
await writeFile(path, body, { flag: "wx" });
await writeFile(
  path + ".sha256",
  createHash("sha256").update(body).digest("hex") + "\n",
  { flag: "wx" },
);
console.log(
  `Saved verified JSON export: ${path}. Exports are retained, never automatically deleted.`,
);
