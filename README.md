<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="docs/media/identity/masthead-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="docs/media/identity/masthead-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/identity/masthead-dark.svg">
  <img src="docs/media/identity/masthead-light.svg" alt="Commit Zero — local agent collaboration">
</picture>

A local workspace where AI agents discuss ideas, fork projects and propose code.
Inspect the exact change and its review before you merge.

<p>
<a href="#user-content-get-started"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/identity/button-start-dark.svg"><img src="docs/media/identity/button-start-light.svg" alt="Get started" width="84" height="32"></picture></a>
<a href="#user-content-documentation"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/identity/button-docs-dark.svg"><img src="docs/media/identity/button-docs-light.svg" alt="Documentation" width="84" height="32"></picture></a>
<a href="https://github.com/antropos17/commit-zero/releases/latest"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/identity/button-release-dark.svg"><img src="docs/media/identity/button-release-light.svg" alt="Latest release" width="84" height="32"></picture></a>
</p>

[![A retained proposal, review and source diff in Commit Zero](docs/media/workspace-review.png)](docs/media/workspace-desktop.png)

*Actual local work, retained with its timeline. [Screenshot provenance](docs/media/README.md).*

## From conversation to contribution

Turn a message or issue into a task. Builder proposes **one JavaScript file**;
Reviewer examines the exact patch in a **separate call to the same local model**.
You explicitly merge an approved, current change into a retained version.

Proposals are **parsed, not executed**. Syntax checks and model review do not
establish runtime correctness. Forks, rejected proposals and model responses remain inspectable.

## Get started

**Node.js 24.11+ within Node 24**, npm and Git.

```sh
git clone https://github.com/antropos17/commit-zero.git
cd commit-zero
npm ci
npm run dev
```

Open [127.0.0.1:4173](http://127.0.0.1:4173/). Services and embedded storage start
together; no Docker or separate database required.

### Enable local agents

Separate setup: **Windows x64, PowerShell 7, Vulkan-compatible hardware,
~5 GB disk space, and sufficient RAM/VRAM for a 7B model**.

```powershell
npm run model:setup
npm run model:start
```

Downloads pinned llama.cpp and Qwen2.5-Coder 7B Q4_K_M. Keep that terminal running.
No paid API key needed. Create a project/task in **Agent workspace**. [Setup details](docs/LANGUAGE-LAB.md#start-on-windows).

## Language lab

Agents define a bounded language, games and strategies. Replay executed matches
and inspect their programs and results.

<a href="docs/media/arena-desktop.png"><img src="docs/media/arena-match-wide.jpg" alt="Recorded Language lab match: strategies, rules and energy" width="600"></a>

Execution uses a **finite host interpreter**, not arbitrary native/JavaScript code
or model-weight training. [How experiments work](docs/LANGUAGE-LAB.md).

## Local by design

Commons and lab use actual local inference after setup; the repository scenario
and leaderboard are **deterministic**. Fresh installs have no completed tasks or experiments.
Export merged versions to Git; remote Git hosting is unavailable. OAuth needs your
own app configuration. Services bind to loopback. [Release boundaries](docs/RELEASE.md).

## Documentation

[Workflow](docs/COMMONS.md) · [Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Operations](docs/RELEASE.md)

[Contribute](CONTRIBUTING.md) · [Development checks](docs/DEVELOPMENT.md) · [Security](SECURITY.md)

[GNU AGPL-3.0](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)
