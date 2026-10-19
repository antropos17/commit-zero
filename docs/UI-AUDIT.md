# Interface audit and refinement — 2026-10-18

The sections through Health assessment record the initial foundation pass. The
visual follow-up at the end records the subsequent changes and current browser evidence.

## Verdict and verification boundary

The implementation now has a coherent repository/PR-oriented interface and a
persistent server-backed scenario. Impeccable's source detector returned no
findings for the selected HTML/CSS/module targets. This is a static result, not
a rendered accessibility or visual-quality certification.

The existing browser tab was blocked by the browser tool's URL policy in the
preceding turn. No alternate browser automation was used to bypass that refusal.
This pass verified the compiled interface in JSDOM with an injected real Fastify
API, and ran axe's non-visual rules. Pixel contrast, physical touch, browser focus
trapping and animation feel remain unverified in a rendered browser. A Playwright
suite and CI job are prepared for those checks; they were not executed locally.

## Findings and changes

| Priority | Finding before this pass                               | Change                                                                   | Evidence                                               |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| P1       | Reloading erased the agent world                       | PostgreSQL persistence, versioned API and preserved runs                 | Close/reopen database test; API and compiled DOM tests |
| P1       | No pending, server-error or recovery path              | Pending controls, retained state, error banner and retry                 | DOM offline/recovery test                              |
| P1       | Concurrent observers could advance inconsistent state  | Expected revision, row lock and 409 conflict                             | Concurrent API test                                    |
| P2       | All ten workflow steps competed with the activity feed | Current step first, optional full sequence                               | Source review; pixels pending                          |
| P2       | Frequent rerenders could discard keyboard focus        | Preserve active links; focus main on route changes                       | DOM focus assertion                                    |
| P2       | Small mobile controls and cramped code                 | 44px mobile controls, contained code scrolling, stronger type hierarchy  | CSS review; viewport test prepared                     |
| P2       | Storage and autonomous AI were easy to confuse         | Explicit simulation label, real connection status, accurate sandbox copy | API health and source review                           |
| P3       | Decorative blur/shadow and unrelated motion            | Removed backdrop blur; one occasional dialog entrance                    | Source review; motion feel pending                     |

## Static typography and contrast

Platform UI typography is intentional for this operational interface. Code retains
monospace. Body is 14px, supporting copy 12–13px, page titles 24–26px. Long headings
wrap and code scrolls internally. Calculated token-pair contrasts exceed 4.5:1 for
the primary text, secondary text on both white and secondary surfaces, blue links,
green success text and purple merge text. This arithmetic does not verify all
computed browser states, antialiasing, overlays or game canvases.

## Design Taste compatibility

The installed tasteskill v2 explicitly excludes dashboards/app screens. Its source
scan reported 22 hairline findings, 26 outlined-box warnings, two shadow findings
and two backdrop-filter warnings before final cleanup. Thin rules in file lists,
PR rows, navigation and form fields are intentional GitHub-like structures; the
screen-reader-only 1px box is an accessibility implementation, not decoration.
The obsolete button shadow and backdrop blur declarations were removed. Explicit
`none` overrides are scanner false positives. No marketing direction draw or
large editorial hero was applied to the workspace.

## Motion decision

Frequency: occasional game preview. Purpose: spatial consistency. Tool: native
dialog plus WAAPI; opacity and scale(0.96), 200ms, Animate's strong ease-out curve.
Keyboard and reduced-motion requests use immediate placement. Code, navigation
and activity text do not slide or animate on every refresh. No motion package was
added. Browser feel remains a manual follow-up, not a claimed pass.

## Health assessment

Accessibility: markup checks pass, rendered contrast and physical input pending.
Performance: the main production JS is about 38 kB uncompressed / 13.3 kB gzip;
no framework or motion-library migration. Theming: light-only by design; a complete
dark theme is outside this request. Responsiveness: source constraints improved,
rendered viewport verification pending. Integrity: source scan and functional
scenario checks pass. No overall numerical score is assigned without pixel evidence.

## Visual follow-up after user feedback

The initial composition gave explanatory copy, controls and activity similar
weight while hiding the source code. The follow-up introduces a shared navigation
rail, a compact toolbar, a source-first overview and a quieter supporting column.
The overview excerpt comes from the actual saved repository and links to the full
file; its preview button opens the existing game. Related PR status remains live
application data. The new commit-graph brand mark is authored SVG geometry.

Removed 34 obsolete overview CSS rules. Kept existing repository, PR, profile and
storage behavior. The shared shell lives in `prototype/workspace.css` and uses a
12px minimum for supporting text, with 13–14px content and 24px page headings.

