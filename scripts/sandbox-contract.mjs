import { isAbsolute, relative, resolve, sep } from "node:path";

const imageDigest = /^[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$/;

function childOf(root, candidate) {
  const path = resolve(candidate);
  if (/[\r\n,]/.test(path))
    throw new Error("Sandbox mount path contains a Docker option delimiter.");
  const part = relative(root, path);
  if (!part || part === ".." || part.startsWith(".." + sep) || isAbsolute(part))
    throw new Error("Sandbox mount must be a child of the staging root.");
  return path;
}

// An unexecuted Docker argument contract. Callers must separately verify real
// paths (including links), image provenance, daemon policy, and runtime denial.
export function planDockerSandbox({ stagingRoot, inputDirectory, outputDirectory, image }) {
  if (!imageDigest.test(image || ""))
    throw new Error("Use a pinned Linux image digest, not a mutable tag.");
  const root = resolve(stagingRoot);
  if (/[\r\n,]/.test(root))
    throw new Error("Staging root contains a Docker option delimiter.");
  const input = childOf(root, inputDirectory);
  const output = childOf(root, outputDirectory);
  if (input === output) throw new Error("Input and output mounts must differ.");
  const timeoutSeconds = 30;
  return {
    runtime: "docker-linux-planned",
    executable: "docker",
    args: [
      "run", "--rm", "--pull", "never", "--network", "none",
      "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
      "--user", "65534:65534", "--pids-limit", "64", "--cpus", "1",
      "--memory", "512m", "--memory-swap", "512m",
      "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
      "--mount", `type=bind,src=${input},dst=/input,readonly`,
      "--mount", `type=bind,src=${output},dst=/output`,
      "--workdir", "/input", image,
    ],
    limits: { timeoutSeconds, memoryMiB: 512, cpus: 1, pids: 64, network: "none" },
    artifacts: output,
    cancellation: "A future runner must stop and remove the exact container ID on abort/timeout.",
    qualified: false,
  };
}

export function dockerHealth({ cliFound, daemonVersion, osType }) {
  if (!cliFound) return { available: false, reason: "docker-cli-missing" };
  if (!daemonVersion) return { available: false, reason: "docker-daemon-unavailable" };
  if (osType !== "linux") return { available: false, reason: "linux-container-mode-required" };
  return { available: true, reason: "daemon-reachable-runtime-unqualified" };
}
