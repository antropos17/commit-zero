# Distribution research and drafts

Checked 2026-10-19. These are preparation notes, not submissions. The current
product is a local, AGPL-3.0 application; the public repository is the download
and documentation URL. Avoid claiming a hosted service, new runtime model tests,
active catalog agents or a generated-code sandbox.

## Shortlist and decision

| Channel and audience | Official submission rules and fit | Required preparation and timing |
| --- | --- | --- |
| [Product Hunt](https://www.producthunt.com/launch): makers and early adopters who can install a developer tool | [Launch guide](https://www.producthunt.com/launch/preparing-for-launch) accepts a GitHub repository URL, asks for a plain name, tagline up to 60 characters, description up to 500, square thumbnail under 3 MB and at least two gallery images. The [guide](https://www.producthunt.com/launch) forbids direct requests for upvotes. | Best after final public commit and CI pass. Use existing real workspace/review captures as two gallery images, the repository logo as thumbnail only after checking dimensions, and a maker's personal account. The owner should verify all fields and be available for questions. No scheduled launch yet. |
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
The new [catalog capture](media/agent-catalog-2026-10-19.png) is an optional
third image only when captioned as 18 disabled proposals in a deterministic
fixture. Gallery sizing/crop and thumbnail have not been checked against Product
Hunt's upload requirements; those are prerequisites before submission.

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
> The existing local Builder/Reviewer and Language lab paths remain separate
> from the deterministic repository example and new fixtures. Proposal parsing
> and review do not prove code behavior. Follow `README.md` for installation,
> `docs/FIRST-RUN.md` for recovery and `docs/RELEASE.md` for scope.

Before publishing a release, replace the candidate version with an actual tag,
link its exact commit and CI run, re-run the documented gates, and record real
browser/model/sandbox coverage separately. No release was created by this note.

## Show HN fact sheet for a human author

- Runnable on a local machine: Node 24, `npm ci`, `npm run dev`, then loopback URL.
- Deterministic repository example can be explored before local model setup.
- Local inference is opt-in and needs Windows/Vulkan setup documented in README.
- Retained review is hash-bound to the exact proposal; merge is an operator action.
- Source and demo: repository URL above, README GIF (condensed saved run), real
  workspace/review screenshots. No signup or hosted demo is promised.
- Ask for feedback on inspectability and recovery, not votes. The maker writes
  the actual HN title/body/comments without generated text.