The in-app browser was accessible in this follow-up through the same browser
surface. Rendered screenshots were inspected at 1440, 1024 and 390px; document
overflow was checked at 320, 390 and 1024px. The mobile repository view and desktop
agent directory were also inspected. Code and navigation strips scroll internally.
The preview opened successfully; Escape closed it and returned focus to its launch
button. The browser console reported no errors. A computed foreground/background
check on the overview found no text-contrast failures; this is a focused check,
not a full accessibility certification.

The Impeccable scan identified undersized labels during the pass; the stylesheet
was corrected and rendered text was checked for undersized functional labels.
Design Taste's source scan flags the shell, editor separators and outlined
workspace panels. These remain intentional operational GitHub conventions; the
skill excludes app screens. No marketing composition or decorative media was added.

Screenshots are disposable local diagnostics under `runtime/diagnostics/qa-overview-*.jpg`,
covered by the existing seven-day / 50 MB retention command. The Playwright suite
was attempted but could not launch because its Chromium executable is absent.
No browser was downloaded. Manual in-app browser checks and the passing compiled
DOM tests are reported separately from that unavailable automated suite.

## Typography and motion correction after further feedback

The subsequent feedback rejected the heavy platform font, custom brand symbol,
decorative icons and perceived teleporting. The interface now uses bundled Arimo
400/600 with Latin and Cyrillic subsets, a plain wordmark, text-only navigation,
upstream GitHub Octicons for file/PR/actions and a white source editor. Removed
repeated participant lists, arrow decorations, icon tiles and slogans. Provider
marks still identify the existing simulated accounts.

Removed the dialog's WAAPI scale/fade and all workspace CSS transitions. Keyed
morphdom updates replace full page recreation during refresh/advance. Returning
to a route restores its document scroll, updates retain code scroll and selection,
and new runs start at the top. A visible feed item anchors the reading position
when new events arrive. Stable scrollbar space and control widths reduce shifts.

The compiled DOM regression now checks source and event node identity across
refresh/advance, selected text, horizontal code scroll, expanded details, focus,
route return scroll and fresh-run reset. The complete check command passes.
In-app browser checks at 1440 and 390px confirmed the new font and layout. The
390px view had no document overflow; computed styles reported no CSS animation
or nonzero transition. A refresh retained code scroll at 37.33px. Preview opened
with transform/animation `none`; Escape returned focus to its launch button.
The source detector returned no findings and dependency audit found no reported
vulnerabilities. This does not expand the unavailable Playwright suite into a pass.

## GitHub-style light and dark appearance

The next request explicitly restored the logo and requested simpler GitHub-like
appearance, stronger code contrast and both light/dark themes. Restored the
monochrome commit-graph mark and favicon; kept text navigation, plain surfaces,
repository tables, PR tabs and restrained controls. The observer link in the
header was replaced with the native theme selector; sandbox access remains in
navigation. No animation was added.

All maintained component color literals were converted to semantic roles in
`theme.css`. White avatar grounds are intentional for the existing provider marks.
Added theme-specific source tokens, function highlighting, separate diff gutters,
status surfaces and preview/canvas palettes. Early theme bootstrap avoids a wrong
initial theme; selection persists locally and propagates to preview frames.

In-app browser checks cover both home themes at 1440/390px, preference restoration
after reload, PR discussion and diff, and the dark game preview. Computed text
contrast checks found two low-contrast +/- gutter markers in the initial dark
diff; these were corrected to the main ink role. Rechecking both diff themes and
both mobile home themes found no text-contrast failures. The 390px viewport had
375px document width with a reserved scrollbar gutter and a 44px theme control.
This is focused rendered evidence, not a full browser accessibility certification.

The compiled DOM integration checks theme selection, stored choice, cross-tab
events, source node retention, early saved-theme restoration and blocked storage.
Production serving verifies the shared preview stylesheet/script and restored logo.
Screenshots use `runtime/diagnostics/qa-github-*.jpg` and existing retention rules.

## Final typography and catalog refinement (2026-10-18)

Further feedback rejected the previous type treatment. Compared the live
`github.com/primer/react` repository with the application: GitHub's computed
Latin family was Mona Sans VF with 14px / 21px table text. Replaced Arimo with
local Mona Sans Latin and Noto Sans Cyrillic variable subsets. Mona has no
Cyrillic subset; the dedicated Noto face keeps Russian consistent across hosts.
Both subsets preload, use swap, retain normal width and ship with OFL notices.

Removed scattered size, weight, family, leading and tracking declarations from
all three maintained application stylesheets. A single typography sheet owns
14px dense UI, 16px prose, 12px metadata, 16px section and 24px page headings.
Ordinary descriptions no longer use metadata sizes. Source is 14px desktop /
13px mobile, with 24px leading and no ligatures. No motion was introduced.

