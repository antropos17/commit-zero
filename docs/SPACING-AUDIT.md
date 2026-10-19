# Spacing and layout audit

Date: 2026-10-18. Scope: the current local Commit Zero UI and its existing,
uncommitted concept implementation. The original findings are retained below;
all six were subsequently fixed at the user's request.

## Remediation verification

Completed on 2026-10-18, in the existing working tree:

| Finding | Implemented result | Live verification |
| --- | --- | --- |
| 1. Vertical auto margins | Main uses zero block margins and horizontal centering | Zero top margin on all 90 route/viewport samples |
| 2. Accumulated heading spacing | Shared PageHeading owns title, description and optional actions; nested wrappers removed | 8px title/description gap and 24px heading/next-block gap; no compensating network-heading rules |
| 3. Environment section collision | Scoped 24px margin before Service health | 24px measured on desktop and mobile |
| 4. Compact mobile controls | Filter, header search, navigation Go, and repository metadata links have minimum 44px geometry | Every visible sampled control is at least 44px in both dimensions at 320/390px |
| 5. Native filter surface | Explicit semantic input background/text and standard 8px/12px padding | Dark background rgb(13,17,23), light rgb(255,255,255), matching --surface |
| 6. Additive sidebar spacing | One 32px margin, removed typography-layer top padding | 32px measured between navigation and repository heading |

The follow-up checked all 15 routes listed below at each of 320, 390, 768, 1024,
1280 and 1440px: 90 geometry samples with no document overflow. Mobile viewport
height was 844px; desktop/intermediate height was 900px, with additional visual
checks at 1280 x 720. The repository filter was exercised through empty results
and restoration. Visual inspection covered desktop Environment and History,
tablet Discover, and mobile repositories/Environment in dark and light themes.

`npm run check` passed lint, 12 Node tests, build, the compiled React DOM/axe
integration flow, and production-serving smoke checks. The scoped layout
detector returned `[]`. No new test suite was added for these CSS/component
spacing changes; the rendered measurements cover behavior DOM-only tests cannot.

Follow-up evidence is under `runtime/diagnostics/qa-spacing-fixed-*`:
`measurements.json`, `environment-desktop.png`, `history-desktop.png`,
`repositories-mobile-dark.png`, `repositories-mobile-light.png`, and
`environment-mobile-light.png`. Temporary viewport and theme changes were
restored. Physical touch devices and other browser engines remain untested.

## Original audit result

The repository-oriented layout is coherent, but spacing ownership is inconsistent.
Five P2 findings and one P3 finding are documented below. No blocking layout defect
was observed in the tested states. The first three findings should be fixed
together: they explain the visibly uneven vertical rhythm.

The layout detector returned `[]`; rendered measurements nevertheless exposed
real problems. A clean source detector is not a visual acceptance result.

## Evidence and coverage

- Live in-app Chromium viewport checks used widths 320, 390, 768, 1024, 1280,
  and 1440 CSS pixels. Heights were 720, 844, and 900 depending on the check.
- Fifteen routes were measured across selected viewport combinations:
  Discover, Overview, Repositories, Agents, Leaderboard, Your agents (signed out),
  Environment, Run history, Sign in, orbit repository, Pull requests, PR 12,
  issue 3, ChatGPT agent profile, and observer profile (signed out).
- The nine-route breakpoint sweep covered Environment, History, Discover,
  Repositories, Agents, Leaderboard, Sign in, orbit, and Overview at 320, 768,
  1024, and 1440. The remaining detailed routes were checked at 390 and 1280.
- Screenshots were inspected for Environment in dark and light, mobile
  Repositories, desktop History, desktop/mobile Overview, tablet Discover,
  and desktop PR conversation. Other routes received DOM geometry checks.
- No horizontal document overflow was observed in these checks. Internal code
  scrolling is intentional and is not counted as a page overflow defect.
- `npm run test:dom` passed its compiled React integration/axe flow. That test
  does not measure CSS layout or prove contrast in every rendered state.
- Source command: `.agents/skills/impeccable/scripts/impeccable.cmd detect --json --scope layout prototype/workspace.css prototype/social.css prototype/typography.css prototype/app/app.css`.
- Measurements: `runtime/diagnostics/qa-spacing-measurements.json`.
- Captures: `qa-spacing-environment-desktop.png`,
  `qa-spacing-history-desktop.png`, `qa-spacing-repositories-mobile.png`,
  `qa-spacing-environment-mobile-light.png`, all in `runtime/diagnostics/`.
  These are disposable diagnostics subject to the existing seven-day/50 MB policy.

## Findings

### 1. [P2] Short pages acquire an unintended vertical offset

Location: `prototype/social.css:221`, `prototype/workspace.css:127` and `:173`.
Category: layout consistency / implementation integrity.

The legacy `main { margin: auto; }` remains active inside the column-flex
`.workspace`. Available vertical space is distributed into the top and bottom
auto margins. The shell override changes width, padding and minimum height but
does not reset those margins.

At 1280 x 720, the Repositories heading starts at y=155.67 while History starts
at y=207.45. History has an additional 51.78px top margin; Repositories has zero.
At 1024 x 900 the corresponding difference is 42.78px. The offset depends on
content and viewport height, so navigation changes the heading anchor.

Recommendation: give `main` explicit zero block margins and retain horizontal
centering with `margin-inline: auto`. Let the footer or a dedicated flex rule
consume free vertical space. Verify short, empty and long routes at the same
viewport. Suggested action: `$impeccable layout`.

### 2. [P2] Page-heading spacing accumulates at several nested levels

