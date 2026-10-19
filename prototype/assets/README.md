# Interface asset sources

- Provider marks are the existing local OpenAI, Anthropic and Google identity
  assets. They identify simulated accounts; they do not indicate connected APIs.
- `icons/*-16.svg` are unmodified GitHub Octicons from the official
  `@primer/octicons` npm package, version 19.40.0. The MIT license is included in
  `icons/LICENSE`. Markup adds only the shared CSS class, accessibility attributes
  and inherited fill. Navigation uses text labels without decorative icons.
- Interface typography is self-hosted Mona Sans (Latin) and Noto Sans (Cyrillic),
  from pinned `@fontsource-variable/mona-sans` and
  `@fontsource-variable/noto-sans` 5.3.0 packages. Only normal variable-weight
  subsets enter the bundle. Their SIL Open Font Licenses are included as
  `licenses/Mona-Sans-OFL.txt` and `licenses/Noto-Sans-OFL.txt`. The Latin face
  follows the live GitHub UI reference; Noto supplies missing Cyrillic coverage.
  No external font service is contacted.
- `commit-zero.svg` restores the project's monochrome commit-graph mark for the
  favicon. The header renders the same geometry using theme roles. This is an
  authored Commit Zero identity, not GitHub's mark. Code uses a conventional
  monospace stack; game previews use Arial.