Repository and agent directories now use separated rows rather than equal card
grids, including profile and search results. Sidebar paths are single-line.
Narrow workbench headers put descriptions below their action row; at 320px the
scenario action fills a row, followed by next-step and a 44px refresh control.
Mobile theme/search/action controls have a 44px minimum height.

Rendered checks used the in-app browser at 1440, 1060, 390 and 320px. Inspected
home, agent catalog/profile, repository catalog/source and PR discussion/diff.
Home text foreground/background checks passed in both themes at desktop and
390px; both diff themes also passed. At 390/320px document widths were 375/305px
with reserved scrollbar space, so the document did not overflow. These are
focused checks of rendered content, not complete accessibility certification.

Impeccable's type scan returned two overused-font warnings for Mona Sans. Retained
that face intentionally: the user's explicit GitHub appearance reference takes
precedence over generic novelty guidance. No unexplained type warning remains.
Screenshots: `runtime/diagnostics/qa-type-*.png`, disposable under the existing
seven-day / 50 MB command. The standalone Playwright suite remains unavailable;
no claim is made that it ran in this pass.

## Requested three-skill pass (2026-10-18)

### Scope and implementation integrity

Applied the locally vendored Impeccable, Design Taste Frontend and Animate skills
to the existing Operate/Read workspace. Preserve the explicit GitHub reference,
local identity, plain typography, both themes and the user's earlier no-motion
preference. This is an application screen: Design Taste's marketing direction
draw, picture quota, hero scale and motion quota do not define this surface.
Used its source scan, actual-content, hierarchy, spacing, collision and phone
composition checks. No marketing content or decorative assets were introduced.

The integrity verdict is coherent within this scope: real project source,
repository relationships and account marks carry the identity; the persisted
scenario remains labeled as simulated. No unsupported model-execution claim,
new dependency, migration or database change was added.

### Audit findings and completed repairs

- P1 / accessibility: diff signs were hidden from assistive technology while the
  addition/deletion distinction depended on color. Added visually hidden type
  labels per changed line; retained visible +/- gutters and source highlighting.
- P2 / navigation: mobile navigation put Sandbox and History past the visible
  right edge. Replaced the strip with a native select and explicit Go submit.
  All six sections are available. Merely selecting an option does not navigate;
  background state refresh does not discard the unsubmitted choice.
- P2 / accessibility: the skip link changed the application fragment to #main.
  Although a special handler focused main, refresh could then reopen the home
  route instead of the current repository. Prevent default fragment navigation
  and focus main directly; the repository URL remains intact.
- P2 / keyboard feedback: search focus could be clipped by its overflow boundary;
  page-tab focus could be clipped by the tab scroller. Added a visible search
  group outline and inset outlines for its controls and page tabs. Retained the
  existing inset code-scroller focus rule.
- P2 / semantics: named source/diff containers were generic elements, and selected
  files had only visual styling. Added region roles and aria-current on the file.

Focused audit scores after repairs (engineering judgment, not certification):

| Dimension     | Score / 4 | Evidence and limit                                                                |
| ------------- | --------- | --------------------------------------------------------------------------------- |
| Accessibility | 3         | Keyboard, named controls/regions, DOM axe checks; no physical screen reader test  |
| Performance   | 3         | Small local assets, no animation library or new dependency; no full profiler run  |
| Theming       | 3         | Both themes and focused rendered text checks; no all-state contrast certification |
| Responsive    | 3         | 320/390/768/1440 viewport checks; no physical touch-device test                   |
| Integrity     | 4         | Existing system preserved, actual source visible, simulation truth retained       |
| Total         | 16 / 20   | Good; bounded verification                                                        |

### Design Taste and Impeccable detector disposition

The initial Design Taste source scan reported 35 FAIL and 28 WARN: 33 thin-rule matches,
one monospace match, one shadow match, 27 outlined-box matches and one glass
match. These are not reported as a green gate. The shadow/glass declarations are
literally none; monospace is restricted to source/code; lines and outlines form
real file/PR/data lists, inputs and developer-workspace boundaries explicitly
requested by the user. The skill itself excludes dashboard/application screens.
The CLI browser inspector was not run: rendered inspection used the authorized
in-app browser instead. No source suppression or detector configuration changed.

Impeccable returns two generic overused-font warnings for Mona Sans. Retained
intentionally because the explicit GitHub reference takes precedence over
novelty. No font change was made during this pass.

### Animate decision

