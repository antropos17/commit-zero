# Repository visuals

These are direct captures of the local application on 2026-10-19. No interface
content was composited or invented. Existing local data is not bundled with a
fresh installation.

- `workspace-desktop.png`: Sequence Kit task #5, accepted PR #3 and its retained
  timeline. Builder and Reviewer were separate calls to the same local model.
  The syntax check did not execute the generated JavaScript.
- `workspace-review.png`: a fresh direct browser capture of the same PR and
  timeline, framed around the review and source panels for README readability.
  No application content was edited or composited.
- `workspace-mobile.png`: the same project scrolled to its task review at a
  390-pixel viewport, with project sections and acceptance state visible.
- `arena-desktop.png`: recorded match #202, generation 1, round 6 of the completed
  local experiment `6f3a2e68-8931-4525-9ad6-a63fd50e8db5`. It is a replay of
  executed bounded-interpreter moves, not a currently running tournament.
- `arena-match.png`: a fresh direct browser capture of the same recorded round,
  framed around the two strategies, active rules and energy. The README links
  each focused capture to its full workspace image.
- `arena-match-wide.jpg`: direct capture of the same recorded round in the
  horizontal arena layout, showing both strategies, rules, energy and outcome.
  Its compact README preview links to the full workspace capture.
- `commit-zero.svg`: original vector artwork for this project.

The screenshots include third-party provider marks already documented in
[third-party notices](../../THIRD_PARTY_NOTICES.md).

## Compact repository identity

`identity/` contains original Commit Zero navigation artwork, separate from the
application screenshots above:

- `masthead-light.svg` and `masthead-dark.svg`: transparent 800×88 canvases with
  the existing circular branching commit mark, a 36px name and a quiet divider.
- `masthead-mobile-light.svg` and `masthead-mobile-dark.svg`: 320×72 variants with
  the same 48px mark and a 30px name, so a narrow README does not shrink desktop
  typography into small text.
- `button-start-{light,dark}.svg`, `button-docs-{light,dark}.svg` and
  `button-release-{light,dark}.svg`: 84×32 navigation labels. Get started uses a
  neutral fill; Docs and Release use transparent interiors and restrained outlines.
  The 12px labels have no extra icons. Three native-width buttons plus two ordinary
  whitespace gaps occupy approximately 262px.

The identity uses graphite, warm white and supporting gray, with no gradients,
charts, slogans, background panels or third-party logo artwork. The mark belongs
to Commit Zero; it is not the separate Escape Studio identity. Both SVG themes
are self-contained and contain accessible titles and descriptions. Use the light
variant as the fallback and the dark variant through a native `<picture>` source.
Keep mastheads at their intended desktop/mobile sizes and buttons at 84×32.

Measured against GitHub's white and `0d1117` backgrounds, masthead/outline label
contrast is at least 15.8:1, filled-button label contrast at least 12.2:1 and
outlined-button boundary contrast at least 3.1:1. These are calculated color checks;
all text also fits its native SVG canvas in an installed Chrome render.
