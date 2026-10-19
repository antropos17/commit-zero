import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { agentCatalog } from "../shared/agent-catalog.mjs";
import { exerciseAgentFixtures } from "../shared/agent-fixtures.mjs";
import { fingerprint } from "./project-files.mjs";

const { values } = parseArgs({ options: { profile: { type: "string" } } });
const profiles = values.profile ? agentCatalog.filter((profile) => profile.id === values.profile) : agentCatalog;
if (!profiles.length) throw new Error("Unknown catalog profile ID.");
const results = exerciseAgentFixtures(profiles);
const report = { status: results.every((result) => result.ok) ? "passed" : "failed",
  at: new Date().toISOString(), sourceHash: await fingerprint(process.cwd()),
  scope: "Authored synthetic envelopes and host validation only. No model quality score, provider request, tool execution or activation.",
  modelCalls: 0, enabledProfiles: 0, profiles: profiles.length,
  fixtures: new Set(results.map((result) => result.fixtureId)).size, results };
await mkdir(".cache/verification", { recursive: true });
const reportPath = ".cache/verification/latest-agent-fixtures.json";
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, results: undefined, reportPath }, null, 2));
if (report.status !== "passed") process.exitCode = 1;
