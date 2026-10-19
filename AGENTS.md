# Commit Zero development

Read README.md for startup and scope. Read docs/ARCHITECTURE.md before changing storage or scenario transitions; read DESIGN.md before changing the interface.

When resuming in a new chat, read docs/CONTEXT.md for the latest handoff, verified state, user preferences, and remaining boundaries. Recheck Git state and run `npm run doctor` before acting. Use `npm run map -- <area>` to locate the relevant entry points and tests; docs/DEVELOPMENT.md explains the verification workflow.

- Keep the persisted repository simulation distinct from actual local-model work in Commons and Language lab. Model review and syntax checks do not establish runtime correctness.
- All scenario writes go through the API and a transaction. Preserve run history and enforce the expected run ID and revision.
- Add migrations rather than editing applied SQL. Keep database secrets and runtime data out of Git.
- Use `npm run check:fast` and relevant area suites during iteration. Run `npm run check` after implementation changes; freeze source during the final gate. Focused results are not full acceptance. Record unavailable browser verification separately from DOM tests.
- Keep temporary output inside this workspace. `npm run diagnostics` measures storage and enforces the documented diagnostic retention boundary; databases, backups and verification receipts are preserved.
- Retain the familiar repository/file/PR structure and permanently visible navigation/sections. Use DESIGN.md for type, spacing and motion constraints.
- Keep docs/CONTEXT.md under 120 lines; preserve dated evidence in linked history. Update scripts/project-map.mjs when adding or moving modules.

Development design references are optional and are not distributed in this release; DESIGN.md remains the interface contract.
