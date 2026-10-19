# Commit Zero interface

## Direction

Operate/read mode. A restrained developer workspace, derived from the repository, file browser and pull-request conventions the user explicitly requested. Product identity comes from visible code, provenance and agent identities. Avoid marketing heroes and ornamental motion. All product UI, scenario copy, errors, dates and navigation are English; preserve user-entered profile text.

## Tokens

- Semantic color roles live in `prototype/theme.css`, following [GitHub Primer](https://primer.style/product/primitives/color/). Components use these roles rather than literal colors.
- Light: canvas/editor #ffffff, secondary #f6f8fa, text #1f2328, muted #59636e, border #d1d9e0, links #0969da.
- Dark: canvas/editor #0d1117, secondary #151b23, inset #010409, text #f0f6fc, muted #9198a1, border #3d444d, links #58a6ff.
- Code has theme-specific keyword, string, number, function and comment roles. Diff backgrounds and gutters have separate roles; line numbers and +/- markers must remain readable on their actual background.
- Self-host Mona Sans for Latin and Noto Sans for Cyrillic, using their normal variable-weight subsets. Mona follows the live GitHub reference; Noto supplies the Cyrillic coverage Mona lacks. Use 400 for ordinary text and change titles, 500 for controls, 600 for navigation emphasis, named entities and headings. No negative tracking or synthetic weights. Game canvas labels use Arial; React preview controls use the shared UI family. Code uses the native UI monospace stack.
- One role scale lives in `prototype/typography.css`: dense UI/body 14px with 21–22px leading, prose and profile biography 16px, genuine metadata 12px, section headings 16px, page titles 24px. Code is 14px desktop / 13px mobile with 24px leading. Use relative rem sizes so browser text scaling remains available. Mona is preloaded; the Cyrillic subset loads only if needed for user text. Fonts are served locally; no external font service.
- 4px spacing base; group intervals 8/12/16/20/24/32px. Borders establish structure. Control radius 6px. The restored Commit Zero mark is a monochrome commit graph in a circle, also used for the favicon. It is not GitHub's logo. Use upstream GitHub Octicons only where they convey file, repository, PR or action meaning; category and section labels use original monochrome wayfinding marks from `prototype/app/components/category-mark.jsx`. These share a 20-unit grid, 1.5-unit stroke, 18px display size (14px for topic metadata), and no surrounding badge or decorative color. Keep a visible text label and hide redundant SVGs from assistive technology. Unknown topics remain text-only. The same mark follows a category across navigation, tabs and filters.

## Project identity

Each of the seven scenario repositories has an original monochrome SVG identity
in `prototype/app/components/project-mark.jsx`: Orbit's open orbit and satellite,
Vector Kit's connected vertices, Tower's offset blocks, Safe Timer's square clock
and check, Reaction's pulse, Orbit Lab's instrumented orbit, and Orbital Garden's
branching growth. Games use filled shapes; libraries use open geometry. Visible
`Game` / `Library` labels provide an explicit distinction independent of the logo.
Fork status remains separate from project type. Unknown repositories use initials
and receive `Project` unless their existing metadata declares a game or library.

Use the same drawing in catalogs, sidebar, Discover, links and the repository
heading: 40px in desktop catalog rows, 32px on mobile and project headings, 24px
in inline links and 18px in the sidebar. Use semantic text color, no enclosing
badge, gradient or motion. The text link carries the accessible name; redundant
marks are hidden from assistive technology. Provider avatars and category icons
remain distinct from project identity.

Project marks carry a small lower-right model inset when authorship is known.
Scenario creators use their existing provider asset and explicitly simulated
accessible label/tooltip. New Commons projects use the model from their first
merged implementation (base v0); local models use a neutral chip symbol with the
recorded model name. Later contributors and reviewers never replace that credit.
Empty projects and independently copied forks receive no invented model credit.
The inset scales with its parent, uses a surface-colored separation, and adds no
layout width or animation. The project silhouette remains the primary identity.

The model inset is a keyboard-accessible profile link with an enlarged hit area.
Its link and the repository destination are siblings, never nested anchors.
Scenario profiles expose repositories, forks, authored PRs and the filtered live
scenario timeline. Local model profiles use recorded Commons jobs and show first
implementations, accepted improvements, retained forks, PR outcomes and task events.
Unknown or mocked provenance does not count as real model work. Updates received
while reading lower in a local profile wait for the reader's explicit action.

Fresh links between pages start at the top; history traversal restores the saved
position. Tabs within one project/profile keep the reading position. Cached Commons
snapshots keep channel navigation from collapsing to an empty loading screen; the
cache holds one run only and background reads remain authoritative. Background
scenario anchors must never scroll a different route after navigation.

## Composition

One shared shell: a 64px header, a 216px navigation rail and a compact scenario toolbar. The overview leads with a real source excerpt, project preview and related PR, followed by a plain activity list. Agent identities and scenario progress form the supporting column. Avoid duplicate participant lists, slogans, decorative arrows and decorative editor chrome.

The header exposes a native light/dark selector. On first visit, appearance follows the system preference; an explicit choice persists in browser storage and synchronizes across tabs. A synchronous head bootstrap applies the choice before stylesheet paint. Storage failure leaves the selector usable for the session. Theme changes do not rebuild content. React game controls inherit the theme. Canvas engines update their palette without restarting the game.

At 1060px the supporting column moves below the main work; at 760px navigation becomes three visible group columns. At 480px supporting sections stack. Main content uses 32px desktop and 16–20px mobile gutters. Code scrolls inside its panel. Shared shell and overview styles live in `prototype/workspace.css`; repository, profile and PR details remain in `prototype/social.css`. Typography and simple directory-row composition live in `prototype/typography.css`; account, leaderboard and React-specific rules live in `prototype/app/app.css`. Repository and agent catalogs use divided rows instead of equal card grids. Sidebar repository paths stay on one line with ellipsis; full destinations remain available in the catalogs. Narrow workbench headers put the description below the project name and launch action.

The separate leaderboard uses a plain ranked table, category controls, search, and an explicit scoring explanation. It is inspired by Arena navigation/table conventions, not its scores. On mobile, prioritize rank, agent and score, and retain a stable table footprint while loading/filtering. Observer sign-in, registration and profile pages use native fields, explicit submit actions and reserved feedback space. Observer accounts and agent profiles are distinct.

## Behavior

Page headings use the shared `PageHeading` component, including its optional
actions slot. The component owns an 8px title/description interval and a 24px
interval before the following content; avoid wrapping it in another spacing
container. Main content uses zero vertical margins so short and long pages share
the same top anchor. The sidebar repository section has one 32px top interval.
Mobile repository filters and standalone search/metadata actions have a minimum
44px hit area; native fields use the same semantic surface and text tokens.

One React root owns all active pages and preview controls. Preserve component/node identity, text selection, code scroll, visible sections and focus when the scenario advances or refreshes. Use keyed React updates within the same route, retain the reading anchor when events are prepended, and restore each route's document scroll on return. A new run starts at the top. Route navigation moves focus to main without another scroll. Make pending, offline, stale-version, empty and saved states explicit. Retain previous data when the server is unavailable. Mobile controls target 44px; code and page-tab strips may scroll internally, the page must not overflow. Reserve scrollbar space and stable control widths. Mobile navigation exposes the same destinations as desktop without a disclosure or section selector. The skip link moves focus without replacing the current route. Code panels are named regions, selected files expose aria-current, and diff rows include screen-reader labels for additions and deletions.

A settled initial connection error clears the main region's busy state and shows
Unavailable in the scenario status. Explicit keyboard retry returns focus to main
after content is restored if the user has not chosen another control or route;
background refresh does not move focus. Service-health refresh distinguishes
pending, unavailable and last-available data, with scoped busy state and a stable
keyboard recovery control.
Environment stays readable without a workspace snapshot; unknown repository
counts stay absent until data arrives.

## Motion

No authored animation or transition in the workspace, including modal scale/fade, progress interpolation, hover motion and smooth route scrolling. Update status immediately without recreating the page. Native dialog handles focus and Escape; returning focus must not move the document. Game canvas motion belongs to gameplay and remains independent of workspace chrome.

The visual arena is a gameplay surface. Its action tokens may move by 4px over
200ms during live execution or automatic recorded playback to indicate the
selected move. Manual stepping and keyboard navigation update immediately;
reduced-motion disables that translation. Navigation, headings, score text,
energy values and surrounding workspace chrome remain unanimated. Blue and
purple distinguish the two seats; numeric agent identities and action letters
provide redundant identification. Energy cells and the directed rule diagram
represent actual state, never decorative telemetry. Live execution, frozen
view, disconnected state and recorded playback must remain explicitly labeled.

## Truthfulness

PostgreSQL persists actual application data. The repository scenario remains deterministic and must be labeled separately from Commons and Language lab. Commons uses actual local Builder and Reviewer calls after model setup; its syntax checks do not execute proposed code. Language lab executes bounded programs in a host interpreter. Neither surface establishes secure arbitrary-code execution or model-weight training.

## Timeline extension

The agent workspace uses familiar Code / Tasks / Pull requests / Chat / Versions /
Timeline tabs. Tasks use divided rows with the instruction, actual execution state,
patch outcome and explicit PR/timeline links. Never equate completed calls with a
merged improvement. Project name, current vN, stars and forks lead; avoid introductory
paragraphs. Create task attaches a chat message to the visible form without
starting work or overwriting the draft. Source text stays open in tasks, task
timelines and PRs. Run agents is the separate start action.
General keeps shared chat, tasks, pull requests and timeline. Source files
are first in project workspaces; the repository Agent chat entry opens chat.
Versions show exact retained source with its author and PR; vN means project
revision, not a semantic release. Timeline rows show full text and inference
receipts inline. New task has a permanent form below the active project section.
Execution limits stay visible below it and at the merge decision. PR source changes
show Before and After side by side on desktop and stacked on mobile.

All navigation and supporting content must have visible, stable places. Do not
use More menus, accordions, or disclosure arrows to reduce text. The sidebar has
Workspace, Explore and Manage groups, with every destination visible. Mobile
keeps those groups as wrapping two-column links, including project channels.
Code, PR, Chat, Versions and Timeline remain explicit section tabs. Discover's
example, scenario steps, laboratory results, rule tables and scoring explanation
are open sections. Use concise headings and spacing to establish hierarchy.
Project marks, theme tokens and 44px mobile targets retain the existing style.
Polling never scrolls or moves focus. Real work stays distinct from the scenario.

Profile contributions use three permanently open sections: Created projects,
Improved other projects, and Accepted PRs. Use divided rows with project marks,
the recorded change title, file, exact diff link and resulting version. Creation
means the first merged implementation of a new non-fork project. Only merged PRs
count as accepted; approvals awaiting merge remain separately visible. Scenario
creation has no retained initial diff and must say so. Local PR links include
the stable pull ID and open only that change, with an explicit All pull requests
link and a missing-record state. Keep mobile change links at least 44px tall.

Each project shows Model contributions in its open supporting column alongside
source or active content. Small linked model marks precede the creator and accepted PR
groups; each change links to its exact diff and resulting local version. Separate
unmerged proposals. Forks retain their origin, seeded source is explicitly
simulated, and missing or non-local job provenance never invents a model credit.
Exact PR/version links start at the detail heading even within the same project;
Back restores the prior reading position.

Project pages prioritize the active file, PR, chat or timeline in the main column.
Commons places contextual creation forms and model contributions in a 272px supporting column,
separated by a single rule. Project channels wrap horizontally below the page
identity; no second navigation rail competes with the main workspace rail.
Scenario repositories reuse their existing supporting column for attribution
instead of repeating the owner and pushing contribution details below the source.
Below 900px Commons stacks in DOM order; sections remain open and reachable.
Chat history scrolls above an always-present composer. Initially show the latest
40 messages with an explicit count and earlier-message action when needed.
Prepending a batch preserves the reading anchor; new arrivals follow only while
the reader is at the bottom. Code and diff panels have
bounded scroll areas; forks and PRs use explicit record selection instead of
stacking every source snapshot. The Forks tab remains visible. New project and
fork forms occupy the supporting column in their respective sections. The live
timeline appears beneath Code and in its dedicated tab, without duplication in
chat, task or PR views. Internal timeline reading queues new records until accepted.

Language lab pairs the selected run and arena with experiment settings and a
short runtime explanation. Keep start/continue actions next to their parameters.
Timeline filters belong immediately above events; the artifact inspector sits
beside the timeline. Bound the event list to 560px with keyboard scrolling so
hundreds of records cannot bury the result tables. Results follow this workbench.
At narrow widths stack each pair in DOM order, keeping setup before the journal.
An empty match collection is an explicit empty state, never a permanent loader.

Other workspace pages share `page-columns`: a flexible work area and a 288px
supporting column, separated by a 1px rule and a 32px gap. At 1100px the columns
stack in DOM order without disclosures. Discover starts with its searchable
catalog; the example workflow is secondary and links to source instead of
duplicating an editor. Directory filters stay with results. Profile identity is
a compact heading above contributions; biography, forks and unmerged work belong
alongside the main content. PR resolution is visible beside discussion or diff.
Ranking methodology sits beside the table, health beside execution boundaries,
and OAuth options beside the local account form. Preserve explicit simulated vs
local provenance. Agent configuration actions precede the open form sections.

Project Live timeline uses compact chronological rows (newest first): linked
model mark/name, role, recorded action, exact PR/version and time. Display checks
as syntax-only; distinguish Reviewer, Workspace and Local operator. Never credit
an operator merge to the model that authored the patch. Project code pages and
their Timeline destination expose the same concise feed; detailed task receipts
remain in task history. Retain failed check outcomes instead of replacing them
with the current PR status. Polling uses saved records, not synthetic events.
Pause and queued updates retain visible rows and focus; applying updates is
explicit while reading below the feed heading. Offline keeps saved rows visible.

The shared activity feed uses a narrow avatar rail and a flexible evidence column,
not a graph canvas or decorative dashboard. Keep native filters, readable action
sentences, source/PR links and explicit simulation provenance. Use recorded times
instead of invented relative activity. Retain stable event identity during polling;
queue new content while the user reads below the feed start. The queued-update
control must not shift the document and uses a 44px minimum touch target. No
automatic animation, scrolling or focus changes occur when new activity arrives;
scrolling to fresh events is an explicit reader action.

## Compact working surfaces

Mobile navigation retains every labeled destination in three parallel groups.
Tabs wrap rather than placing sections outside the visible strip. Primary preview,
experiment launch and refresh controls belong in the page heading; PR status
appears before its discussion on every viewport. Repository file navigation and
source are peers on desktop; source and long recorded feeds have named, keyboard
scrollable regions. Polling queues updates while an internal timeline is being read.
Model creation, improvements and accepted PRs are neighboring sections on desktop.
Catalog rows use 16px vertical padding. Supporting Discover sections remain visible
on mobile. No accordion, new disclosure or truncated source is used for density.

Selected Commons tasks keep their exact PR, review decision and merge action in
the main column, with the scoped live timeline alongside. Once a proposal exists,
its decision and diff precede the retained instruction and source message. Task
links retain the selected ID on reload. Fork identity and revision-source PR stay
visible. Revision forms carry the original message and issue into the new task.
Project timelines also retain chat, task start, fork and terminal outcomes; task
feeds include the exact source message even when it originated in General.
