import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dockerHealth } from "./sandbox-contract.mjs";

const run = promisify(execFile);
let cliFound = true;
let daemonVersion = "";
let osType = "";
try {
  const result = await run("docker", ["info", "--format", "{{.ServerVersion}}|{{.OSType}}"], {
    windowsHide: true,
    timeout: 3000,
    maxBuffer: 4096,
  });
  [daemonVersion, osType] = result.stdout.trim().split("|");
} catch (error) {
  cliFound = error.code !== "ENOENT";
}
console.log(JSON.stringify({ ...dockerHealth({ cliFound, daemonVersion, osType }),
  contract: "source-tested-only", containerExecuted: false, isolationVerified: false }, null, 2));
