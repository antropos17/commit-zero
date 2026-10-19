# Publication and README handoff

Updated: 2026-10-19. Workspace: `X:\ai-github`.

## Checkout and publication

- The root remains on `codex/development-foundation` with extensive existing
  tracked and untracked work. Preserve it; never publish the entire dirty root
  as an incidental documentation update.
- `.cache/publication` is the clean `main` checkout of
  `https://github.com/antropos17/commit-zero`. Its current local and remote head,
  rechecked for this handoff, is `f225a75df9060f2563124db1333c738e5e146697`.
- `.cache/profile-publication-draft` is the separate profile checkout, with local
  head `2f3bdd46f4c96e95d67f095eacd58f80664a3368`. The README/GIF work did not change it.
- The user authorized publication and selected AGPL-3.0. The application release
  remains v0.3.0 at `1abdf00`; subsequent presentation commits did not retag it.
- Final README and media files were synchronized from the publication checkout
  into the root only after comparing the root files against the preceding public
  versions. No application implementation was changed by the presentation work.

## Presentation decisions

The user rejected acid colors, oversized cards/banners and text-only monotony.
Keep recognizable original marks, restrained graphite/white, small useful buttons,
native readable copy and compact real visuals. The profile has its own Escape
Studio identity; the repository keeps the circular branching Commit Zero mark.

Repository polish commit `90a860d` introduced theme-specific 800×88 and 320×72
mastheads, three 84×32 buttons, shorter copy and two actual application captures.
The language-lab arena is explicitly a replay of an executed recorded match.
Evidence: `runtime/verification/github-repo-polish-2026-10-19.json`.

Commit `f225a75` replaced the first static screenshot with `docs/media/workflow-demo.gif`:

- 1000×464, seven frames, 15.8 seconds, 906714 bytes, displayed at 760px maximum.
- Chat → task #5 → retained fork `39b4d634` → code → PR #3 → review → operator merge.
- Actual retained Sequence Kit records, captured after completion and assembled
  as a condensed walkthrough. It is not a continuous live recording or a new run.
  Only framing and the neutral step strip were added; interface state was preserved.
- `workflow-poster.png` is the final frame. The README provides a Static view link
  and a native `prefers-reduced-motion: reduce` picture source.
- Source provenance is documented in `docs/media/README.md`. The same model made
  separate Builder/Reviewer calls; generated JavaScript was parsed, not executed.

## Verification and preserved evidence

GitHub Actions run `39189895501` completed successfully at exact head `f225a75`:
the full source gate, Chromium journeys and runtime dependency audit all passed.
The run and remote head were rechecked during this handoff.

The actual public README was checked at desktop width 1280 and mobile width 360.
The GIF loaded and animated; mobile rendering was about 279×130 with no page
overflow. The Static view link loaded the 1000×464 PNG. The reduced-motion source
was checked in markup; the operating-system preference was not toggled.

- `runtime/verification/github-readme-gif-2026-10-19.json`: published SHA, media
  metadata/hash, source relationships, browser checks and CI results.
- `runtime/verification/github-readme-gif-{desktop,mobile}-2026-10-19.jpg`: public
  GitHub screenshots. The desktop image includes keyboard focus on the GIF link.
- `runtime/verification/readme-gif-sources-2026-10-19/`: original browser captures,
  crop/timing manifest, Pillow encoder and actual local-run receipts.

## Unsuccessful fresh demonstration attempts

The separate `signal-kit` project made four tasks and seven actual local model
calls while preparing the demonstration. No code was merged. The first proposal
added top-level console calls despite the no-side-effects requirement; the model
review incorrectly claimed tests passed. The operator commented and closed it.
Later proposals were not approved; one duplicate was rejected before a new PR.

The project is archived at v0, with three retained forks/PRs and the failed-task
history available. Do not restore, merge or portray these attempts as successful
without a new request. The GIF instead shows the previously verified Sequence Kit
cycle. This limitation was explained to the user; no review rule was bypassed.
The approved unmerged Safe Timer job `811bdb98-bcbb-4b65-80b9-f19693aef6b4` was preserved.

Cleanup of `.cache/tmp/qa-readme-gif-2026-10-19` was blocked by tool policy.
Temporary copies remain; immutable source copies were already saved under
`runtime/verification`. Do not describe the cleanup as completed or retry a denied
deletion through another tool. Diagnostics were stable at about 23.7 MB and the
workspace volume had about 86 GB free after the GIF work.

## State at this handoff

`npm run doctor` currently reports no healthy gateway response at 4173 and source
newer than `dist`; dependencies and workspace disk checks pass. This supersedes
the earlier observation that all local services were healthy. Check processes and
ports before starting the app; avoid simultaneous supervisors. Model files exist,
but current inference readiness was not probed. No service was started for this
documentation-only handoff. The next implementation task has not been selected.