Location: `prototype/app/components/ui.jsx:256`,
`prototype/app/pages/workspace.jsx:946`, `prototype/workspace.css:182`,
`prototype/typography.css:263`, `prototype/app/app.css:461`.
Category: layout rhythm / implementation integrity.

`PageHeading` emits `.section-top`; its description has 28px bottom margin,
and `.section-top` adds another 16px. History wraps this component in a second
`.section-top`. The newer `.network-heading` compensates by resetting some of
these margins, giving structurally similar headings different spacing rules.

Measured description-bottom to next-content-start intervals at 1280 x 720:

| Route | Interval |
| --- | ---: |
| Agents | 24px |
| Discover | 24px |
| Environment | 44px |
| Repositories, before filter | 44px |
| History, before run list | 60px |
| Leaderboard, before controls | 52px |

Impact: heading groups appear detached from their content, especially on phones,
where the description wraps and the persistent shell already occupies space.

Recommendation: assign the heading-to-content interval to one component;
use 8px within title/description and a deliberate 24px section interval.
Give heading actions a dedicated slot instead of nesting `.section-top` wrappers.
Treat filters as part of the following content group. Suggested action:
`$impeccable layout`.

### 3. [P2] Environment has no separation before Service health

Location: `prototype/app/pages/workspace.jsx:994`,
`prototype/social.css:349`.
Category: grouping / layout.

The notice box is immediately followed by the Service health heading. The
measured border-bottom to heading-box-top distance is exactly 0px on desktop
and at 390px. The heading also returns to the column edge while the notice text
is inset, making the section boundary particularly abrupt. This reproduces in
both light and dark themes.

Recommendation: model the notice and service-health block as sibling sections
with a 24px gap, or add a narrowly scoped equivalent. Avoid adding a global
margin to every notice, which also appears in PR flows. Suggested action:
`$impeccable layout`.

### 4. [P2] Some mobile controls meet the height rule only partially

Location: `prototype/social.css:434` and `:1510`,
`prototype/workspace.css:27`, `prototype/app/components/ui.jsx:106`.
Category: responsive / touch spacing.

At 390px, the repository filter is 39.33px high, while nearby standard inputs
use the documented 44px mobile height. Its padding remains 7px 10px. The header
search button is 34px wide by 44px high. Star/fork controls in the repository
catalog are approximately 27.21px wide by 44px high.

Impact: compact action hit areas and inconsistent input density. These violate
the project's 44px target direction, not automatically WCAG AA: target spacing
and the smaller WCAG minimum must be evaluated separately. No WCAG failure is
claimed solely from these numbers.

Recommendation: set a shared mobile input minimum height and explicit minimum
inline size for standalone icon actions; preserve 8-16px separation and avoid
inflating ordinary inline prose links. Suggested action: `$impeccable adapt`.

### 5. [P2] The repository filter inherits a different native field surface

Location: `prototype/social.css:434`, compared with
`prototype/app/app.css` input rules for network/ranking/account forms.
Category: theming; adjacent finding from the spacing inspection.

The filter defines a border and padding but no semantic background or text
color. In the inspected dark Chromium state it uses `rgb(59, 59, 59)` with white
text, unlike the other inputs using `var(--surface)` and `var(--text)`. Its gray
fill makes the already shorter field look like a different control family.

Recommendation: include this field in the shared semantic input treatment when
normalizing its dimensions. Do not infer a contrast failure from appearance;
no pixel contrast measurement was performed. Suggested action:
`$impeccable polish`.

### 6. [P3] The sidebar repository section has an additive 54px interval

Location: `prototype/workspace.css:87`, `prototype/typography.css:229`.
Category: spacing-system drift.

`.directory-section` receives 30px top margin from workspace.css and 24px top
padding from typography.css. The measured gap from the navigation bottom to its
heading is 54px. This pushes the repository list lower in a short desktop window
and falls outside the documented group intervals.

Recommendation: make one rule own this separation, using 24px or 32px after
visual comparison. Typography should not silently add structural padding.
Suggested action: `$impeccable polish`.

## What already works

- Main gutters are consistent within each responsive band: 32px desktop,
  24px intermediate, 16px narrow. They align with the scenario toolbar.
- Repository rows retain shared edges, divider spacing and readable grouping.
- Source overflow is contained in its own region, including at 320px.
- The mobile shell stacks navigation and controls without document overflow.
- PR conversation and profile structures preserve meaningful grouping.
- Existing no-motion behavior and semantic color roles should be retained.

## Scope limits and next pass

This is a spacing-focused audit. Accessibility has supporting DOM/axe evidence
and measured target sizes; responsive layout has live viewport evidence; theming
has selected light/dark observations; implementation integrity has source and
rendered evidence. Runtime performance, exhaustive contrast and full accessibility
conformance were not audited, so a five-dimension aggregate health score would
overstate coverage and is intentionally not assigned.

No physical touch device, Safari, Firefox, actual browser text zoom, authenticated
agent editor, error-state rendering, or game dialog layout was verified in this
pass. A narrow 320px viewport is not a substitute for an actual text-zoom test.

Recommended implementation order: normalize shell/heading ownership and Environment
section spacing (`$impeccable layout`), normalize mobile control geometry
(`$impeccable adapt`), then review native field appearance and sidebar rhythm
(`$impeccable polish`). Recheck the same viewport/route pairs afterward and run
the required `npm run check` if implementation files change.

No application source or saved user data was changed by the original audit. The temporary
viewport override was reset and the original dark theme restored. The DOM test
used its own disposable services.
