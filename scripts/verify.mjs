import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { qualityPlan, executePlan } from "./quality-plan.mjs";
import { fingerprint, sourceIndexVersion } from "./project-files.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const [mode = "full", ...flags] = process.argv.slice(2);
try {
  if (flags.some((flag) => flag !== "--plan"))
    throw new Error("Only --plan is supported after the suite name.");
  const plan = qualityPlan(mode);
  if (flags.includes("--plan")) {
    console.log(
      JSON.stringify(
        { mode, fullGate: mode === "full", stages: plan },
        null,
        2,
      ),
    );
  } else {
    const output = resolve(".cache/verification");
    const temporary = resolve(".cache/tmp");
    await mkdir(output, { recursive: true });
    await mkdir(temporary, { recursive: true });
    const startedAt = new Date().toISOString();
    // Replace the previous summary immediately: a running or interrupted check is never an old green result.
    const reportPath = resolve(output, `latest-${mode}.json`);
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          mode,
          status: "running",
          startedAt,
          sourceHash: null,
          sourceIndexVersion,
        },
        null,
        2,
      ),
    );
    let before;
    try {
      before = await fingerprint(root);
    } catch (error) {
      await writeFile(
        reportPath,
        JSON.stringify(
          {
            mode,
            sourceIndexVersion,
            status: "failed",
            startedAt,
            finishedAt: new Date().toISOString(),
            phase: "fingerprint",
            sourceHash: null,
          },
          null,
          2,
        ),
      );
      throw error;
    }
    await writeFile(
      reportPath,
      JSON.stringify(
        { mode, status: "running", startedAt, sourceHash: before },
        null,
        2,
      ),
    );
    console.log(
      `${mode === "full" ? "Full verification" : "Focused feedback (not full acceptance)"}: ${mode}`,
    );
    const result = await executePlan(
      plan,
      (stage) =>
        new Promise((resolveStage) => {
          console.log(`\n[${stage.name}] ${stage.args.join(" ")}`);
          const child = spawn(stage.command, stage.args, {
            shell: false,
            stdio: "inherit",
            cwd: root,
            env: {
              ...process.env,
              TEMP: temporary,
              TMP: temporary,
              TMPDIR: temporary,
            },
          });
          child.once("error", (error) => {
            console.error(error.message);
            resolveStage(1);
          });
          child.once("exit", (code, signal) =>
            resolveStage(signal ? 1 : (code ?? 1)),
          );
        }),
    );
    const after = await fingerprint(root);
    const stable = before === after;
    const ok = result.ok && stable;
    const report = {
      mode,
      sourceIndexVersion,
      status: ok ? "passed" : "failed",
      fullGate: mode === "full",
      startedAt,
      finishedAt: new Date().toISOString(),
      sourceHash: before,
      finalSourceHash: after,
      stable,
      stages: result.stages,
    };
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.table(result.stages);
    if (!stable)
      console.error(
        "Source changed during verification. Run again after edits stop.",
      );
    console.log(`${ok ? "PASS" : "FAIL"} ${mode} — ${reportPath}`);
    process.exitCode = ok ? 0 : 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
