import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// One maintained index for navigation and focused verification.
export const areas = {
  ui: {
    purpose:
      "React routes, shared controls, themes and reading-state preservation",
    paths: [
      "prototype/app",
      "prototype/social.html",
      "prototype/workspace.css",
      "prototype/social.css",
      "prototype/theme.css",
      "prototype/typography.css",
    ],
    entries: [
      "prototype/app/App.jsx",
      "prototype/app/state.jsx",
      "prototype/app/api.mjs",
      "prototype/app/router.mjs",
      "prototype/app/pages/model-profile.jsx",
      "prototype/app/pages/agent-catalog.jsx",
      "prototype/app/pages/timeline.jsx",
      "prototype/app/components/contributions.jsx",
      "prototype/app/components/project-contributions.jsx",
      "prototype/app/components/project-timeline.jsx",
      "prototype/app/components/page-boundary.jsx",
    ],
    tests: ["tests/interface.dom.mjs", "tests/agent-catalog.test.mjs", "tests/agent-fixtures.test.mjs", "tests/browser/commons-first-run.spec.mjs", "tests/browser/scenario-pr.spec.mjs", "tests/browser/workspace-recovery.spec.mjs", "tests/browser/service-health.spec.mjs", "tests/browser/scenario-keyboard.spec.mjs", "tests/browser/ranking-recovery.spec.mjs", "tests/ui-api.test.mjs", "tests/browser/auth-recovery.spec.mjs", "tests/browser/page-recovery.spec.mjs", "tests/browser/lab-recovery.spec.mjs", "tests/browser/timeline-recovery.spec.mjs", "tests/browser/commons-readiness.spec.mjs", "tests/browser/commons-saved-agents.spec.mjs"],
    docs: ["DESIGN.md", "docs/AGENT-CATALOG.md", "docs/FIRST-RUN.md"],
  },
  commons: {
    purpose:
      "Real local Builder/Reviewer collaboration, versioned copies and guarded merges",
    paths: [
      "server/commons",
      "shared/commons-history.mjs",
      "shared/contributions.mjs",
      "shared/project-timeline.mjs",
      "shared/agent-catalog.mjs",
      "shared/agent-evaluation.mjs",
      "shared/agent-fixtures.mjs",
      "shared/local-model-artifact.mjs",
      "shared/provider-drafts.mjs",
      "shared/commons-fixture-seed17.json",
      "db/migrations/003_commons.sql",
      "db/migrations/004_commons_storage.sql",
      "db/migrations/005_commons_issues.sql",
    ],
    entries: [
      "server/commons/app.mjs",
      "server/commons/store.mjs",
      "server/commons/runner.mjs",
      "server/commons/projects.mjs",
      "server/commons/owned-agent.mjs",
      "scripts/aigit.mjs",
      "scripts/simulate-commons.mjs",
      "prototype/app/pages/commons.jsx",
      "prototype/app/pages/commons-tasks.jsx",
      "prototype/app/pages/commons-projects.jsx",
      "prototype/app/pages/commons-cache.mjs", "prototype/app/pages/commons-agents.mjs",
    ],
    tests: [
      "tests/commons.test.mjs",
      "tests/backend-storage.test.mjs",
      "tests/commons-projects.test.mjs",
      "tests/contributions.test.mjs",
      "tests/project-timeline.test.mjs",
      "tests/agent-catalog.test.mjs",
      "tests/agent-fixtures.test.mjs",
      "tests/provider-drafts.test.mjs",
      "tests/simulate-commons.test.mjs",
      "tests/browser/commons-first-run.spec.mjs",
      "tests/browser/commons-history.spec.mjs",
      "tests/browser/commons-project-recovery.spec.mjs",
      "tests/browser/commons-provider.spec.mjs",
      "tests/browser/commons-readiness.spec.mjs", "tests/browser/commons-saved-agents.spec.mjs",
    ],
    docs: ["docs/COMMONS.md", "docs/BACKEND-PERFORMANCE.md", "docs/RELEASE.md", "docs/AGENT-CATALOG.md", "docs/PROVIDER-DRAFTS.md", "docs/SIMULATIONS.md"],
  },
  lab: {
    purpose:
      "Local inference, bounded language interpreter, rules, strategies and recorded matches",
    paths: ["server/lab", "shared/local-model-artifact.mjs", "db/migrations/002_experiments.sql"],
    entries: [
      "server/lab/app.mjs",
      "server/lab/arena-runner.mjs",
      "server/lab/language.mjs",
      "prototype/app/pages/laboratory.jsx",
      "scripts/model-identity.mjs",
    ],
    tests: [
      "tests/arena-decoder.test.mjs",
      "tests/arena.test.mjs",
      "tests/laboratory.test.mjs",
      "tests/model-identity.test.mjs",
      "tests/browser/lab-recovery.spec.mjs",
    ],
    docs: ["docs/LANGUAGE-LAB.md"],
  },
  identity: {
    purpose:
      "Observer accounts, OAuth, sessions and account-owned agent configurations",
    paths: ["services/identity", "prototype/app/pages/account.jsx"],
    entries: [
      "services/identity/app.mjs",
      "services/identity/store.mjs",
      "services/identity/oauth.mjs",
      "services/identity/agents.mjs",
      "prototype/app/state.jsx",
      "prototype/app/pages/account.jsx",
    ],
    tests: [
      "tests/agents.test.mjs",
      "tests/oauth-timeline.test.mjs",
      "tests/services.test.mjs",
      "tests/browser/account-recovery.spec.mjs",
    ],
    docs: ["docs/OAUTH.md", "docs/CONCEPT.md"],
  },
  scenario: {
    purpose:
      "Deterministic repository scenario, transactions and persisted timelines",
    paths: [
      "server/domain",
      "server/store.mjs",
      "server/database.mjs",
      "shared",
    ],
    entries: [
      "server/app.mjs",
      "server/domain/scenario.mjs",
      "server/agent-protocol.mjs",
    ],
    tests: [
      "prototype/social-state.test.mjs",
      "tests/api.test.mjs",
      "tests/persistence.test.mjs",
      "tests/oauth-timeline.test.mjs",
    ],
    docs: ["docs/ARCHITECTURE.md", "docs/API.md", "docs/AGENT-PROTOCOL.md"],
  },
  services: {
    purpose:
      "Gateway, ranking, HTTP policy and independent-process supervision",
    paths: [
      "services/gateway.mjs",
      "services/base.mjs",
      "services/ranking",
      "scripts/services.mjs",
    ],
    entries: ["services/start.mjs", "scripts/dev.mjs", "server/index.mjs"],
    tests: ["tests/services.test.mjs"],
    docs: ["docs/ARCHITECTURE.md"],
  },
  tooling: {
    purpose:
      "Developer commands, verification plans, repository checks and diagnostics",
    paths: [
      "scripts",
      ".github",
      "eslint.config.mjs",
      "vite.config.mjs",
      "playwright.config.mjs",
    ],
    entries: [
      "scripts/doctor.mjs",
      "scripts/verify.mjs",
      "scripts/test-ui.mjs",
      "scripts/browser-runtime.mjs",
      "scripts/evidence-status.mjs",
      "scripts/project-files.mjs",
      "scripts/source-inspect.mjs",
      "scripts/prepare-publication.mjs",
        "scripts/verify-vendored-skills.mjs",
        "shared/vendored-skills.json",
      "scripts/benchmark-ui.mjs",
      "scripts/capture-launch.mjs",
      "scripts/agent-fixtures.mjs",
      "scripts/repo-check.mjs",
      "scripts/sandbox-doctor.mjs",
      "scripts/sandbox-contract.mjs",
    ],
    tests: ["tests/tooling.test.mjs", "tests/project-files.test.mjs", "tests/browser-runtime.test.mjs", "tests/browser-evidence.test.mjs", "tests/evidence-status.test.mjs", "tests/publication-preparation.test.mjs", "tests/vendored-skills.test.mjs", "tests/store-snapshot.test.mjs", "tests/sandbox-contract.test.mjs"],
    docs: ["docs/DEVELOPMENT.md", "docs/SANDBOX-ADAPTER.md", "docs/WORKFLOW-MEASUREMENTS.md", "docs/VENDORED-SKILLS.md", "docs/ECOSYSTEM-DECISIONS.md"],
  },
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const key = process.argv[2];
  if (key && !Object.hasOwn(areas, key)) {
    console.error(
      `Unknown area: ${key}. Choose ${Object.keys(areas).join(", ")}.`,
    );
    process.exitCode = 1;
  } else {
    for (const [name, area] of Object.entries(
      key ? { [key]: areas[key] } : areas,
    )) {
      console.log(`\n${name}: ${area.purpose}`);
      for (const field of ["paths", "entries", "tests", "docs"])
        console.log(`  ${field}: ${area[field].join(", ")}`);
      console.log(`  verify: npm run check:${name}`);
    }
    console.log(
      "\nFocused checks are feedback only. Finish implementation with npm run check.",
    );
  }
}
