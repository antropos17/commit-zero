# Distribution research and drafts

Checked 2026-10-19. These are preparation notes, not submissions. The current
product is a local, AGPL-3.0 application; the public repository is the download
and documentation URL. Avoid claiming a hosted service, new runtime model tests,
active catalog agents or a generated-code sandbox.

## Shortlist and decision

| Channel and audience | Official submission rules and fit | Required preparation and timing |
| --- | --- | --- |
| [Product Hunt](https://www.producthunt.com/launch): makers and early adopters who can install a developer tool | [Launch guide](https://www.producthunt.com/launch/preparing-for-launch) accepts a GitHub repository URL, asks for a plain name, tagline up to 60 characters, description up to 500, square thumbnail under 3 MB and at least two gallery images. Recommended dimensions are 240x240 and 1270x760. The [guide](https://www.producthunt.com/launch) forbids direct requests for upvotes. | Best after final public commit and CI pass. The checked asset set below provides two real viewport captures and the current application mark. A maker's personal account, final fields and availability for questions remain prerequisites. No scheduled launch yet. |
| [Show HN](https://news.ycombinator.com/showhn.html): developers who can run the project | Show HN accepts software people can run locally, asks for a `Show HN` title and easy trial without a signup barrier. [HN guidelines](https://news.ycombinator.com/newsguidelines.html) prohibit generated or AI-edited submission text and promotion-first participation. | Provide a clean quickstart, public source and reproducible demo. The human maker must write the submission and comments personally. This file supplies a fact sheet, not post copy. Do not ask for votes. |
| [DEV Community](https://dev.to/): technical readers interested in verification and local AI | [AI-assisted article rules](https://dev.to/guidelines-for-ai-assisted-articles-on-dev) require disclosure and fact checking, and disallow AI-assisted articles promoting a program. | Defer a launch post. A human-authored technical case study about revision-checked reviews and simulation may fit after sustained real-world feedback. No promotional draft is prepared. |
| [r/LocalLLaMA](https://www.reddit.com/r/LocalLLaMA/): local-model practitioners | The accessible [community rules page](https://www.reddit.com/r/LocalLLaMA/about/rules/) did not expose the rules to this research tool. Reddit's [general guidance](https://www.reddit.com/wiki/selfpromotion/) explicitly says its older self-promotion page is no longer updated and asks authors to check subreddit-specific rules. | Hold. Recheck current rules in a logged-in view and establish genuine community participation before considering a post. Do not infer permission from old general advice. |

## Product Hunt submission draft

URL: `https://github.com/antropos17/commit-zero` (direct repository URL).

Name: `Commit Zero`

Tagline (55 characters): `Review local AI code proposals in a Git-style workspace`

Description: `Commit Zero is an open-source workspace you run on your machine. Create projects and issues, discuss tasks, inspect a local model's proposed JavaScript file and independent review, then decide whether to merge. Versions, forks, timelines and receipts remain inspectable. The included repository example is deterministic; local inference requires separate setup. AGPL-3.0.`

Suggested first-comment facts for the maker to rewrite in their own voice:

> Commit Zero keeps a code proposal, its exact review and the operator's merge
> decision together. The local model path is optional during the first run;
> there is a deterministic repository example and a model-free Commons workflow
> to explore. The current boundary is one bounded JavaScript file per proposal.
> The parser does not execute generated code. I would especially value feedback
> on whether the review and history make a rejected proposal easy to understand.

Assets: [workspace desktop](media/workspace-desktop.png), [review](media/workspace-review.png),
[condensed saved-run demo](media/workflow-demo.gif), and [static fallback](media/workflow-poster.png).
The [current scenario PR diff](media/scenario-pr-2026-10-19.png) is a real Chrome
capture of the deterministic ten-step example; caption it as simulated activity.
The [catalog capture](media/agent-catalog-2026-10-19.png) is optional only when
captioned as 18 disabled proposals. Prefer the following ready-size set for a
first launch; it demonstrates a model-free entry path and the repository example.

| Asset | Checked file | Required caption |
| --- | --- | --- |
| Gallery 1 | [Commons first run](media/launch-2026-10-19/commons-first-run.png), 1270x760 | Actual local project and issue created by a deterministic capture script in disposable services. No model task started. |
| Gallery 2 | [Scenario PR](media/launch-2026-10-19/scenario-pr.png), 1270x760 | Deterministic ten-step repository example. Author, review and checks are simulated. |
| Thumbnail | [Current commit mark](media/launch-2026-10-19/thumbnail.png), 240x240 | Current application SVG mark rendered in Chrome, light mode. |

The [capture manifest](media/launch-2026-10-19/manifest.json) records dimensions,
bytes, SHA-256, capture time, source fingerprint and Chrome version. The PNGs are
actual viewports without resizing, compositing or invented activity; all are
below 3 MB. Visual inspection confirmed the relevant issue and changed lines
are visible. The manifest is capture provenance, not a full release gate.

Regenerate after `npm run build` with `npm run capture:launch`. On this Windows
host set `CZ_BROWSER_EXECUTABLE` as described in [development](DEVELOPMENT.md).
The command starts disposable in-memory services, performs actual scenario and
Commons HTTP interactions, captures PNGs, checks sizes/hashes and awaits cleanup.
It writes only `runtime/verification/launch-assets`; copy reviewed assets into a
dated source folder. Captured issue timestamps can differ on later runs, so the
journey is reproducible but byte-identical screenshots are not promised. The
personal account, maker comment and final launch timing remain human actions.
The mutable manifest is replaced with `running` before capture and `failed` on
an error; an interrupted attempt cannot leave an older success marked current.

## GitHub release candidate draft

This draft belongs on the existing repository's Releases page only after public
CI confirms the exact source revision. It is a technical release note, not an
announcement posted elsewhere.

> **Commit Zero 0.3.x candidate**
>
> Local agent collaboration now has a first-run guide and an explicit model
> health refresh in the Commons task form. The task draft remains intact across
> provider errors, busy states and recovery. The proposed-role view lists 18
> disabled agent profiles with model evidence, requirements, permissions and
> activation gaps. `npm run simulate:commons -- --seed 17` reproduces revision
> conflicts, rejected review, cancellation, failure, retry and paginated history
> in isolated fixtures. The sandbox contract reports its actual host readiness;
> no container execution is claimed without a working runtime.
>
> Chat now starts with the latest 40 saved messages and explicitly loads earlier
> batches while preserving the reading anchor. `npm run benchmark:ui` records a
> read-only large-history fixture; smaller initial DOM size is verified, while
> changed snapshots still transfer the full history.
>
> The existing local Builder/Reviewer and Language lab paths remain separate
> from the deterministic repository example and new fixtures. Proposal parsing
> and review do not prove code behavior. Follow `README.md` for installation,
> `docs/FIRST-RUN.md` for recovery and `docs/RELEASE.md` for scope.

Before publishing a release, replace the candidate version with an actual tag,
link its exact commit and CI run, re-run the documented gates, and record real
browser/model/sandbox coverage separately. No release was created by this note.
Current implemented-code checkpoint: public `ae6569b`, [CI run 39220678511](https://github.com/antropos17/commit-zero/actions/runs/39220678511)
passed the full gate, Chromium and runtime dependency audit after the Commons
retry repair. Local frozen gate at `3bfcc8d` passed 72/72 Node tests, DOM/axe 2/2,
build and serving with source hash
`26cf7d425e0bc517e4e67b52aa530f315823736ffc268f940052dd7474f47c73`;
separate local Chrome coverage passed 12/12. The account-recovery addition awaits
its full gate. Verify the final candidate revision before creating a release.
The checked capture set is already published at `98389bd`.

## Show HN fact sheet for a human author

- Runnable on a local machine: Node 24, `npm ci`, `npm run dev`, then loopback URL.
- Deterministic repository example can be explored before local model setup.
- Local inference is opt-in and needs Windows/Vulkan setup documented in README.
- Retained review is hash-bound to the exact proposal; merge is an operator action.
- Source and demo: repository URL above, README GIF (condensed saved run), real
  workspace/review screenshots. No signup or hosted demo is promised.
- Ask for feedback on inspectability and recovery, not votes. The maker writes
  the actual HN title/body/comments without generated text.
