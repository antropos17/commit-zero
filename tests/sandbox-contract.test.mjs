import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, join } from "node:path";
import { planDockerSandbox, dockerHealth } from "../scripts/sandbox-contract.mjs";

const root = resolve(".cache/sandbox-staging");
const image = `example/qualified-node@sha256:${"a".repeat(64)}`;

test("sandbox contract constrains mounts, image, resources and network before activation", () => {
  const plan = planDockerSandbox({ stagingRoot: root, inputDirectory: join(root, "input"), outputDirectory: join(root, "output"), image });
  assert.equal(plan.qualified, false);
  assert.deepEqual(plan.limits, { timeoutSeconds: 30, memoryMiB: 512, cpus: 1, pids: 64, network: "none" });
  for (const item of ["--rm", "--network", "none", "--read-only", "--cap-drop", "ALL", "--memory", "512m", "--pids-limit", "64"])
    assert.ok(plan.args.includes(item));
  assert.ok(plan.args.includes(`type=bind,src=${join(root, "input")},dst=/input,readonly`));
  assert.ok(plan.args.includes(`type=bind,src=${join(root, "output")},dst=/output`));
  for (const bad of [root, resolve(root, ".."), resolve(root, "../outside")])
    assert.throws(() => planDockerSandbox({ stagingRoot: root, inputDirectory: bad, outputDirectory: join(root, "output"), image }), /child/);
  assert.throws(() => planDockerSandbox({ stagingRoot: root, inputDirectory: join(root, "input"), outputDirectory: join(root, "input"), image }), /differ/);
  assert.throws(() => planDockerSandbox({ stagingRoot: root, inputDirectory: join(root, "input"), outputDirectory: join(root, "output"), image: "node:latest" }), /digest/);
  assert.throws(() => planDockerSandbox({ stagingRoot: root, inputDirectory: join(root, "input,readonly=false"), outputDirectory: join(root, "output"), image }), /delimiter/);
});

test("health distinguishes missing CLI, missing daemon and wrong container mode", () => {
  assert.equal(dockerHealth({ cliFound: false }).reason, "docker-cli-missing");
  assert.equal(dockerHealth({ cliFound: true }).reason, "docker-daemon-unavailable");
  assert.equal(dockerHealth({ cliFound: true, daemonVersion: "1", osType: "windows" }).reason, "linux-container-mode-required");
  assert.deepEqual(dockerHealth({ cliFound: true, daemonVersion: "1", osType: "linux" }), { available: true, reason: "daemon-reachable-runtime-unqualified" });
});