Navigation, keyboard actions, source reading and repeated scenario updates are
frequent-use interactions. The gate rejects decorative motion on these surfaces;
feedback uses immediate selected, focus, busy and saved states. Preview dialogs
remain native and immediate because the existing brief rejects modal motion.
Stable keyed updates handle spatial continuity. Gameplay motion is essential to
the existing previews and remains separate. No UI animation/transition was added,
no easing token or motion library was installed, and no reduced-motion kill rule
was used to disguise unnecessary animation.

### Verification

The compiled DOM regression now checks deliberate navigation submission,
preservation of a pending section selection across refresh, route-preserving
skip focus, named code regions, selected-file semantics and diff text labels.
In-app keyboard checks exercised search focus, Go submission, skip focus and
code scrolling. Mobile controls measure 44px; 320/390 document widths remain
305/375px with scrollbar space. Both mobile home themes pass the focused
foreground/background check. Screenshots: runtime/diagnostics/qa-skills-*.png.
The complete check command passes; the standalone Playwright suite remains
unavailable as previously documented. No claim of physical-device or screen
reader validation is made.

## React, English UI and service expansion (2026-10-18)

Replaced the string-template/morphdom runtime with React 19.3.1 components for
all active pages and preview controls. Preserved the plain GitHub-inspired shell,
code/repository/PR conventions, provider marks, native theme selector and zero
workspace-motion direction. Product copy, scenario data, dates, errors and empty
states are English. Historical runs retain their stored text and receive a known
phrase translation at the API read boundary.

Added a separate leaderboard with Overall/Code/Collaboration categories, filtering,
score sorting, tied ranks and an explicit method. Its reference is the official
[Arena leaderboard](https://arena.ai/leaderboard). Contribution counts and scores
come from the current workspace; there are no invented Elo values, votes, win
rates or confidence intervals. Added local registration, login, logout, persistent
observer profiles and saved repositories, backed by the separate identity store.
Observer account controls remain distinct from simulated agent actions.

### Reading-position and development fixes

- React component definitions remain outside render functions; source panels are
  memoized, events keyed, native details uncontrolled and equal revisions skipped.
- Source/selection/horizontal scroll, details, focused elements and route reading
  positions survive normal refresh/advance. New activity retains a visible anchor.
- Background visibility changes pause playback instead of forcing a reload.
- Pending controls and feedback reserve their footprint. Workspace errors use a
  fixed surface, and the ranking table reserves loading/filter height.
- Native React preview dialogs close with Escape and restore the trigger without
  resetting document scroll. Trusted canvas engines are cleaned up on close.
- Development logs exposed incompatible Fast Refresh exports and duplicate-root
  creation. Split hooks, contexts and helpers from component-only JSX modules,
  reuse the root during HMR, dispose router listeners, retain route history, and
  guard navigation effects against rerunning for an unchanged route.

A focused live Hot Refresh probe edited/restored App, providers and shared UI.
All six updates were normal HMR updates, with no incompatible-export/page-reload
messages or duplicate-root errors. Reading scroll stayed at 236px, code retained
nonzero horizontal scroll, the expanded scenario and source focus survived, and
the search draft submitted unchanged. This covers those component updates, not
all possible changes to entry/config files or component hook signatures.

### Rendered and functional verification

A disposable memory-only cluster was used for browser writes. Verified registration,
profile editing, session restoration after reload, repository bookmarking, logout,
login, all ten scenario steps, Orbit start/stop, the new Orbital Garden preview,
Escape/focus return, category switching and mobile ranking. The normal workspace
was not advanced or reset by these checks. Temporary QA used localhost, keeping
its cookies separate from the normal 127.0.0.1 preview.

Focused text contrast checks passed for the mobile leaderboard and observer profile
in both themes. At 390px the document width was 375px including reserved scrollbar
space, and the ranking table stayed within its content panel. Normal refresh kept
main/code top positions exactly unchanged in the desktop browser observation.
Final screenshots use runtime/diagnostics/qa-react-*.png.

The final compiled DOM flow exercises source-node/selection/scroll/focus retention,
open details, unsubmitted navigation, full scenario/error recovery, themes, code
diffs, ranking, signup/login/logout, profile saving, bookmarks, search escaping,
service health and fresh-run navigation. Markup axe checks include signup, profile
editing, ranking and overview; rendered contrast is checked separately.

Impeccable reports one generic overused-font warning for Mona Sans. Retained for
the user's explicit GitHub reference. No new motion, decorative assets or motion
library were introduced. The standalone Playwright suite was updated for React
and the new account flows but was not executed locally because its Chromium build
is unavailable. Physical touch-device and screen-reader qualification remain
outside the evidence.
